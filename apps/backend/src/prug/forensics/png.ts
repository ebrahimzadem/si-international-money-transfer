/**
 * PNG chunk reader and greyscale decoder.
 *
 * Node's zlib does the inflate, so decoding is just chunk parsing plus
 * scanline unfiltering. Interlaced (Adam7) images are rejected.
 */

import { inflateSync } from 'zlib';
import { GrayImage } from './jpeg-dc';

export interface PngStructure {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaced: boolean;
  /** tEXt/iTXt/zTXt keyword -> value; editors write "Software" here. */
  textChunks: Record<string, string>;
  /** Chunk types in file order. */
  chunkSequence: string[];
  /** caBX carries C2PA content credentials. */
  hasC2pa: boolean;
  /** eXIf chunk payload (a bare TIFF block) when present. */
  exifChunk: Buffer | null;
  trailingBytes: number;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function isPng(buf: Buffer): boolean {
  return buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

interface Chunk {
  type: string;
  data: Buffer;
}

function readChunks(buf: Buffer): { chunks: Chunk[]; trailingBytes: number } {
  const chunks: Chunk[] = [];
  let offset = 8;

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const start = offset + 8;
    if (length > buf.length || start + length + 4 > buf.length) break;

    chunks.push({ type, data: buf.subarray(start, start + length) });
    offset = start + length + 4; // payload + CRC

    if (type === 'IEND') break;
  }

  return { chunks, trailingBytes: Math.max(0, buf.length - offset) };
}

export function parsePng(buf: Buffer): PngStructure | null {
  if (!isPng(buf)) return null;

  const { chunks, trailingBytes } = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr || ihdr.data.length < 13) return null;

  const structure: PngStructure = {
    width: ihdr.data.readUInt32BE(0),
    height: ihdr.data.readUInt32BE(4),
    bitDepth: ihdr.data[8],
    colorType: ihdr.data[9],
    interlaced: ihdr.data[12] !== 0,
    textChunks: {},
    chunkSequence: chunks.map((c) => c.type),
    hasC2pa: false,
    exifChunk: null,
    trailingBytes,
  };

  for (const chunk of chunks) {
    switch (chunk.type) {
      case 'tEXt': {
        const split = chunk.data.indexOf(0);
        if (split > 0) {
          structure.textChunks[chunk.data.toString('latin1', 0, split)] =
            chunk.data.toString('latin1', split + 1).trim();
        }
        break;
      }
      case 'iTXt': {
        const split = chunk.data.indexOf(0);
        if (split > 0) {
          const keyword = chunk.data.toString('latin1', 0, split);
          // keyword \0 compressionFlag compressionMethod language \0 translated \0 text
          const rest = chunk.data.subarray(split + 3);
          const langEnd = rest.indexOf(0);
          const translatedEnd =
            langEnd >= 0 ? rest.indexOf(0, langEnd + 1) : -1;
          if (translatedEnd >= 0) {
            structure.textChunks[keyword] = rest
              .subarray(translatedEnd + 1)
              .toString('utf8')
              .trim();
          }
        }
        break;
      }
      case 'zTXt': {
        const split = chunk.data.indexOf(0);
        if (split > 0) {
          const keyword = chunk.data.toString('latin1', 0, split);
          try {
            structure.textChunks[keyword] = inflateSync(
              chunk.data.subarray(split + 2),
            )
              .toString('latin1')
              .trim();
          } catch {
            // Unreadable compressed text is not itself a fraud signal.
          }
        }
        break;
      }
      case 'caBX':
        structure.hasC2pa = true;
        break;
      case 'eXIf':
        structure.exifChunk = chunk.data;
        break;
      default:
        break;
    }
  }

  return structure.width > 0 && structure.height > 0 ? structure : null;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decode a PNG to 8-bit greyscale. Supports non-interlaced images with bit
 * depth 8 or 16 (greyscale, RGB, palette, and their alpha variants).
 */
export function decodePngGray(buf: Buffer): GrayImage | null {
  const structure = parsePng(buf);
  if (!structure || structure.interlaced) return null;
  if (structure.bitDepth !== 8 && structure.bitDepth !== 16) return null;

  const { width, height, colorType, bitDepth } = structure;
  if (width * height > 80_000_000) return null;

  const { chunks } = readChunks(buf);
  const idat = chunks.filter((c) => c.type === 'IDAT').map((c) => c.data);
  if (!idat.length) return null;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const channelCount: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelCount[colorType];
  if (!channels) return null;

  const bytesPerSample = bitDepth === 16 ? 2 : 1;
  const bytesPerPixel = channels * bytesPerSample;
  const stride = width * bytesPerPixel;
  if (raw.length < (stride + 1) * height) return null;

  let palette: Buffer | null = null;
  if (colorType === 3) {
    const plte = chunks.find((c) => c.type === 'PLTE');
    if (!plte) return null;
    palette = plte.data;
  }

  const pixels = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const lineStart = y * (stride + 1) + 1;
    const outStart = y * stride;
    const prevStart = outStart - stride;

    for (let x = 0; x < stride; x++) {
      const value = raw[lineStart + x];
      const left =
        x >= bytesPerPixel ? pixels[outStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel ? pixels[prevStart + x - bytesPerPixel] : 0;

      let restored: number;
      switch (filter) {
        case 0:
          restored = value;
          break;
        case 1:
          restored = value + left;
          break;
        case 2:
          restored = value + up;
          break;
        case 3:
          restored = value + ((left + up) >> 1);
          break;
        case 4:
          restored = value + paeth(left, up, upLeft);
          break;
        default:
          return null;
      }
      pixels[outStart + x] = restored & 0xff;
    }
  }

  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * stride + x * bytesPerPixel;
      let gray: number;

      if (colorType === 3 && palette) {
        const index = pixels[at] * 3;
        gray =
          index + 2 < palette.length
            ? (palette[index] * 299 +
                palette[index + 1] * 587 +
                palette[index + 2] * 114) /
              1000
            : 0;
      } else if (colorType === 0 || colorType === 4) {
        gray = pixels[at];
      } else {
        const r = pixels[at];
        const g = pixels[at + bytesPerSample];
        const b = pixels[at + bytesPerSample * 2];
        gray = (r * 299 + g * 587 + b * 114) / 1000;
      }

      data[y * width + x] = Math.max(0, Math.min(255, Math.round(gray)));
    }
  }

  return { width, height, data };
}
