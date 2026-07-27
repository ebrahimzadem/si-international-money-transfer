import { inspectPhoto } from './image-metadata';
import { parseExif, parseExifDate } from './exif';
import { parseJpeg } from './jpeg';
import { buildExifBlock, buildJpeg, buildPng } from './__fixtures__/images';

function codes(findings: Array<{ code: string }>): string[] {
  return findings.map((finding) => finding.code);
}

describe('EXIF parsing', () => {
  it('reads camera identity and timestamps from IFD0 and the Exif sub-IFD', () => {
    const exif = parseExif(
      buildExifBlock({
        make: 'Apple',
        model: 'iPhone 15 Pro',
        dateTimeOriginal: '2026:03:14 09:30:00',
        pixelXDimension: 4032,
        pixelYDimension: 3024,
      }),
    );

    expect(exif).not.toBeNull();
    expect(exif!.make).toBe('Apple');
    expect(exif!.model).toBe('iPhone 15 Pro');
    expect(exif!.dateTimeOriginal).toBe('2026:03:14 09:30:00');
    expect(exif!.pixelXDimension).toBe(4032);
    expect(exif!.pixelYDimension).toBe(3024);
  });

  it('rejects a block without a TIFF header', () => {
    expect(parseExif(Buffer.from('not exif at all'))).toBeNull();
  });

  it('parses the colon-separated EXIF date format', () => {
    expect(parseExifDate('2026:03:14 09:30:00')?.toISOString()).toBe(
      '2026-03-14T09:30:00.000Z',
    );
    expect(parseExifDate('not a date')).toBeNull();
    expect(parseExifDate(undefined)).toBeNull();
  });
});

describe('JPEG structure', () => {
  it('reads dimensions, markers and estimated quality', () => {
    const jpeg = parseJpeg(
      buildJpeg({ width: 1600, height: 1200, adobeApp14: true }),
    );

    expect(jpeg).not.toBeNull();
    expect(jpeg!.width).toBe(1600);
    expect(jpeg!.height).toBe(1200);
    expect(jpeg!.hasJfif).toBe(true);
    expect(jpeg!.hasAdobeApp14).toBe(true);
    expect(jpeg!.truncated).toBe(false);
    // The fixture uses the standard quality-50 table.
    expect(jpeg!.quantQuality[0]).toBe(50);
  });
});

describe('photo inspection', () => {
  const cameraExif = {
    make: 'Apple',
    model: 'iPhone 15 Pro',
    dateTimeOriginal: '2026:03:14 09:30:00',
    pixelXDimension: 1600,
    pixelYDimension: 1200,
  };

  it('accepts a straight-from-camera photo without editing findings', () => {
    const inspection = inspectPhoto(
      buildJpeg({ width: 1600, height: 1200, exif: cameraExif }),
    );

    expect(inspection).not.toBeNull();
    expect(inspection!.metadata.cameraMake).toBe('Apple');
    expect(inspection!.metadata.hasExif).toBe(true);
    expect(codes(inspection!.findings)).not.toContain('editor_software');
    expect(codes(inspection!.findings)).not.toContain('no_exif');
  });

  it('flags a file written by Photoshop', () => {
    const inspection = inspectPhoto(
      buildJpeg({
        width: 1600,
        height: 1200,
        exif: { ...cameraExif, software: 'Adobe Photoshop 25.5 (Macintosh)' },
      }),
    );

    const finding = inspection!.findings.find(
      (entry) => entry.code === 'editor_software',
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags an XMP edit history', () => {
    const inspection = inspectPhoto(
      buildJpeg({
        width: 1600,
        height: 1200,
        exif: cameraExif,
        xmpHistory: true,
      }),
    );

    expect(codes(inspection!.findings)).toContain('xmp_edit_history');
  });

  it('rejects generative-image markers outright', () => {
    const inspection = inspectPhoto(
      buildJpeg({
        width: 1600,
        height: 1200,
        xmp: '<x:xmpmeta><dc:creator>Midjourney v7</dc:creator></x:xmpmeta>',
      }),
    );

    const finding = inspection!.findings.find(
      (entry) => entry.code === 'ai_generated_marker',
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
    expect(finding!.weight).toBe(100);
    expect(inspection!.metadata.markers.aiGenerator).toBe('Midjourney');
  });

  it('flags a crop by comparing EXIF dimensions with the frame', () => {
    const inspection = inspectPhoto(
      buildJpeg({
        width: 1200,
        height: 900,
        exif: { ...cameraExif, pixelXDimension: 4032, pixelYDimension: 3024 },
      }),
    );

    const finding = inspection!.findings.find(
      (entry) => entry.code === 'dimension_mismatch',
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does not flag an orientation swap as a crop', () => {
    // Portrait EXIF against a landscape frame with the same pixel count.
    const inspection = inspectPhoto(
      buildJpeg({
        width: 1600,
        height: 1200,
        exif: { ...cameraExif, pixelXDimension: 1200, pixelYDimension: 1600 },
      }),
    );

    expect(codes(inspection!.findings)).not.toContain('dimension_mismatch');
  });

  it('flags a long gap between capture and last write', () => {
    const inspection = inspectPhoto(
      buildJpeg({
        width: 1600,
        height: 1200,
        exif: { ...cameraExif, modifyDate: '2026:03:20 11:00:00' },
      }),
    );

    const finding = inspection!.findings.find(
      (entry) => entry.code === 'post_capture_modification',
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags a stripped-metadata photo', () => {
    const inspection = inspectPhoto(buildJpeg({ width: 1600, height: 1200 }));
    expect(codes(inspection!.findings)).toContain('no_exif');
  });

  it('treats PNG uploads as a screenshot signal and fingerprints them', () => {
    const inspection = inspectPhoto(
      buildPng({
        width: 1200,
        height: 900,
        pixel: (x, y) => (x + y) % 200,
        text: { Software: 'GIMP 2.10' },
      }),
    );

    expect(codes(inspection!.findings)).toContain('png_source');
    expect(codes(inspection!.findings)).toContain('editor_software');
    expect(inspection!.metadata.fingerprint).not.toBeNull();
  });

  it('applies a higher resolution bar to macro shots', () => {
    const photo = buildPng({ width: 1200, height: 900, pixel: () => 128 });

    expect(
      codes(inspectPhoto(photo, { isMacro: false })!.findings),
    ).not.toContain('low_resolution');
    expect(codes(inspectPhoto(photo, { isMacro: true })!.findings)).toContain(
      'low_resolution',
    );
  });

  it('returns null for formats it cannot verify', () => {
    expect(inspectPhoto(Buffer.from('RIFF____WEBPVP8 ', 'latin1'))).toBeNull();
  });
});
