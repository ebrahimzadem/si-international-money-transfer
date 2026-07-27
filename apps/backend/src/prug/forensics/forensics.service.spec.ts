import { ForensicsService } from './forensics.service';
import { PrugRepository } from '../prug.repository';
import { ForensicFinding, PrugPhoto, ShotType } from '../prug.types';
import { fingerprint } from './perceptual-hash';
import { buildPng } from './__fixtures__/images';

function photo(
  overrides: Partial<PrugPhoto> & { id: string; position: number },
): PrugPhoto {
  return {
    carpetId: 'carpet-1',
    shotType: 'corner' as ShotType,
    storageKey: `carpet-1/${overrides.id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 2_000_000,
    width: 3000,
    height: 2000,
    sha256: overrides.id.repeat(8).slice(0, 64).padEnd(64, '0'),
    dhash: null,
    phash: null,
    findings: [],
    createdAt: new Date(),
    metadata: {
      format: 'jpeg',
      width: 3000,
      height: 2000,
      byteSize: 2_000_000,
      sha256: 'x'.repeat(64),
      hasExif: true,
      cameraMake: 'Apple',
      cameraModel: 'iPhone 15 Pro',
      dateTimeOriginal: '2026:03:14 09:30:00',
      markers: {
        adobeApp14: false,
        photoshopIrb: false,
        c2pa: false,
        xmpHistory: false,
      },
      trailingBytes: 0,
      fingerprint: null,
    },
    ...overrides,
  } as PrugPhoto;
}

function finding(overrides: Partial<ForensicFinding>): ForensicFinding {
  return {
    code: 'test',
    severity: 'low',
    source: 'metadata',
    message: 'test finding',
    weight: 10,
    ...overrides,
  };
}

describe('ForensicsService', () => {
  const repository = {
    findFingerprintCandidates: jest.fn(),
  } as unknown as PrugRepository;
  const service = new ForensicsService(repository);

  beforeEach(() => jest.clearAllMocks());

  describe('inspectUpload', () => {
    it('rejects formats it cannot verify', () => {
      expect(
        service.inspectUpload(
          Buffer.from('RIFF____WEBPVP8 ', 'latin1'),
          'full_front',
        ),
      ).toBeNull();
    });

    it('fingerprints an image it can decode', () => {
      const png = buildPng({
        width: 1200,
        height: 900,
        pixel: (x, y) => (x * 3 + y * 5) % 255,
      });
      const inspection = service.inspectUpload(png, 'full_front');

      expect(inspection!.metadata.fingerprint).toEqual(
        expect.objectContaining({
          dhash: expect.any(String),
          phash: expect.any(String),
        }),
      );
    });
  });

  describe('crossPhotoFindings', () => {
    it('finds nothing in a clean set', () => {
      const png = buildPng({
        width: 800,
        height: 600,
        pixel: (x, y) => (x + y) % 255,
      });
      const other = buildPng({
        width: 800,
        height: 600,
        pixel: (x, y) => (x * 7 - y * 3) % 255,
      });

      const findings = service.crossPhotoFindings([
        photo({
          id: 'a',
          position: 1,
          dhash: fingerprint(png)!.dhash,
          shotType: 'full_front',
        }),
        photo({
          id: 'b',
          position: 2,
          dhash: fingerprint(other)!.dhash,
          shotType: 'full_back',
        }),
      ]);

      expect(findings).toHaveLength(0);
    });

    it('catches the same file submitted for two shots', () => {
      const findings = service.crossPhotoFindings([
        photo({
          id: 'a',
          position: 1,
          sha256: 'z'.repeat(64),
          shotType: 'full_front',
        }),
        photo({
          id: 'b',
          position: 2,
          sha256: 'z'.repeat(64),
          shotType: 'full_back',
        }),
      ]);

      expect(findings[0].code).toBe('duplicate_photo');
      expect(findings[0].severity).toBe('high');
    });

    it('catches a re-saved copy filed as a different shot', () => {
      const png = buildPng({
        width: 800,
        height: 600,
        pixel: (x, y) => (x + y) % 255,
      });
      const hash = fingerprint(png)!.dhash;

      const findings = service.crossPhotoFindings([
        photo({ id: 'a', position: 1, dhash: hash, shotType: 'full_front' }),
        photo({ id: 'b', position: 2, dhash: hash, shotType: 'full_back' }),
      ]);

      expect(findings.map((entry) => entry.code)).toContain(
        'near_duplicate_photo',
      );
    });

    it('allows two frames of the same shot type to look alike', () => {
      const png = buildPng({
        width: 800,
        height: 600,
        pixel: (x, y) => (x + y) % 255,
      });
      const hash = fingerprint(png)!.dhash;

      // Four corner shots of one carpet legitimately resemble each other.
      const findings = service.crossPhotoFindings([
        photo({ id: 'a', position: 1, dhash: hash, shotType: 'corner' }),
        photo({ id: 'b', position: 2, dhash: hash, shotType: 'corner' }),
      ]);

      expect(findings.map((entry) => entry.code)).not.toContain(
        'near_duplicate_photo',
      );
    });

    it('flags photos gathered from several cameras', () => {
      const devices = ['Apple iPhone 15', 'Samsung S24', 'Canon EOS R5'];
      const photos = devices.map((device, index) =>
        photo({
          id: `p${index}`,
          position: index + 1,
          metadata: {
            ...photo({ id: 'x', position: 0 }).metadata,
            cameraMake: device.split(' ')[0],
            cameraModel: device.split(' ').slice(1).join(' '),
          },
        }),
      );

      expect(
        service.crossPhotoFindings(photos).map((entry) => entry.code),
      ).toContain('mixed_capture_devices');
    });

    it('flags a set assembled over more than a year', () => {
      const dates = [
        '2019:01:01 10:00:00',
        '2024:06:01 10:00:00',
        '2026:03:14 09:30:00',
      ];
      const photos = dates.map((date, index) =>
        photo({
          id: `p${index}`,
          position: index + 1,
          metadata: {
            ...photo({ id: 'x', position: 0 }).metadata,
            dateTimeOriginal: date,
          },
        }),
      );

      expect(
        service.crossPhotoFindings(photos).map((entry) => entry.code),
      ).toContain('implausible_capture_span');
    });
  });

  describe('findRegistryMatches', () => {
    const png = buildPng({
      width: 800,
      height: 600,
      pixel: (x, y) => (x * 2 + y) % 255,
    });
    const hash = fingerprint(png)!.dhash;
    const subject = [photo({ id: 'a', position: 1, dhash: hash })];

    it('treats a match on another owner as critical', async () => {
      (repository.findFingerprintCandidates as jest.Mock).mockResolvedValue([
        {
          photoId: 'other-photo',
          carpetId: 'carpet-2',
          ownerUserId: 'user-2',
          dhash: hash,
          phash: null,
          shotType: 'full_front',
          carpetStatus: 'verified',
        },
      ]);

      const result = await service.findRegistryMatches(
        subject,
        'carpet-1',
        'user-1',
      );

      expect(result.matches).toHaveLength(1);
      expect(result.findings[0].code).toBe(
        'duplicate_registration_other_owner',
      );
      expect(result.findings[0].severity).toBe('critical');
    });

    it('treats a match on the registrant’s own carpet as a lesser problem', async () => {
      (repository.findFingerprintCandidates as jest.Mock).mockResolvedValue([
        {
          photoId: 'other-photo',
          carpetId: 'carpet-2',
          ownerUserId: 'user-1',
          dhash: hash,
          phash: null,
          shotType: 'full_front',
          carpetStatus: 'verified',
        },
      ]);

      const result = await service.findRegistryMatches(
        subject,
        'carpet-1',
        'user-1',
      );

      expect(result.findings[0].code).toBe('duplicate_registration_same_owner');
      expect(result.findings[0].severity).toBe('medium');
    });

    it('ignores candidates that are merely similar', async () => {
      const different = fingerprint(
        buildPng({
          width: 800,
          height: 600,
          pixel: (x, y) => (x * 9 - y * 4) % 255,
        }),
      )!;
      (repository.findFingerprintCandidates as jest.Mock).mockResolvedValue([
        {
          photoId: 'other-photo',
          carpetId: 'carpet-2',
          ownerUserId: 'user-2',
          dhash: different.dhash,
          phash: null,
          shotType: 'full_front',
          carpetStatus: 'verified',
        },
      ]);

      const result = await service.findRegistryMatches(
        subject,
        'carpet-1',
        'user-1',
      );
      expect(result.matches).toHaveLength(0);
    });

    it('skips photos with no fingerprint', async () => {
      await service.findRegistryMatches(
        [photo({ id: 'a', position: 1, dhash: null })],
        'carpet-1',
        'user-1',
      );
      expect(repository.findFingerprintCandidates).not.toHaveBeenCalled();
    });
  });

  describe('score', () => {
    it('passes a clean set', () => {
      expect(service.score([])).toEqual({
        riskScore: 0,
        riskLevel: 'low',
        verdict: 'pass',
      });
    });

    it('sends a moderately suspicious set to review', () => {
      const result = service.score([
        finding({ weight: 30, severity: 'medium' }),
      ]);

      expect(result.verdict).toBe('review');
      expect(result.riskLevel).toBe('medium');
    });

    it('fails any set with a critical finding', () => {
      const result = service.score([
        finding({ weight: 100, severity: 'critical' }),
      ]);

      expect(result.verdict).toBe('fail');
      expect(result.riskLevel).toBe('severe');
      expect(result.riskScore).toBeGreaterThanOrEqual(85);
    });

    it('floors the score at rejection even when a critical finding is under-weighted', () => {
      expect(
        service.score([finding({ weight: 5, severity: 'critical' })]).riskScore,
      ).toBe(85);
    });

    it('applies diminishing returns so minor findings cannot stack into a rejection', () => {
      const many = Array.from({ length: 12 }, () =>
        finding({ weight: 10, severity: 'low' }),
      );
      const result = service.score(many);

      expect(result.riskScore).toBeLessThan(75);
      expect(result.verdict).not.toBe('fail');
    });

    it('never exceeds 100', () => {
      const heavy = Array.from({ length: 10 }, () =>
        finding({ weight: 100, severity: 'high' }),
      );
      expect(service.score(heavy).riskScore).toBeLessThanOrEqual(100);
    });
  });
});
