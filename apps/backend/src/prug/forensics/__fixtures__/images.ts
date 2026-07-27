/**
 * Synthetic image builders for the forensics tests.
 *
 * Real fixture files would have to be committed as binaries and could not be
 * varied per assertion, so the tests build valid PNG and JPEG containers byte
 * by byte instead. Excluded from the production build.
 */

import { deflateSync } from 'zlib';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

export interface PngOptions {
  width: number;
  height: number;
  /** Returns the 0-255 grey level at a pixel. */
  pixel: (x: number, y: number) => number;
  /** Optional tEXt chunks, e.g. { Software: 'Adobe Photoshop 25.0' }. */
  text?: Record<string, string>;
}

/** Build a valid 8-bit greyscale, non-interlaced PNG. */
export function buildPng(options: PngOptions): Buffer {
  const { width, height, pixel } = options;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: greyscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    for (let x = 0; x < width; x++) {
      raw[y * (width + 1) + 1 + x] = Math.max(
        0,
        Math.min(255, Math.round(pixel(x, y))),
      );
    }
  }

  const chunks = [PNG_SIGNATURE, pngChunk('IHDR', ihdr)];

  for (const [keyword, value] of Object.entries(options.text || {})) {
    chunks.push(
      pngChunk(
        'tEXt',
        Buffer.concat([
          Buffer.from(keyword, 'latin1'),
          Buffer.from([0]),
          Buffer.from(value, 'latin1'),
        ]),
      ),
    );
  }

  chunks.push(pngChunk('IDAT', deflateSync(raw)));
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

export interface ExifOptions {
  make?: string;
  model?: string;
  software?: string;
  dateTimeOriginal?: string;
  modifyDate?: string;
  pixelXDimension?: number;
  pixelYDimension?: number;
}

const TAGS = {
  MAKE: 0x010f,
  MODEL: 0x0110,
  SOFTWARE: 0x0131,
  MODIFY_DATE: 0x0132,
  EXIF_IFD: 0x8769,
  DATE_TIME_ORIGINAL: 0x9003,
  PIXEL_X: 0xa002,
  PIXEL_Y: 0xa003,
};

interface PendingEntry {
  tag: number;
  type: number;
  count: number;
  /** Inline 4-byte value, or null when the value is written to the data area. */
  inline: number | null;
  data?: Buffer;
}

function asciiEntry(tag: number, value: string): PendingEntry {
  const data = Buffer.from(`${value}\0`, 'latin1');
  return {
    tag,
    type: 2,
    count: data.length,
    inline: data.length <= 4 ? null : null,
    data,
  };
}

function shortEntry(tag: number, value: number): PendingEntry {
  return { tag, type: 3, count: 1, inline: value << 16 };
}

/** Serialise one IFD plus its data area at `baseOffset` within the TIFF block. */
function buildIfd(
  entries: PendingEntry[],
  baseOffset: number,
  nextIfdOffset: number,
): Buffer {
  const header = Buffer.alloc(2 + entries.length * 12 + 4);
  header.writeUInt16BE(entries.length, 0);

  const dataChunks: Buffer[] = [];
  let dataOffset = baseOffset + header.length;

  entries.forEach((entry, index) => {
    const at = 2 + index * 12;
    header.writeUInt16BE(entry.tag, at);
    header.writeUInt16BE(entry.type, at + 2);
    header.writeUInt32BE(entry.count, at + 4);

    if (entry.data && entry.data.length > 4) {
      header.writeUInt32BE(dataOffset, at + 8);
      // Data area entries must start on a word boundary.
      const padded =
        entry.data.length % 2
          ? Buffer.concat([entry.data, Buffer.alloc(1)])
          : entry.data;
      dataChunks.push(padded);
      dataOffset += padded.length;
    } else if (entry.data) {
      const inline = Buffer.alloc(4);
      entry.data.copy(inline);
      inline.copy(header, at + 8);
    } else {
      header.writeUInt32BE(entry.inline ?? 0, at + 8);
    }
  });

  header.writeUInt32BE(nextIfdOffset, 2 + entries.length * 12);
  return Buffer.concat([header, ...dataChunks]);
}

/** Build a TIFF/EXIF block (big-endian) with an IFD0 and an Exif sub-IFD. */
export function buildExifBlock(options: ExifOptions): Buffer {
  const ifd0Entries: PendingEntry[] = [];
  if (options.make) ifd0Entries.push(asciiEntry(TAGS.MAKE, options.make));
  if (options.model) ifd0Entries.push(asciiEntry(TAGS.MODEL, options.model));
  if (options.software)
    ifd0Entries.push(asciiEntry(TAGS.SOFTWARE, options.software));
  if (options.modifyDate)
    ifd0Entries.push(asciiEntry(TAGS.MODIFY_DATE, options.modifyDate));

  const exifEntries: PendingEntry[] = [];
  if (options.dateTimeOriginal)
    exifEntries.push(
      asciiEntry(TAGS.DATE_TIME_ORIGINAL, options.dateTimeOriginal),
    );
  if (options.pixelXDimension)
    exifEntries.push(shortEntry(TAGS.PIXEL_X, options.pixelXDimension));
  if (options.pixelYDimension)
    exifEntries.push(shortEntry(TAGS.PIXEL_Y, options.pixelYDimension));

  const hasExifIfd = exifEntries.length > 0;
  if (hasExifIfd) {
    // Pointer value is patched once the IFD0 length is known.
    ifd0Entries.push({ tag: TAGS.EXIF_IFD, type: 4, count: 1, inline: 0 });
  }

  const tiffHeader = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
  ]);
  const ifd0 = buildIfd(ifd0Entries, 8, 0);

  if (!hasExifIfd) return Buffer.concat([tiffHeader, ifd0]);

  const exifIfdOffset = 8 + ifd0.length;
  const pointerAt = 2 + (ifd0Entries.length - 1) * 12 + 8;
  ifd0.writeUInt32BE(exifIfdOffset, pointerAt);

  const exifIfd = buildIfd(exifEntries, exifIfdOffset, 0);
  return Buffer.concat([tiffHeader, ifd0, exifIfd]);
}

// ---------------------------------------------------------------------------
// Baseline JPEG encoder (DC coefficients only)
//
// Enough of a real encoder to exercise the DC decoder end to end: canonical
// Huffman tables, a proper entropy-coded scan with byte stuffing, and one
// quantisation table. Every block carries its DC term and an immediate EOB.
// ---------------------------------------------------------------------------

/** Annex K standard luminance DC table. */
const STD_DC_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const STD_DC_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Annex K standard luminance AC table, truncated to the codes we emit. */
const STD_AC_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const STD_AC_VALUES = (() => {
  const values = [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41,
  ];
  const total = STD_AC_BITS.reduce((sum, count) => sum + count, 0);
  // Pad with distinct filler symbols so the table length matches its BITS.
  while (values.length < total) values.push(0xf0 + (values.length % 16));
  return values.slice(0, total);
})();

/** Canonical code assignment, mirroring the decoder's table construction. */
function huffmanCodes(
  bits: number[],
  values: number[],
): Map<number, { code: number; length: number }> {
  const codes = new Map<number, { code: number; length: number }>();
  let code = 0;
  let k = 0;

  for (let length = 1; length <= 16; length++) {
    for (let i = 0; i < bits[length - 1]; i++) {
      codes.set(values[k++], { code, length });
      code++;
    }
    code <<= 1;
  }
  return codes;
}

class BitWriter {
  private readonly bytes: number[] = [];
  private current = 0;
  private filled = 0;

  write(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.current = (this.current << 1) | ((value >> i) & 1);
      this.filled++;
      if (this.filled === 8) this.flushByte();
    }
  }

  private flushByte(): void {
    this.bytes.push(this.current & 0xff);
    // 0xFF in entropy data must be followed by a stuffed 0x00.
    if ((this.current & 0xff) === 0xff) this.bytes.push(0x00);
    this.current = 0;
    this.filled = 0;
  }

  finish(): Buffer {
    while (this.filled !== 0) {
      this.current = (this.current << 1) | 1; // pad with 1-bits
      this.filled++;
      if (this.filled === 8) this.flushByte();
    }
    return Buffer.from(this.bytes);
  }
}

function magnitudeCategory(value: number): number {
  let category = 0;
  let magnitude = Math.abs(value);
  while (magnitude) {
    category++;
    magnitude >>= 1;
  }
  return category;
}

function huffmanTableSegment(
  cls: number,
  id: number,
  bits: number[],
  values: number[],
): Buffer {
  return jpegSegment(
    0xc4,
    Buffer.concat([
      Buffer.from([(cls << 4) | id]),
      Buffer.from(bits),
      Buffer.from(values),
    ]),
  );
}

export interface BaselineJpegOptions {
  width: number;
  height: number;
  /** Quantised DC coefficient per 8x8 block, in raster order. */
  blockDcValues: number[];
  /** Value used for every entry of the quantisation table. */
  quant?: number;
}

/** Build a decodable single-component baseline JPEG. */
export function buildBaselineJpeg(options: BaselineJpegOptions): Buffer {
  const quant = options.quant ?? 8;
  const dcCodes = huffmanCodes(STD_DC_BITS, STD_DC_VALUES);
  const acCodes = huffmanCodes(STD_AC_BITS, STD_AC_VALUES);
  const eob = acCodes.get(0x00)!;

  const writer = new BitWriter();
  let predictor = 0;

  for (const dc of options.blockDcValues) {
    const diff = dc - predictor;
    predictor = dc;

    const category = magnitudeCategory(diff);
    const symbol = dcCodes.get(category)!;
    writer.write(symbol.code, symbol.length);

    if (category > 0) {
      // Negative values are encoded as the one's complement of |diff|.
      const magnitude = diff > 0 ? diff : diff + (1 << category) - 1;
      writer.write(magnitude, category);
    }

    writer.write(eob.code, eob.length);
  }

  const quantSegment = jpegSegment(
    0xdb,
    Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, quant)]),
  );

  const sof = Buffer.alloc(9);
  sof[0] = 8;
  sof.writeUInt16BE(options.height, 1);
  sof.writeUInt16BE(options.width, 3);
  sof[5] = 1;
  sof[6] = 1;
  sof[7] = 0x11;
  sof[8] = 0;

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    quantSegment,
    huffmanTableSegment(0, 0, STD_DC_BITS, STD_DC_VALUES),
    huffmanTableSegment(1, 0, STD_AC_BITS, STD_AC_VALUES),
    jpegSegment(0xc0, sof),
    jpegSegment(0xda, Buffer.from([1, 1, 0x00, 0, 63, 0])),
    writer.finish(),
    Buffer.from([0xff, 0xd9]),
  ]);
}

/** Same container, but declared progressive so decoders must decline it. */
export function buildProgressiveJpeg(width: number, height: number): Buffer {
  const sof = Buffer.alloc(9);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = 1;
  sof[6] = 1;
  sof[7] = 0x11;
  sof[8] = 0;

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(
      0xdb,
      Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 8)]),
    ),
    jpegSegment(0xc2, sof),
    jpegSegment(0xda, Buffer.from([1, 1, 0x00, 0, 63, 0])),
    Buffer.from([0x00, 0x11]),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = marker;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

export interface JpegOptions {
  width: number;
  height: number;
  exif?: ExifOptions;
  /** Include the APP14 "Adobe" marker. */
  adobeApp14?: boolean;
  /** Include an APP1 XMP packet with an edit history. */
  xmpHistory?: boolean;
  /** Arbitrary XMP payload, e.g. a generator tag. */
  xmp?: string;
}

/**
 * Build a JPEG container that parses correctly but carries no real scan data.
 * Enough for metadata assertions; pixel decoding is exercised through PNG.
 */
export function buildJpeg(options: JpegOptions): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];

  parts.push(
    jpegSegment(
      0xe0,
      Buffer.concat([Buffer.from('JFIF\0', 'latin1'), Buffer.alloc(9)]),
    ),
  );

  if (options.exif) {
    parts.push(
      jpegSegment(
        0xe1,
        Buffer.concat([
          Buffer.from('Exif\0\0', 'latin1'),
          buildExifBlock(options.exif),
        ]),
      ),
    );
  }

  const xmp =
    options.xmp ||
    (options.xmpHistory
      ? '<x:xmpmeta><rdf:RDF><rdf:Description><xmpMM:History><rdf:Seq><rdf:li stEvt:action="saved"/></rdf:Seq></xmpMM:History></rdf:Description></rdf:RDF></x:xmpmeta>'
      : null);

  if (xmp) {
    parts.push(
      jpegSegment(
        0xe1,
        Buffer.concat([
          Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'),
          Buffer.from(xmp, 'utf8'),
        ]),
      ),
    );
  }

  if (options.adobeApp14) {
    parts.push(
      jpegSegment(
        0xee,
        Buffer.concat([Buffer.from('Adobe', 'latin1'), Buffer.alloc(7)]),
      ),
    );
  }

  // A plausible luminance quantisation table (IJG quality 50).
  const quantTable = Buffer.concat([
    Buffer.from([0x00]),
    Buffer.from([
      16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13,
      16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56,
      68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103,
      121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
    ]),
  ]);
  parts.push(jpegSegment(0xdb, quantTable));

  const sof = Buffer.alloc(9);
  sof[0] = 8; // precision
  sof.writeUInt16BE(options.height, 1);
  sof.writeUInt16BE(options.width, 3);
  sof[5] = 1; // one component
  sof[6] = 1; // component id
  sof[7] = 0x11; // sampling 1x1
  sof[8] = 0; // quant table 0
  parts.push(jpegSegment(0xc0, sof));

  parts.push(jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])));
  parts.push(Buffer.from([0x00, 0x11, 0x22, 0x33])); // stand-in entropy data
  parts.push(Buffer.from([0xff, 0xd9]));

  return Buffer.concat(parts);
}
