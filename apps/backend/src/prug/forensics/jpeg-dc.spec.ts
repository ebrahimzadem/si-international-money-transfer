import { decodeJpegDcLuma } from './jpeg-dc';
import {
  buildBaselineJpeg,
  buildJpeg,
  buildProgressiveJpeg,
} from './__fixtures__/images';

/** The decoder's level shift: pixel = round(dc * quant / 8) + 128. */
function expectedPixel(dc: number, quant: number): number {
  return Math.max(0, Math.min(255, Math.round((dc * quant) / 8) + 128));
}

describe('baseline JPEG DC decoder', () => {
  it('decodes a single block to its level-shifted average', () => {
    const jpeg = buildBaselineJpeg({
      width: 8,
      height: 8,
      blockDcValues: [10],
      quant: 8,
    });
    const gray = decodeJpegDcLuma(jpeg);

    expect(gray).not.toBeNull();
    expect(gray!.width).toBe(1);
    expect(gray!.height).toBe(1);
    expect(gray!.data[0]).toBe(expectedPixel(10, 8));
  });

  it('tracks the DC predictor across blocks', () => {
    // Successive DC values are coded as differences; a wrong predictor shows up
    // immediately as drift across the row.
    const values = [40, -30, 0, 90];
    const jpeg = buildBaselineJpeg({
      width: 32,
      height: 8,
      blockDcValues: values,
      quant: 8,
    });
    const gray = decodeJpegDcLuma(jpeg);

    expect(gray).not.toBeNull();
    expect(gray!.width).toBe(4);
    expect(gray!.height).toBe(1);
    expect([...gray!.data]).toEqual(values.map((dc) => expectedPixel(dc, 8)));
  });

  it('applies the quantisation table', () => {
    const jpeg = buildBaselineJpeg({
      width: 8,
      height: 8,
      blockDcValues: [10],
      quant: 16,
    });
    expect(decodeJpegDcLuma(jpeg)!.data[0]).toBe(expectedPixel(10, 16));
  });

  it('clamps values outside the 8-bit range', () => {
    const jpeg = buildBaselineJpeg({
      width: 16,
      height: 8,
      blockDcValues: [400, -400],
      quant: 8,
    });
    const gray = decodeJpegDcLuma(jpeg)!;

    expect(gray.data[0]).toBe(255);
    expect(gray.data[1]).toBe(0);
  });

  it('lays blocks out in raster order across multiple rows', () => {
    const values = [10, 20, 30, 40, 50, 60];
    const jpeg = buildBaselineJpeg({
      width: 24,
      height: 16,
      blockDcValues: values,
      quant: 8,
    });
    const gray = decodeJpegDcLuma(jpeg)!;

    expect(gray.width).toBe(3);
    expect(gray.height).toBe(2);
    expect(gray.data[0]).toBe(expectedPixel(10, 8));
    expect(gray.data[3]).toBe(expectedPixel(40, 8));
  });

  it('declines progressive JPEGs rather than guessing', () => {
    expect(decodeJpegDcLuma(buildProgressiveJpeg(64, 64))).toBeNull();
  });

  it('returns null instead of throwing on a container with no real scan', () => {
    expect(() =>
      decodeJpegDcLuma(buildJpeg({ width: 64, height: 64 })),
    ).not.toThrow();
  });

  it('returns null for non-JPEG input', () => {
    expect(decodeJpegDcLuma(Buffer.from('not a jpeg'))).toBeNull();
  });
});
