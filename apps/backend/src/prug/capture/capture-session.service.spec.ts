import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CaptureSessionService, CaptureMode } from './capture-session.service';
import { DeviceAttestationService } from './device-attestation.service';
import { PrugRepository } from '../prug.repository';
import { CaptureFrame, CaptureSession, ShotType } from '../prug.types';
import { PhotoInspection } from '../forensics/image-metadata';

const SESSION_ID = 'session-1';
const CARPET_ID = 'carpet-1';
const USER_ID = 'user-1';
const TOKEN = 'a'.repeat(64);

function session(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: SESSION_ID,
    carpetId: CARPET_ID,
    userId: USER_ID,
    nonce: 'n'.repeat(64),
    platform: 'ios',
    deviceId: 'device-1',
    deviceModel: 'Apple iPhone 15 Pro',
    appVersion: '1.0.0',
    utcOffsetMinutes: 210, // Tehran, +03:30
    attestationStatus: 'verified',
    attestationProvider: 'app_attest',
    status: 'open',
    startedAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 3_600_000),
    closedAt: null,
    ...overrides,
  };
}

function frame(overrides: Partial<CaptureFrame> = {}): CaptureFrame {
  return {
    id: 'frame-1',
    sessionId: SESSION_ID,
    shotType: 'full_front',
    token: TOKEN,
    issuedAt: new Date(Date.now() - 20_000),
    expiresAt: new Date(Date.now() + 600_000),
    consumedAt: null,
    photoId: null,
    latencyMs: null,
    captureVerified: false,
    ...overrides,
  };
}

/** EXIF writes local wall-clock time; format an instant in the device's zone. */
function exifTimestamp(instant: Date, offsetMinutes: number): string {
  const local = new Date(instant.getTime() + offsetMinutes * 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${local.getUTCFullYear()}:${pad(local.getUTCMonth() + 1)}:${pad(local.getUTCDate())} ` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`
  );
}

function inspection(overrides: {
  capturedAt?: Date | null;
  offsetMinutes?: number;
  offsetTag?: string;
  cameraMake?: string;
  cameraModel?: string;
}): PhotoInspection {
  const offsetMinutes = overrides.offsetMinutes ?? 210;
  const capturedAt =
    overrides.capturedAt === undefined ? new Date() : overrides.capturedAt;

  return {
    metadata: {
      format: 'jpeg',
      width: 3000,
      height: 2000,
      byteSize: 2_000_000,
      sha256: 'x'.repeat(64),
      hasExif: true,
      cameraMake: overrides.cameraMake ?? 'Apple',
      cameraModel: overrides.cameraModel ?? 'iPhone 15 Pro',
      markers: {
        adobeApp14: false,
        photoshopIrb: false,
        c2pa: false,
        xmpHistory: false,
      },
      trailingBytes: 0,
      fingerprint: { dhash: '0'.repeat(16), phash: '0'.repeat(16) },
    },
    findings: [],
    exif: capturedAt
      ? {
          tagCount: 12,
          dateTimeOriginal: exifTimestamp(capturedAt, offsetMinutes),
          offsetTimeOriginal: overrides.offsetTag,
          make: overrides.cameraMake ?? 'Apple',
          model: overrides.cameraModel ?? 'iPhone 15 Pro',
        }
      : { tagCount: 3, make: 'Apple' },
    thumbnail: null,
  };
}

function build(mode: CaptureMode = 'strict') {
  const repository = {
    findCaptureFrameByToken: jest.fn(),
    findCaptureSession: jest.fn(),
    consumeCaptureFrame: jest.fn(),
    createCaptureSession: jest.fn(),
    createCaptureFrame: jest.fn(),
    closeOpenCaptureSessions: jest.fn(),
    closeCaptureSession: jest.fn(),
  } as unknown as PrugRepository;

  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'PRUG_CAPTURE_MODE' ? mode : fallback,
    ),
  } as unknown as ConfigService;

  const attestation = {
    verify: jest.fn().mockResolvedValue({
      status: 'verified',
      provider: 'app_attest',
      acceptable: true,
    }),
    attestationMode: 'optional',
  } as unknown as DeviceAttestationService;

  return {
    repository,
    attestation,
    service: new CaptureSessionService(repository, attestation, config),
  };
}

describe('CaptureSessionService', () => {
  describe('openSession', () => {
    it('issues a nonce and supersedes any session already open for the carpet', async () => {
      const { service, repository } = build();
      (repository.createCaptureSession as jest.Mock).mockImplementation(
        (input) => Promise.resolve(session({ nonce: input.nonce })),
      );

      const result = await service.openSession({
        carpetId: CARPET_ID,
        userId: USER_ID,
        platform: 'ios',
        deviceId: 'device-1',
        utcOffsetMinutes: 210,
      });

      expect(repository.closeOpenCaptureSessions).toHaveBeenCalledWith(
        CARPET_ID,
        'superseded',
      );
      expect(result.nonce).toHaveLength(64);
    });

    it('rejects an impossible UTC offset', async () => {
      const { service } = build();

      await expect(
        service.openSession({
          carpetId: CARPET_ID,
          userId: USER_ID,
          platform: 'ios',
          deviceId: 'device-1',
          utcOffsetMinutes: 5000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses to open when attestation is rejected', async () => {
      const { service, attestation } = build();
      (attestation.verify as jest.Mock).mockResolvedValue({
        status: 'failed',
        provider: 'app_attest',
        acceptable: false,
        reason: 'Device attestation failed.',
      });

      await expect(
        service.openSession({
          carpetId: CARPET_ID,
          userId: USER_ID,
          platform: 'ios',
          deviceId: 'device-1',
          utcOffsetMinutes: 0,
          attestationToken: 'bad-token',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('consumeFrame — the gallery check', () => {
    it('accepts a photo taken after its frame token was issued', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(session());

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({ capturedAt: new Date(Date.now() - 10_000) }),
      });

      expect(verdict.accepted).toBe(true);
      expect(verdict.captureVerified).toBe(true);
      expect(verdict.findings).toHaveLength(0);
    });

    it('refuses a gallery photo taken before the session existed', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(session());

      const lastWeek = new Date(Date.now() - 7 * 86_400_000);
      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({ capturedAt: lastWeek }),
      });

      expect(verdict.accepted).toBe(false);
      expect(verdict.findings[0].code).toBe('capture_outside_session_window');
      expect(verdict.findings[0].severity).toBe('critical');
      // The token is spent even though the upload failed.
      expect(repository.consumeCaptureFrame).toHaveBeenCalled();
    });

    it('refuses an upload with no frame token at all', async () => {
      const { service } = build();

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        inspection: inspection({}),
      });

      expect(verdict.accepted).toBe(false);
      expect(verdict.findings[0].code).toBe('photo_without_capture_token');
    });

    it('refuses a token that was already spent', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame({ consumedAt: new Date() }),
      );

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({}),
      });

      expect(verdict.accepted).toBe(false);
      expect(verdict.findings[0].code).toBe('capture_token_reused');
    });

    it("refuses another carpet's token", async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(
        session({ carpetId: 'carpet-2' }),
      );

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({}),
      });

      expect(verdict.accepted).toBe(false);
      expect(verdict.findings[0].code).toBe('capture_token_foreign');
    });

    it('refuses a token issued for a different shot', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame({ shotType: 'knot_macro' as ShotType }),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(session());

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({}),
      });

      expect(verdict.accepted).toBe(false);
      expect(verdict.findings[0].code).toBe('capture_token_wrong_shot');
    });

    it('refuses an expired session', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(
        session({ expiresAt: new Date(Date.now() - 1000) }),
      );

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({}),
      });

      expect(verdict.accepted).toBe(false);
      expect(verdict.findings[0].code).toBe('capture_session_expired');
    });

    it('refuses a photo with no capture timestamp', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(session());

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({ capturedAt: null }),
      });

      expect(verdict.accepted).toBe(false);
      expect(verdict.findings[0].code).toBe('capture_time_unverifiable');
    });
  });

  describe('time zones', () => {
    it('reads a non-UTC device clock correctly', async () => {
      // Tehran is +03:30. A photo taken now reads 3.5 hours ahead in EXIF; a
      // naive UTC comparison would call it a future capture and reject it.
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(
        session({ utcOffsetMinutes: 210 }),
      );

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({
          capturedAt: new Date(Date.now() - 5_000),
          offsetMinutes: 210,
        }),
      });

      expect(verdict.accepted).toBe(true);
    });

    it("prefers the photo's own offset tag over the session's", async () => {
      // Session says UTC, but the file records +03:30 and was written in that
      // zone — trusting the session offset here would misdate it by hours.
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(
        session({ utcOffsetMinutes: 0 }),
      );

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({
          capturedAt: new Date(Date.now() - 5_000),
          offsetMinutes: 210,
          offsetTag: '+03:30',
        }),
      });

      expect(verdict.accepted).toBe(true);
    });
  });

  describe('soft signals', () => {
    it('notes an upload that arrived too fast to be a real capture', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame({ issuedAt: new Date(Date.now() - 200) }),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(session());

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({ capturedAt: new Date() }),
      });

      expect(verdict.accepted).toBe(true);
      expect(verdict.findings.map((f) => f.code)).toContain(
        'capture_implausibly_fast',
      );
    });

    it('notes a photo written by a different device than the session', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(session());

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({
          capturedAt: new Date(Date.now() - 10_000),
          cameraMake: 'Canon',
          cameraModel: 'EOS R5',
        }),
      });

      expect(verdict.findings.map((f) => f.code)).toContain(
        'capture_device_mismatch',
      );
    });

    it('accepts differing spellings of the same device', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(
        session({ deviceModel: 'iPhone15,3' }),
      );

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({ capturedAt: new Date(Date.now() - 10_000) }),
      });

      expect(verdict.findings.map((f) => f.code)).not.toContain(
        'capture_device_mismatch',
      );
    });

    it('notes an unattested device without blocking it', async () => {
      const { service, repository } = build();
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(
        session({ attestationStatus: 'unavailable' }),
      );

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({ capturedAt: new Date(Date.now() - 10_000) }),
      });

      expect(verdict.accepted).toBe(true);
      expect(verdict.findings.map((f) => f.code)).toContain(
        'device_not_attested',
      );
    });
  });

  describe('modes', () => {
    it('lenient mode records the gallery photo as a finding instead of refusing', async () => {
      const { service, repository } = build('lenient');
      (repository.findCaptureFrameByToken as jest.Mock).mockResolvedValue(
        frame(),
      );
      (repository.findCaptureSession as jest.Mock).mockResolvedValue(session());

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        frameToken: TOKEN,
        inspection: inspection({
          capturedAt: new Date(Date.now() - 7 * 86_400_000),
        }),
      });

      expect(verdict.accepted).toBe(true);
      expect(verdict.captureVerified).toBe(false);
      expect(verdict.findings.map((f) => f.code)).toContain(
        'capture_outside_session_window',
      );
    });

    it('off mode skips the check entirely', async () => {
      const { service, repository } = build('off');

      const verdict = await service.consumeFrame({
        carpetId: CARPET_ID,
        userId: USER_ID,
        shotType: 'full_front',
        inspection: inspection({}),
      });

      expect(verdict.accepted).toBe(true);
      expect(verdict.captureVerified).toBe(false);
      expect(repository.findCaptureFrameByToken).not.toHaveBeenCalled();
    });
  });
});
