/**
 * Perceptual hashing for carpet photos.
 *
 * Two independent hashes are stored per photo:
 *   dHash — horizontal brightness gradients; cheap and robust to re-encoding.
 *   pHash — DCT low-frequency signature; robust to scaling and mild edits.
 *
 * They back three checks: the same photo submitted twice in one registration,
 * a photo already registered against a different carpet (theft / duplicate
 * registration), and the EXIF thumbnail disagreeing with the image it claims
 * to preview (a classic post-capture editing tell).
 */

import { GrayImage, decodeJpegDcLuma } from './jpeg-dc';
import { decodePngGray, isPng } from './png';
import { isJpeg } from './jpeg';

export interface PhotoFingerprint {
  dhash: string;
  phash: string;
  /** 16-bit slices of the dHash, indexed for candidate lookup in SQL. */
  bands: [number, number, number, number];
}

/** Box-filter resample to an arbitrary size. */
export function resampleGray(
  image: GrayImage,
  targetWidth: number,
  targetHeight: number,
): GrayImage {
  const data = new Uint8Array(targetWidth * targetHeight);
  const xRatio = image.width / targetWidth;
  const yRatio = image.height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    const srcY0 = Math.floor(y * yRatio);
    const srcY1 = Math.max(
      srcY0 + 1,
      Math.min(image.height, Math.ceil((y + 1) * yRatio)),
    );

    for (let x = 0; x < targetWidth; x++) {
      const srcX0 = Math.floor(x * xRatio);
      const srcX1 = Math.max(
        srcX0 + 1,
        Math.min(image.width, Math.ceil((x + 1) * xRatio)),
      );

      let sum = 0;
      let count = 0;
      for (let sy = srcY0; sy < srcY1; sy++) {
        for (let sx = srcX0; sx < srcX1; sx++) {
          sum += image.data[sy * image.width + sx];
          count++;
        }
      }
      data[y * targetWidth + x] = count ? Math.round(sum / count) : 0;
    }
  }

  return { width: targetWidth, height: targetHeight, data };
}

/** 64-bit difference hash: each bit compares a pixel with its right neighbour. */
export function computeDHash(image: GrayImage): bigint {
  const small = resampleGray(image, 9, 8);
  let hash = 0n;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = small.data[y * 9 + x];
      const right = small.data[y * 9 + x + 1];
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

const DCT_SIZE = 32;
const DCT_KEEP = 8;

/** Precomputed DCT-II basis for the 32x32 transform. */
const DCT_COSINES = (() => {
  const table = new Float64Array(DCT_SIZE * DCT_SIZE);
  for (let u = 0; u < DCT_SIZE; u++) {
    for (let x = 0; x < DCT_SIZE; x++) {
      table[u * DCT_SIZE + x] = Math.cos(
        ((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE),
      );
    }
  }
  return table;
})();

/** 64-bit DCT hash over the low-frequency 8x8 block, thresholded at the median. */
export function computePHash(image: GrayImage): bigint {
  const small = resampleGray(image, DCT_SIZE, DCT_SIZE);

  // Separable DCT: rows first, then columns.
  const rows = new Float64Array(DCT_SIZE * DCT_SIZE);
  for (let y = 0; y < DCT_SIZE; y++) {
    for (let u = 0; u < DCT_KEEP; u++) {
      let sum = 0;
      for (let x = 0; x < DCT_SIZE; x++) {
        sum += small.data[y * DCT_SIZE + x] * DCT_COSINES[u * DCT_SIZE + x];
      }
      rows[y * DCT_SIZE + u] = sum;
    }
  }

  const coefficients: number[] = [];
  for (let v = 0; v < DCT_KEEP; v++) {
    for (let u = 0; u < DCT_KEEP; u++) {
      let sum = 0;
      for (let y = 0; y < DCT_SIZE; y++) {
        sum += rows[y * DCT_SIZE + u] * DCT_COSINES[v * DCT_SIZE + y];
      }
      coefficients.push(sum);
    }
  }

  // The DC term encodes overall brightness only; exclude it from the median.
  const median = [...coefficients.slice(1)].sort((a, b) => a - b)[
    Math.floor((coefficients.length - 1) / 2)
  ];

  let hash = 0n;
  for (const coefficient of coefficients) {
    hash = (hash << 1n) | (coefficient > median ? 1n : 0n);
  }
  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;
  while (xor) {
    xor &= xor - 1n;
    distance++;
  }
  return distance;
}

export function hashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}

export function hashFromHex(hex: string): bigint {
  return BigInt(`0x${hex}`);
}

/** Split a 64-bit hash into four 16-bit bands for locality-sensitive lookup. */
export function hashBands(hash: bigint): [number, number, number, number] {
  return [
    Number((hash >> 48n) & 0xffffn),
    Number((hash >> 32n) & 0xffffn),
    Number((hash >> 16n) & 0xffffn),
    Number(hash & 0xffffn),
  ];
}

/** Decode any supported format to greyscale, or null when unsupported. */
export function decodeToGray(buf: Buffer): GrayImage | null {
  if (isJpeg(buf)) return decodeJpegDcLuma(buf);
  if (isPng(buf)) return decodePngGray(buf);
  return null;
}

export function fingerprint(buf: Buffer): PhotoFingerprint | null {
  const gray = decodeToGray(buf);
  if (!gray || gray.width < 8 || gray.height < 8) return null;

  const dhash = computeDHash(gray);
  return {
    dhash: hashToHex(dhash),
    phash: hashToHex(computePHash(gray)),
    bands: hashBands(dhash),
  };
}
