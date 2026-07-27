import {
  computeDHash,
  decodeToGray,
  fingerprint,
  hammingDistance,
  hashBands,
  hashFromHex,
  hashToHex,
  resampleGray,
} from './perceptual-hash';
import { buildPng } from './__fixtures__/images';

/** A deterministic "carpet": banded field with a medallion. */
function carpetPixel(x: number, y: number): number {
  const band = Math.sin(x / 7) * 40 + Math.cos(y / 5) * 30;
  const medallion = Math.hypot(x - 32, y - 32) < 12 ? 70 : 0;
  return 120 + band + medallion;
}

describe('perceptual hashing', () => {
  const carpet = buildPng({ width: 64, height: 64, pixel: carpetPixel });

  it('decodes a PNG to greyscale at full resolution', () => {
    const gray = decodeToGray(carpet);

    expect(gray).not.toBeNull();
    expect(gray!.width).toBe(64);
    expect(gray!.height).toBe(64);
    expect(gray!.data[0]).toBe(Math.round(carpetPixel(0, 0)));
  });

  it('produces a stable fingerprint for identical bytes', () => {
    expect(fingerprint(carpet)).toEqual(
      fingerprint(buildPng({ width: 64, height: 64, pixel: carpetPixel })),
    );
  });

  it('survives a resize of the same image', () => {
    // Same subject at half scale — a re-uploaded copy should still match.
    const half = buildPng({
      width: 32,
      height: 32,
      pixel: (x, y) => carpetPixel(x * 2, y * 2),
    });

    const original = fingerprint(carpet)!;
    const resized = fingerprint(half)!;
    const distance = hammingDistance(
      hashFromHex(original.dhash),
      hashFromHex(resized.dhash),
    );

    expect(distance).toBeLessThanOrEqual(12);
  });

  it('separates a different carpet from the original', () => {
    const other = buildPng({
      width: 64,
      height: 64,
      pixel: (x, y) => 120 + Math.sin(y / 3) * 60 + (x % 16 < 8 ? 40 : -40),
    });

    const distance = hammingDistance(
      hashFromHex(fingerprint(carpet)!.dhash),
      hashFromHex(fingerprint(other)!.dhash),
    );

    expect(distance).toBeGreaterThan(12);
  });

  it('detects a locally painted-out region as a near-duplicate, not an identical image', () => {
    // The kind of edit a seller might make: a stain removed from one corner.
    const retouched = buildPng({
      width: 64,
      height: 64,
      pixel: (x, y) => (x > 48 && y > 48 ? 150 : carpetPixel(x, y)),
    });

    const distance = hammingDistance(
      hashFromHex(fingerprint(carpet)!.dhash),
      hashFromHex(fingerprint(retouched)!.dhash),
    );

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThanOrEqual(20);
  });

  it('round-trips hashes through hex', () => {
    const hash = hashFromHex('0f1e2d3c4b5a6978');
    expect(hashToHex(hash)).toBe('0f1e2d3c4b5a6978');
  });

  it('splits a hash into four 16-bit bands', () => {
    expect(hashBands(hashFromHex('0001000200030004'))).toEqual([1, 2, 3, 4]);
  });

  it('rejects formats it cannot decode', () => {
    expect(decodeToGray(Buffer.from('RIFF____WEBPVP8 ', 'latin1'))).toBeNull();
    expect(fingerprint(Buffer.alloc(64))).toBeNull();
  });

  describe('resampleGray', () => {
    it('box-filters down to the requested size', () => {
      const gray = decodeToGray(carpet)!;
      const small = resampleGray(gray, 8, 8);

      expect(small.width).toBe(8);
      expect(small.height).toBe(8);
      expect(small.data).toHaveLength(64);
    });

    it('keeps a uniform image uniform', () => {
      const flat = decodeToGray(
        buildPng({ width: 32, height: 32, pixel: () => 200 }),
      )!;
      const small = resampleGray(flat, 9, 8);

      expect([...small.data].every((value) => value === 200)).toBe(true);
      // A flat image has no gradients, so every dHash bit is zero.
      expect(computeDHash(flat)).toBe(0n);
    });
  });
});
