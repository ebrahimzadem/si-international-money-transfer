/**
 * Minimal TIFF/EXIF reader.
 *
 * Written from scratch against the raw byte layout so the fraud pipeline has no
 * native image dependencies. Only the tags the risk engine actually scores are
 * decoded; everything else is skipped.
 */

export interface ExifData {
  make?: string;
  model?: string;
  software?: string;
  lensModel?: string;
  artist?: string;
  copyright?: string;
  /** IFD0 DateTime — rewritten by editors when a file is re-saved. */
  modifyDate?: string;
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  orientation?: number;
  /** Dimensions the camera recorded, which may differ from the JPEG frame. */
  pixelXDimension?: number;
  pixelYDimension?: number;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  /** Embedded JPEG preview from IFD1, used for thumbnail/main mismatch checks. */
  thumbnail?: Buffer;
  /** Every tag id that was present, for diagnostics. */
  tagCount: number;
}

const TAG = {
  MAKE: 0x010f,
  MODEL: 0x0110,
  ORIENTATION: 0x0112,
  SOFTWARE: 0x0131,
  MODIFY_DATE: 0x0132,
  ARTIST: 0x013b,
  COPYRIGHT: 0x8298,
  EXIF_IFD: 0x8769,
  GPS_IFD: 0x8825,
  EXPOSURE_TIME: 0x829a,
  F_NUMBER: 0x829d,
  ISO: 0x8827,
  DATE_TIME_ORIGINAL: 0x9003,
  DATE_TIME_DIGITIZED: 0x9004,
  FOCAL_LENGTH: 0x920a,
  PIXEL_X: 0xa002,
  PIXEL_Y: 0xa003,
  LENS_MODEL: 0xa434,
  THUMB_OFFSET: 0x0201,
  THUMB_LENGTH: 0x0202,
} as const;

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

interface Entry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
}

class TiffReader {
  constructor(
    private readonly buf: Buffer,
    private readonly little: boolean,
  ) {}

  u16(offset: number): number {
    return this.little
      ? this.buf.readUInt16LE(offset)
      : this.buf.readUInt16BE(offset);
  }

  u32(offset: number): number {
    return this.little
      ? this.buf.readUInt32LE(offset)
      : this.buf.readUInt32BE(offset);
  }

  i32(offset: number): number {
    return this.little
      ? this.buf.readInt32LE(offset)
      : this.buf.readInt32BE(offset);
  }

  ascii(offset: number, count: number): string {
    if (offset + count > this.buf.length) return '';
    const raw = this.buf.subarray(offset, offset + count).toString('latin1');
    return raw.replace(/\0+$/, '').trim();
  }
}

function readEntries(
  reader: TiffReader,
  buf: Buffer,
  ifdOffset: number,
): { entries: Entry[]; next: number } {
  if (ifdOffset <= 0 || ifdOffset + 2 > buf.length)
    return { entries: [], next: 0 };

  const count = reader.u16(ifdOffset);
  const entries: Entry[] = [];
  // A corrupt count can claim thousands of entries; bound it to the buffer.
  const max = Math.min(count, Math.floor((buf.length - ifdOffset - 2) / 12));

  for (let i = 0; i < max; i++) {
    const at = ifdOffset + 2 + i * 12;
    entries.push({
      tag: reader.u16(at),
      type: reader.u16(at + 2),
      count: reader.u32(at + 4),
      valueOffset: at + 8,
    });
  }

  const nextAt = ifdOffset + 2 + max * 12;
  const next = nextAt + 4 <= buf.length ? reader.u32(nextAt) : 0;
  return { entries, next };
}

/** Resolve where an entry's payload lives: inline (<= 4 bytes) or at a pointer. */
function dataOffset(reader: TiffReader, entry: Entry): number {
  const size = (TYPE_SIZES[entry.type] || 0) * entry.count;
  return size <= 4 ? entry.valueOffset : reader.u32(entry.valueOffset);
}

function readNumber(reader: TiffReader, entry: Entry): number | undefined {
  const offset = dataOffset(reader, entry);
  switch (entry.type) {
    case 1:
    case 7:
      return reader['buf' as never] ? undefined : undefined;
    case 3:
      return reader.u16(offset);
    case 4:
      return reader.u32(offset);
    case 9:
      return reader.i32(offset);
    case 5: {
      const num = reader.u32(offset);
      const den = reader.u32(offset + 4);
      return den === 0 ? 0 : num / den;
    }
    case 10: {
      const num = reader.i32(offset);
      const den = reader.i32(offset + 4);
      return den === 0 ? 0 : num / den;
    }
    default:
      return undefined;
  }
}

function readRationalString(
  reader: TiffReader,
  entry: Entry,
): string | undefined {
  const value = readNumber(reader, entry);
  if (value === undefined) return undefined;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** GPS coordinates are stored as three rationals (deg, min, sec) plus a hemisphere ref. */
function readGpsCoordinate(
  reader: TiffReader,
  entry: Entry,
  ref: string | undefined,
): number | undefined {
  if (entry.count < 3 || (entry.type !== 5 && entry.type !== 10))
    return undefined;
  const offset = dataOffset(reader, entry);
  const parts: number[] = [];
  for (let i = 0; i < 3; i++) {
    const num = reader.u32(offset + i * 8);
    const den = reader.u32(offset + i * 8 + 4);
    parts.push(den === 0 ? 0 : num / den);
  }
  const decimal = parts[0] + parts[1] / 60 + parts[2] / 3600;
  const negative = ref === 'S' || ref === 'W';
  return negative ? -decimal : decimal;
}

/**
 * Parse a TIFF/EXIF block. `buf` must start at the TIFF header ("II"/"MM"),
 * i.e. the APP1 payload with the leading "Exif\0\0" already stripped.
 */
export function parseExif(buf: Buffer): ExifData | null {
  if (buf.length < 8) return null;

  const byteOrder = buf.toString('latin1', 0, 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return null;

  const reader = new TiffReader(buf, byteOrder === 'II');
  if (reader.u16(2) !== 0x002a) return null;

  const exif: ExifData = { tagCount: 0 };
  const gpsRefs: Record<number, string> = {};

  const applyEntry = (
    entry: Entry,
    scope: 'tiff' | 'exif' | 'gps',
  ): number | null => {
    exif.tagCount++;

    if (scope === 'gps') {
      // 0x0001 = lat ref, 0x0003 = lon ref; both precede their coordinate tag.
      if (entry.tag === 0x0001 || entry.tag === 0x0003) {
        gpsRefs[entry.tag] = reader.ascii(
          dataOffset(reader, entry),
          entry.count,
        );
      } else if (entry.tag === 0x0002) {
        exif.gpsLatitude = readGpsCoordinate(reader, entry, gpsRefs[0x0001]);
      } else if (entry.tag === 0x0004) {
        exif.gpsLongitude = readGpsCoordinate(reader, entry, gpsRefs[0x0003]);
      }
      return null;
    }

    switch (entry.tag) {
      case TAG.MAKE:
        exif.make = reader.ascii(dataOffset(reader, entry), entry.count);
        break;
      case TAG.MODEL:
        exif.model = reader.ascii(dataOffset(reader, entry), entry.count);
        break;
      case TAG.SOFTWARE:
        exif.software = reader.ascii(dataOffset(reader, entry), entry.count);
        break;
      case TAG.LENS_MODEL:
        exif.lensModel = reader.ascii(dataOffset(reader, entry), entry.count);
        break;
      case TAG.ARTIST:
        exif.artist = reader.ascii(dataOffset(reader, entry), entry.count);
        break;
      case TAG.COPYRIGHT:
        exif.copyright = reader.ascii(dataOffset(reader, entry), entry.count);
        break;
      case TAG.MODIFY_DATE:
        exif.modifyDate = reader.ascii(dataOffset(reader, entry), entry.count);
        break;
      case TAG.DATE_TIME_ORIGINAL:
        exif.dateTimeOriginal = reader.ascii(
          dataOffset(reader, entry),
          entry.count,
        );
        break;
      case TAG.DATE_TIME_DIGITIZED:
        exif.dateTimeDigitized = reader.ascii(
          dataOffset(reader, entry),
          entry.count,
        );
        break;
      case TAG.ORIENTATION:
        exif.orientation = readNumber(reader, entry);
        break;
      case TAG.PIXEL_X:
        exif.pixelXDimension = readNumber(reader, entry);
        break;
      case TAG.PIXEL_Y:
        exif.pixelYDimension = readNumber(reader, entry);
        break;
      case TAG.EXPOSURE_TIME:
        exif.exposureTime = readRationalString(reader, entry);
        break;
      case TAG.F_NUMBER:
        exif.fNumber = readRationalString(reader, entry);
        break;
      case TAG.ISO:
        exif.iso = readNumber(reader, entry);
        break;
      case TAG.FOCAL_LENGTH:
        exif.focalLength = readRationalString(reader, entry);
        break;
      case TAG.EXIF_IFD:
      case TAG.GPS_IFD:
        return entry.tag;
      default:
        break;
    }
    return null;
  };

  const ifd0 = readEntries(reader, buf, reader.u32(4));
  const nested: Array<{ offset: number; scope: 'exif' | 'gps' }> = [];

  for (const entry of ifd0.entries) {
    const pointer = applyEntry(entry, 'tiff');
    if (pointer === TAG.EXIF_IFD) {
      nested.push({ offset: reader.u32(entry.valueOffset), scope: 'exif' });
    } else if (pointer === TAG.GPS_IFD) {
      nested.push({ offset: reader.u32(entry.valueOffset), scope: 'gps' });
    }
  }

  for (const { offset, scope } of nested) {
    const ifd = readEntries(reader, buf, offset);
    for (const entry of ifd.entries) {
      applyEntry(entry, scope);
    }
  }

  // IFD1 holds the embedded thumbnail.
  if (ifd0.next > 0) {
    const ifd1 = readEntries(reader, buf, ifd0.next);
    let thumbOffset = 0;
    let thumbLength = 0;
    for (const entry of ifd1.entries) {
      exif.tagCount++;
      if (entry.tag === TAG.THUMB_OFFSET)
        thumbOffset = readNumber(reader, entry) || 0;
      if (entry.tag === TAG.THUMB_LENGTH)
        thumbLength = readNumber(reader, entry) || 0;
    }
    if (
      thumbOffset > 0 &&
      thumbLength > 0 &&
      thumbOffset + thumbLength <= buf.length
    ) {
      exif.thumbnail = buf.subarray(thumbOffset, thumbOffset + thumbLength);
    }
  }

  return exif;
}

/** EXIF timestamps use "YYYY:MM:DD HH:MM:SS" rather than ISO-8601. */
export function parseExifDate(value?: string): Date | null {
  if (!value) return null;
  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
    ),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
