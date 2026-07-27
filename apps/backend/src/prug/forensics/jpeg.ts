/**
 * JPEG container walker.
 *
 * Reads the marker segments an edited file leaves fingerprints in — EXIF,
 * XMP, the Photoshop image resource block, the Adobe APP14 marker, C2PA
 * provenance boxes, quantisation tables and the frame header.
 */

import { ExifData, parseExif } from './exif';

export interface JpegComponent {
  id: number;
  horizontalSampling: number;
  verticalSampling: number;
  quantTableId: number;
}

export interface JpegStructure {
  width: number;
  height: number;
  precision: number;
  progressive: boolean;
  components: JpegComponent[];
  /** Marker names in file order, e.g. ['SOI','APP0','DQT',...]. */
  markerSequence: string[];
  hasJfif: boolean;
  /** APP14 "Adobe" marker — written by Adobe encoders. */
  hasAdobeApp14: boolean;
  /** APP13 Photoshop 3.0 image resource block. */
  hasPhotoshopIrb: boolean;
  /** APP11 JUMBF box carrying C2PA content credentials. */
  hasC2pa: boolean;
  exif: ExifData | null;
  xmp: string | null;
  comments: string[];
  /** Estimated IJG quality per quantisation table (0-100). */
  quantQuality: number[];
  /** Bytes after the EOI marker — common in doctored or appended files. */
  trailingBytes: number;
  /** True when no EOI marker was found at all. */
  truncated: boolean;
}

const MARKER_NAMES: Record<number, string> = {
  0xd8: 'SOI',
  0xd9: 'EOI',
  0xda: 'SOS',
  0xdb: 'DQT',
  0xc4: 'DHT',
  0xdd: 'DRI',
  0xc0: 'SOF0',
  0xc1: 'SOF1',
  0xc2: 'SOF2',
  0xc3: 'SOF3',
  0xc9: 'SOF9',
  0xca: 'SOF10',
  0xfe: 'COM',
};

function markerName(marker: number): string {
  if (marker >= 0xe0 && marker <= 0xef) return `APP${marker - 0xe0}`;
  if (marker >= 0xd0 && marker <= 0xd7) return `RST${marker - 0xd0}`;
  return MARKER_NAMES[marker] || `M${marker.toString(16).toUpperCase()}`;
}

/**
 * The standard JPEG luminance table at quality 50. Ratios against an observed
 * table give a usable estimate of the encoder's quality setting.
 */
const STD_LUMA_Q50 = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16,
  24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109,
  103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];

/** Invert the IJG scaling formula to recover the quality a table was built at. */
function estimateQuality(table: number[]): number {
  let scaleSum = 0;
  let counted = 0;
  for (let i = 0; i < 64 && i < table.length; i++) {
    const std = STD_LUMA_Q50[i];
    if (!std || !table[i]) continue;
    scaleSum += (table[i] * 100) / std;
    counted++;
  }
  if (!counted) return 0;

  const scale = scaleSum / counted;
  const quality = scale <= 100 ? 100 - scale / 2 : 5000 / scale;
  return Math.max(0, Math.min(100, Math.round(quality)));
}

export function isJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;
}

export function parseJpeg(buf: Buffer): JpegStructure | null {
  if (!isJpeg(buf)) return null;

  const structure: JpegStructure = {
    width: 0,
    height: 0,
    precision: 8,
    progressive: false,
    components: [],
    markerSequence: ['SOI'],
    hasJfif: false,
    hasAdobeApp14: false,
    hasPhotoshopIrb: false,
    hasC2pa: false,
    exif: null,
    xmp: null,
    comments: [],
    quantQuality: [],
    trailingBytes: 0,
    truncated: true,
  };

  let offset = 2;

  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buf[offset + 1];
    offset += 2;

    // Padding and standalone markers carry no length field.
    if (marker === 0xff || marker === 0x00) continue;
    if (marker === 0xd9) {
      structure.markerSequence.push('EOI');
      structure.truncated = false;
      structure.trailingBytes = Math.max(0, buf.length - offset);
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) continue;

    if (offset + 2 > buf.length) break;
    const length = buf.readUInt16BE(offset);
    if (length < 2 || offset + length > buf.length) break;

    const payload = buf.subarray(offset + 2, offset + length);
    structure.markerSequence.push(markerName(marker));

    switch (marker) {
      case 0xe0: // APP0
        if (payload.toString('latin1', 0, 4) === 'JFIF')
          structure.hasJfif = true;
        break;

      case 0xe1: {
        // APP1 — EXIF or XMP
        const header = payload.toString('latin1', 0, 6);
        if (header === 'Exif\0\0') {
          structure.exif = parseExif(payload.subarray(6));
        } else if (
          payload
            .toString('latin1', 0, 28)
            .startsWith('http://ns.adobe.com/xap/1.0/')
        ) {
          structure.xmp = payload.subarray(29).toString('utf8');
        }
        break;
      }

      case 0xeb: // APP11 — JUMBF / C2PA content credentials
        if (
          payload.toString('latin1', 0, 2) === 'JP' ||
          payload.includes(Buffer.from('c2pa'))
        ) {
          structure.hasC2pa = true;
        }
        break;

      case 0xed: // APP13 — Photoshop image resource block
        if (payload.toString('latin1', 0, 9) === 'Photoshop')
          structure.hasPhotoshopIrb = true;
        break;

      case 0xee: // APP14 — Adobe colour transform marker
        if (payload.toString('latin1', 0, 5) === 'Adobe')
          structure.hasAdobeApp14 = true;
        break;

      case 0xdb: {
        // DQT — one or more quantisation tables
        let at = 0;
        while (at < payload.length) {
          const precision = payload[at] >> 4;
          at += 1;
          const size = precision === 0 ? 64 : 128;
          if (at + size > payload.length) break;
          const table: number[] = [];
          for (let i = 0; i < 64; i++) {
            table.push(
              precision === 0
                ? payload[at + i]
                : payload.readUInt16BE(at + i * 2),
            );
          }
          structure.quantQuality.push(estimateQuality(table));
          at += size;
        }
        break;
      }

      case 0xc0:
      case 0xc1:
      case 0xc2:
      case 0xc3:
      case 0xc9:
      case 0xca: {
        // SOF — frame header
        structure.progressive = marker === 0xc2 || marker === 0xca;
        structure.precision = payload[0];
        structure.height = payload.readUInt16BE(1);
        structure.width = payload.readUInt16BE(3);
        const componentCount = payload[5];
        for (let i = 0; i < componentCount; i++) {
          const at = 6 + i * 3;
          if (at + 2 >= payload.length) break;
          structure.components.push({
            id: payload[at],
            horizontalSampling: payload[at + 1] >> 4,
            verticalSampling: payload[at + 1] & 0x0f,
            quantTableId: payload[at + 2],
          });
        }
        break;
      }

      case 0xfe:
        structure.comments.push(payload.toString('latin1').replace(/\0+$/, ''));
        break;

      default:
        break;
    }

    offset += length;

    // Entropy-coded data follows SOS; skip to the next real marker.
    if (marker === 0xda) {
      while (offset < buf.length - 1) {
        if (
          buf[offset] === 0xff &&
          buf[offset + 1] !== 0x00 &&
          !(buf[offset + 1] >= 0xd0 && buf[offset + 1] <= 0xd7)
        ) {
          break;
        }
        offset++;
      }
    }
  }

  return structure.width > 0 ? structure : null;
}
