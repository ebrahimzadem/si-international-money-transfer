/**
 * Baseline JPEG DC-only decoder.
 *
 * Full decoding is unnecessary for fingerprinting: the DC coefficient of each
 * 8x8 luma block is that block's average brightness, so entropy-decoding the
 * scan and skipping the IDCT yields a 1/8-scale greyscale image — exactly the
 * input a perceptual hash needs, at a fraction of the work and with no native
 * image dependency.
 *
 * Progressive JPEGs (SOF2) are not supported and return null; callers treat a
 * missing fingerprint as "cannot verify" rather than "clean".
 */

export interface GrayImage {
  width: number;
  height: number;
  /** Row-major 8-bit luminance. */
  data: Uint8Array;
}

interface HuffmanTable {
  /** Smallest code of each length (1-16), indexed by length. */
  minCode: Int32Array;
  maxCode: Int32Array;
  /** Index into `values` of the first symbol of each length. */
  valPtr: Int32Array;
  values: Uint8Array;
}

function buildHuffmanTable(
  counts: Uint8Array,
  values: Uint8Array,
): HuffmanTable {
  const minCode = new Int32Array(17);
  const maxCode = new Int32Array(17).fill(-1);
  const valPtr = new Int32Array(17);

  let code = 0;
  let k = 0;
  for (let length = 1; length <= 16; length++) {
    if (counts[length - 1] === 0) {
      maxCode[length] = -1;
      code <<= 1;
      continue;
    }
    valPtr[length] = k;
    minCode[length] = code;
    code += counts[length - 1];
    k += counts[length - 1];
    maxCode[length] = code - 1;
    code <<= 1;
  }

  return { minCode, maxCode, valPtr, values };
}

/** Bit reader over entropy-coded data: unstuffs 0xFF00 and stops at markers. */
class BitReader {
  private bitBuffer = 0;
  private bitCount = 0;

  constructor(
    private readonly buf: Buffer,
    public offset: number,
  ) {}

  readBit(): number {
    if (this.bitCount === 0) {
      if (this.offset >= this.buf.length) return 0;
      const byte = this.buf[this.offset++];
      if (byte === 0xff) {
        const next = this.buf[this.offset];
        if (next === 0x00) {
          this.offset++; // byte stuffing
        } else {
          // A real marker: rewind so the caller can inspect it.
          this.offset--;
          return 0;
        }
      }
      this.bitBuffer = byte;
      this.bitCount = 8;
    }
    this.bitCount--;
    return (this.bitBuffer >> this.bitCount) & 1;
  }

  receive(bits: number): number {
    let value = 0;
    for (let i = 0; i < bits; i++) {
      value = (value << 1) | this.readBit();
    }
    return value;
  }

  /** Drop buffered bits so the stream is byte-aligned (used before RSTn). */
  align(): void {
    this.bitCount = 0;
  }

  skipRestartMarker(): boolean {
    this.align();
    while (this.offset < this.buf.length - 1) {
      if (this.buf[this.offset] === 0xff) {
        const marker = this.buf[this.offset + 1];
        if (marker >= 0xd0 && marker <= 0xd7) {
          this.offset += 2;
          return true;
        }
        return false;
      }
      this.offset++;
    }
    return false;
  }
}

function decodeHuffman(reader: BitReader, table: HuffmanTable): number {
  let code = reader.readBit();
  let length = 1;

  while (length <= 16) {
    if (
      table.maxCode[length] >= 0 &&
      code <= table.maxCode[length] &&
      code >= table.minCode[length]
    ) {
      const index = table.valPtr[length] + code - table.minCode[length];
      return index < table.values.length ? table.values[index] : 0;
    }
    code = (code << 1) | reader.readBit();
    length++;
  }
  return 0;
}

/** Sign-extend a `bits`-wide magnitude per the JPEG EXTEND procedure. */
function extend(value: number, bits: number): number {
  if (bits === 0) return 0;
  return value < 1 << (bits - 1) ? value - (1 << bits) + 1 : value;
}

interface Frame {
  width: number;
  height: number;
  components: Array<{ id: number; h: number; v: number; tq: number }>;
  maxH: number;
  maxV: number;
}

/**
 * Decode the luma DC plane of a baseline JPEG.
 * Returns a greyscale image at 1/8 the source resolution, or null when the
 * file is progressive, arithmetic-coded, truncated, or otherwise unsupported.
 */
export function decodeJpegDcLuma(buf: Buffer): GrayImage | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  const quantTables: Record<number, Uint16Array> = {};
  const dcTables: Record<number, HuffmanTable> = {};
  const acTables: Record<number, HuffmanTable> = {};
  let frame: Frame | null = null;
  let restartInterval = 0;
  let offset = 2;

  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    offset += 2;

    if (marker === 0xff || marker === 0x00 || marker === 0xd9) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buf.length) return null;

    const length = buf.readUInt16BE(offset);
    if (length < 2 || offset + length > buf.length) return null;
    const payload = buf.subarray(offset + 2, offset + length);

    switch (marker) {
      case 0xdb: {
        let at = 0;
        while (at < payload.length) {
          const precision = payload[at] >> 4;
          const id = payload[at] & 0x0f;
          at += 1;
          const table = new Uint16Array(64);
          for (let i = 0; i < 64; i++) {
            table[i] =
              precision === 0
                ? payload[at + i]
                : payload.readUInt16BE(at + i * 2);
          }
          quantTables[id] = table;
          at += precision === 0 ? 64 : 128;
        }
        break;
      }

      case 0xc4: {
        let at = 0;
        while (at + 17 <= payload.length) {
          const cls = payload[at] >> 4;
          const id = payload[at] & 0x0f;
          const counts = new Uint8Array(payload.subarray(at + 1, at + 17));
          let total = 0;
          for (const c of counts) total += c;
          const values = new Uint8Array(
            payload.subarray(at + 17, at + 17 + total),
          );
          const table = buildHuffmanTable(counts, values);
          if (cls === 0) dcTables[id] = table;
          else acTables[id] = table;
          at += 17 + total;
        }
        break;
      }

      case 0xdd:
        restartInterval = payload.readUInt16BE(0);
        break;

      case 0xc0:
      case 0xc1: {
        const height = payload.readUInt16BE(1);
        const width = payload.readUInt16BE(3);
        const count = payload[5];
        const components: Frame['components'] = [];
        let maxH = 1;
        let maxV = 1;
        for (let i = 0; i < count; i++) {
          const at = 6 + i * 3;
          const h = payload[at + 1] >> 4;
          const v = payload[at + 1] & 0x0f;
          components.push({ id: payload[at], h, v, tq: payload[at + 2] });
          maxH = Math.max(maxH, h);
          maxV = Math.max(maxV, v);
        }
        frame = { width, height, components, maxH, maxV };
        break;
      }

      // Progressive, arithmetic, lossless and hierarchical frames.
      case 0xc2:
      case 0xc3:
      case 0xc5:
      case 0xc6:
      case 0xc7:
      case 0xc9:
      case 0xca:
      case 0xcb:
      case 0xcd:
      case 0xce:
      case 0xcf:
        return null;

      case 0xda: {
        if (!frame || frame.width === 0 || frame.height === 0) return null;

        const scanCount = payload[0];
        const scanComponents: Array<{ index: number; dc: number; ac: number }> =
          [];
        for (let i = 0; i < scanCount; i++) {
          const id = payload[1 + i * 2];
          const tables = payload[2 + i * 2];
          const index = frame.components.findIndex((c) => c.id === id);
          if (index < 0) return null;
          scanComponents.push({ index, dc: tables >> 4, ac: tables & 0x0f });
        }
        // Only a full interleaved scan gives us every block in one pass.
        if (scanComponents.length !== frame.components.length) return null;

        return decodeScan(
          buf,
          offset + length,
          frame,
          scanComponents,
          quantTables,
          dcTables,
          acTables,
          restartInterval,
        );
      }

      default:
        break;
    }

    offset += length;
  }

  return null;
}

function decodeScan(
  buf: Buffer,
  scanStart: number,
  frame: Frame,
  scanComponents: Array<{ index: number; dc: number; ac: number }>,
  quantTables: Record<number, Uint16Array>,
  dcTables: Record<number, HuffmanTable>,
  acTables: Record<number, HuffmanTable>,
  restartInterval: number,
): GrayImage | null {
  const luma = frame.components[0];
  const lumaQuant = quantTables[luma.tq];
  if (!lumaQuant) return null;

  const mcusPerLine = Math.ceil(frame.width / (8 * frame.maxH));
  const mcusPerColumn = Math.ceil(frame.height / (8 * frame.maxV));
  const blocksPerLine = mcusPerLine * luma.h;
  const blocksPerColumn = mcusPerColumn * luma.v;

  // Guard against absurd allocations from a malformed header.
  if (blocksPerLine * blocksPerColumn > 8_000_000) return null;

  const plane = new Int32Array(blocksPerLine * blocksPerColumn);
  const predictors = new Int32Array(frame.components.length);
  const reader = new BitReader(buf, scanStart);

  const dcQuant = lumaQuant[0] || 1;
  let mcu = 0;
  const totalMcus = mcusPerLine * mcusPerColumn;

  while (mcu < totalMcus) {
    if (restartInterval > 0 && mcu > 0 && mcu % restartInterval === 0) {
      predictors.fill(0);
      if (!reader.skipRestartMarker()) break;
    }

    const mcuX = mcu % mcusPerLine;
    const mcuY = Math.floor(mcu / mcusPerLine);

    for (const scanComponent of scanComponents) {
      const component = frame.components[scanComponent.index];
      const dcTable = dcTables[scanComponent.dc];
      const acTable = acTables[scanComponent.ac];
      if (!dcTable || !acTable) return null;

      for (let by = 0; by < component.v; by++) {
        for (let bx = 0; bx < component.h; bx++) {
          const t = decodeHuffman(reader, dcTable);
          const diff = t === 0 ? 0 : extend(reader.receive(t), t);
          predictors[scanComponent.index] += diff;

          if (scanComponent.index === 0) {
            const blockX = mcuX * component.h + bx;
            const blockY = mcuY * component.v + by;
            plane[blockY * blocksPerLine + blockX] = predictors[0];
          }

          // AC coefficients are discarded, but must be consumed to stay in sync.
          let k = 1;
          while (k < 64) {
            const rs = decodeHuffman(reader, acTable);
            const size = rs & 0x0f;
            const run = rs >> 4;
            if (size === 0) {
              if (run === 15) {
                k += 16;
                continue;
              }
              break;
            }
            k += run;
            if (k > 63) break;
            reader.receive(size);
            k++;
          }
        }
      }

      if (reader.offset > buf.length) return null;
    }

    mcu++;
  }

  const width = Math.max(
    1,
    Math.ceil(frame.width / (8 * (frame.maxH / luma.h))),
  );
  const height = Math.max(
    1,
    Math.ceil(frame.height / (8 * (frame.maxV / luma.v))),
  );
  const data = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dc =
        plane[
          Math.min(y, blocksPerColumn - 1) * blocksPerLine +
            Math.min(x, blocksPerLine - 1)
        ];
      // Level-shifted block average: DC * q / 8 + 128.
      const value = Math.round((dc * dcQuant) / 8) + 128;
      data[y * width + x] = value < 0 ? 0 : value > 255 ? 255 : value;
    }
  }

  return { width, height, data };
}
