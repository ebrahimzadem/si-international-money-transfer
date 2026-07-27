import {
  buildCertificateNumber,
  buildDocumentHash,
  buildProfileSlug,
  isValidCertificateNumber,
} from './certificate';
import { CarpetIdentity } from '../prug.types';

const CARPET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const IDENTITY: CarpetIdentity = {
  originCountry: 'Iran',
  originRegion: 'Tabriz',
  designFamily: 'medallion-and-corner',
  motifs: ['herati', 'boteh'],
  knotType: 'Persian asymmetric',
  estimatedKnotDensity: '40-45 raj',
  pileMaterial: 'wool',
  warpMaterial: 'cotton',
  weftMaterial: 'cotton',
  dyeAssessment: 'mixed natural and synthetic',
  estimatedAgeRange: '1960-1980',
  dominantColors: ['madder red', 'indigo'],
  estimatedDimensions: '300 x 200 cm',
  condition: 'good, even pile wear',
  defects: ['small reweave at one end'],
  distinguishingMarks: ['abrash band at 40 cm'],
  summaryEn: 'A Tabriz medallion carpet.',
  summaryFa: 'یک فرش ترنجی تبریز.',
  confidence: 0.82,
  declarationConflicts: [],
};

const PHOTOS = [
  { id: 'p1', sha256: 'a'.repeat(64), shotType: 'full_front' as const },
  { id: 'p2', sha256: 'b'.repeat(64), shotType: 'full_back' as const },
];

describe('certificate numbers', () => {
  it('is deterministic for a carpet', () => {
    expect(buildCertificateNumber(CARPET_ID)).toBe(
      buildCertificateNumber(CARPET_ID),
    );
  });

  it('differs between carpets', () => {
    expect(buildCertificateNumber(CARPET_ID)).not.toBe(
      buildCertificateNumber('other-carpet-id'),
    );
  });

  it('matches the printed format', () => {
    expect(buildCertificateNumber(CARPET_ID)).toMatch(
      /^PRUG-[0-9A-HJKMNP-TV-Z]{8}-\d{3}$/,
    );
  });

  it('validates its own checksum', () => {
    expect(isValidCertificateNumber(buildCertificateNumber(CARPET_ID))).toBe(
      true,
    );
  });

  it('rejects a mistyped serial', () => {
    const number = buildCertificateNumber(CARPET_ID);
    const body = number.slice(5, 13);
    const swapped = `PRUG-${body[1]}${body[0]}${body.slice(2)}-${number.slice(-3)}`;

    // A transposition is only caught when it actually changes the body.
    if (body[0] !== body[1]) {
      expect(isValidCertificateNumber(swapped)).toBe(false);
    }
    expect(isValidCertificateNumber('PRUG-ABCDEFGH-000')).toBe(false);
    expect(isValidCertificateNumber('not-a-certificate')).toBe(false);
  });
});

describe('profile slugs', () => {
  it('builds a readable handle from the title', () => {
    expect(buildProfileSlug('The Tabriz Medallion Carpet', 'seed')).toMatch(
      /^tabriz-medallion-[0-9a-z]{6}$/,
    );
  });

  it('falls back when the title has no usable words', () => {
    expect(buildProfileSlug('!!!', 'seed')).toMatch(/^carpet-[0-9a-z]{6}$/);
  });

  it('produces a different suffix on each retry so collisions resolve', () => {
    expect(buildProfileSlug('Kashan', 'seed', 0)).not.toBe(
      buildProfileSlug('Kashan', 'seed', 1),
    );
  });

  it('keeps Persian titles usable', () => {
    expect(buildProfileSlug('فرش تبریز', 'seed')).toMatch(/-[0-9a-z]{6}$/);
  });
});

describe('document hash', () => {
  const base = {
    carpetId: CARPET_ID,
    certificateNumber: buildCertificateNumber(CARPET_ID),
    identity: IDENTITY,
    photos: PHOTOS,
    ledgerHeadHash: 'c'.repeat(64),
  };

  it('is stable for the same inputs', () => {
    expect(buildDocumentHash(base).documentHash).toBe(
      buildDocumentHash(base).documentHash,
    );
  });

  it('ignores the order photos are listed in', () => {
    expect(
      buildDocumentHash({ ...base, photos: [...PHOTOS].reverse() })
        .photoSetHash,
    ).toBe(buildDocumentHash(base).photoSetHash);
  });

  it('changes when a photo is swapped', () => {
    const tampered = [{ ...PHOTOS[0], sha256: 'f'.repeat(64) }, PHOTOS[1]];
    expect(
      buildDocumentHash({ ...base, photos: tampered }).documentHash,
    ).not.toBe(buildDocumentHash(base).documentHash);
  });

  it('changes when the identity document is edited', () => {
    const edited = { ...IDENTITY, estimatedAgeRange: '1890-1910' };
    expect(
      buildDocumentHash({ ...base, identity: edited }).identityHash,
    ).not.toBe(buildDocumentHash(base).identityHash);
  });

  it('changes when the ledger head moves', () => {
    expect(
      buildDocumentHash({ ...base, ledgerHeadHash: 'd'.repeat(64) })
        .documentHash,
    ).not.toBe(buildDocumentHash(base).documentHash);
  });
});
