/**
 * In-app capture enforcement.
 *
 * Photos must be taken inside the Prug app, live, against the carpet in front
 * of the owner — not picked from a gallery, forwarded from a dealer, or pulled
 * off a website.
 *
 * The client cannot be trusted to promise this, so the server drives it:
 *
 *   1. The owner opens a capture session, declaring the device and its UTC
 *      offset. The session carries a nonce for device attestation.
 *   2. Before each frame the client asks for a single-use frame token. The
 *      server records the instant it was issued.
 *   3. The photo must arrive with that token, and its EXIF capture time must
 *      fall between the token being issued and the upload arriving.
 *
 * A gallery photo fails at step 3: it was taken before the token existed. A
 * stripped photo has no capture time at all and cannot clear the check either.
 *
 * What this cannot do: prove that the pixels came from the camera sensor. A
 * rooted device running a virtual-camera framework can still feed a stored
 * image into the camera pipeline. Device attestation raises that cost — see
 * DeviceAttestationService — but nothing server-side closes it completely.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  CaptureFrame,
  CaptureSession,
  ForensicFinding,
  ShotType,
} from '../prug.types';
import { PrugRepository } from '../prug.repository';
import { PhotoInspection } from '../forensics/image-metadata';
import { resolveCaptureInstant } from '../forensics/exif';
import { DeviceAttestationService } from './device-attestation.service';
import { SHOT_SPECS } from './shot-list';

/** How long an owner has to photograph one carpet. Generous: rural connectivity, awkward rugs. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** A frame token is for the shot you are about to take, not for later. */
const FRAME_TTL_MS = 30 * 60 * 1000;
/** Faster than this and no one framed and took a photo — it was already on disk. */
const MIN_CAPTURE_LATENCY_MS = 1500;
/** Device and server clocks drift; EXIF seconds are truncated. */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export type CaptureMode = 'strict' | 'lenient' | 'off';

export interface CaptureVerdict {
  /** False when the upload must be refused outright. */
  accepted: boolean;
  /** Reason shown to the client when refused. */
  reason?: string;
  reasonFa?: string;
  findings: ForensicFinding[];
  /** True when the photo provably came from this session's live capture. */
  captureVerified: boolean;
  latencyMs: number | null;
}

@Injectable()
export class CaptureSessionService {
  private readonly logger = new Logger(CaptureSessionService.name);
  private readonly mode: CaptureMode;

  constructor(
    private readonly repository: PrugRepository,
    private readonly attestation: DeviceAttestationService,
    private readonly configService: ConfigService,
  ) {
    this.mode = this.configService.get<CaptureMode>(
      'PRUG_CAPTURE_MODE',
      'strict',
    );
    if (this.mode !== 'strict') {
      this.logger.warn(
        `PRUG_CAPTURE_MODE=${this.mode} — gallery photos are not being refused outright`,
      );
    }
  }

  get captureMode(): CaptureMode {
    return this.mode;
  }

  /** Open a session for one carpet on one device. */
  async openSession(input: {
    carpetId: string;
    userId: string;
    platform: 'ios' | 'android' | 'web';
    deviceId: string;
    deviceModel?: string;
    appVersion?: string;
    utcOffsetMinutes: number;
    attestationToken?: string;
  }): Promise<CaptureSession> {
    if (input.utcOffsetMinutes < -840 || input.utcOffsetMinutes > 840) {
      throw new BadRequestException(
        'utcOffsetMinutes must be within ±14 hours',
      );
    }

    // The nonce binds a device attestation to this session so an attestation
    // captured elsewhere cannot be replayed here.
    const nonce = randomBytes(32).toString('hex');
    const result = await this.attestation.verify({
      platform: input.platform,
      token: input.attestationToken,
      nonce,
    });

    if (!result.acceptable) {
      throw new ForbiddenException({
        message: result.reason,
        code: 'device_attestation_failed',
      });
    }

    // Abandoned sessions would otherwise hold frame tokens open.
    await this.repository.closeOpenCaptureSessions(
      input.carpetId,
      'superseded',
    );

    return this.repository.createCaptureSession({
      carpetId: input.carpetId,
      userId: input.userId,
      nonce,
      platform: input.platform,
      deviceId: input.deviceId,
      deviceModel: input.deviceModel ?? null,
      appVersion: input.appVersion ?? null,
      utcOffsetMinutes: input.utcOffsetMinutes,
      attestationStatus: result.status,
      attestationProvider: result.provider,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
  }

  /**
   * Issue the single-use token for the frame the client is about to take.
   * Called immediately before the shutter, never in a batch up front.
   */
  async issueFrameToken(input: {
    sessionId: string;
    userId: string;
    shotType: ShotType;
  }): Promise<CaptureFrame> {
    const session = await this.loadOpenSession(input.sessionId, input.userId);

    if (!SHOT_SPECS[input.shotType]) {
      throw new BadRequestException(`Unknown shot type: ${input.shotType}`);
    }

    return this.repository.createCaptureFrame({
      sessionId: session.id,
      shotType: input.shotType,
      token: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + FRAME_TTL_MS),
    });
  }

  /**
   * Validate an upload against its frame token and consume the token.
   *
   * Returns a verdict rather than throwing for soft failures, so `lenient`
   * mode can record findings where `strict` refuses.
   */
  async consumeFrame(input: {
    carpetId: string;
    userId: string;
    shotType: ShotType;
    frameToken?: string;
    inspection: PhotoInspection;
  }): Promise<CaptureVerdict> {
    const findings: ForensicFinding[] = [];

    if (this.mode === 'off') {
      return {
        accepted: true,
        findings,
        captureVerified: false,
        latencyMs: null,
      };
    }

    if (!input.frameToken) {
      return this.refuse(
        'photo_without_capture_token',
        'Photos must be taken in the Prug app. Open a capture session and request a frame token before each shot.',
        'عکس‌ها باید داخل اپلیکیشن Prug گرفته شوند. پیش از هر نما یک جلسه عکس‌برداری باز کنید و توکن فریم بگیرید.',
      );
    }

    const frame = await this.repository.findCaptureFrameByToken(
      input.frameToken,
    );
    if (!frame) {
      return this.refuse(
        'capture_token_unknown',
        'This capture token is not valid.',
        'این توکن عکس‌برداری معتبر نیست.',
      );
    }

    if (frame.consumedAt) {
      return this.refuse(
        'capture_token_reused',
        'This capture token has already been used. Each photo needs its own token.',
        'این توکن قبلاً استفاده شده است. هر عکس به توکن مخصوص خودش نیاز دارد.',
      );
    }

    const session = await this.repository.findCaptureSession(frame.sessionId);
    if (
      !session ||
      session.carpetId !== input.carpetId ||
      session.userId !== input.userId
    ) {
      return this.refuse(
        'capture_token_foreign',
        'This capture token belongs to a different carpet or account.',
        'این توکن متعلق به فرش یا حساب دیگری است.',
      );
    }

    const now = Date.now();
    if (session.status !== 'open' || session.expiresAt.getTime() < now) {
      return this.refuse(
        'capture_session_expired',
        'The capture session has expired. Start a new one and retake the remaining shots.',
        'جلسه عکس‌برداری منقضی شده است. جلسه جدیدی باز کنید و نماهای باقی‌مانده را دوباره بگیرید.',
      );
    }

    if (frame.expiresAt.getTime() < now) {
      return this.refuse(
        'capture_token_expired',
        'This frame token expired. Request a new one and take the photo now.',
        'توکن این فریم منقضی شده است. توکن جدید بگیرید و همان لحظه عکس را بگیرید.',
      );
    }

    if (frame.shotType !== input.shotType) {
      return this.refuse(
        'capture_token_wrong_shot',
        `This token was issued for "${frame.shotType}", not "${input.shotType}".`,
        `این توکن برای نمای «${frame.shotType}» صادر شده، نه «${input.shotType}».`,
      );
    }

    // --- The photo must have been taken during this frame's window ----------
    const latencyMs = now - frame.issuedAt.getTime();
    const exif = input.inspection.exif;
    const capturedAt = resolveCaptureInstant(exif, session.utcOffsetMinutes);

    if (!capturedAt) {
      // No capture time (or no usable zone) means the claim cannot be checked.
      const finding: ForensicFinding = {
        code: 'capture_time_unverifiable',
        severity: 'high',
        source: 'metadata',
        message:
          'The photo carries no usable capture timestamp, so it cannot be shown to have been taken in this session.',
        messageFa:
          'عکس زمان ثبت قابل استفاده‌ای ندارد، بنابراین نمی‌توان ثابت کرد در همین جلسه گرفته شده است.',
        weight: 40,
      };

      if (this.mode === 'strict') {
        await this.repository.consumeCaptureFrame(
          frame.id,
          null,
          latencyMs,
          false,
        );
        return {
          accepted: false,
          reason:
            'This photo has no capture timestamp. Take the photo with the in-app camera rather than importing it.',
          reasonFa:
            'این عکس زمان ثبت ندارد. عکس را با دوربین داخل اپلیکیشن بگیرید، نه از گالری.',
          findings: [finding],
          captureVerified: false,
          latencyMs,
        };
      }
      findings.push(finding);
    } else {
      const takenBeforeToken =
        capturedAt.getTime() <
        frame.issuedAt.getTime() - CLOCK_SKEW_TOLERANCE_MS;
      const takenAfterUpload =
        capturedAt.getTime() > now + CLOCK_SKEW_TOLERANCE_MS;

      if (takenBeforeToken || takenAfterUpload) {
        const ageMinutes = Math.round(
          (frame.issuedAt.getTime() - capturedAt.getTime()) / 60_000,
        );
        const finding: ForensicFinding = {
          code: 'capture_outside_session_window',
          severity: 'critical',
          source: 'metadata',
          message: takenBeforeToken
            ? `The photo was taken ${ageMinutes} minutes before this frame was requested, so it came from storage rather than the in-app camera.`
            : 'The photo claims a capture time in the future.',
          messageFa: takenBeforeToken
            ? `این عکس ${ageMinutes} دقیقه پیش از درخواست این فریم گرفته شده؛ یعنی از حافظه انتخاب شده نه از دوربین اپلیکیشن.`
            : 'زمان ثبت این عکس در آینده است.',
          weight: 100,
          details: {
            capturedAt: capturedAt.toISOString(),
            frameIssuedAt: frame.issuedAt.toISOString(),
          },
        };

        if (this.mode === 'strict') {
          await this.repository.consumeCaptureFrame(
            frame.id,
            null,
            latencyMs,
            false,
          );
          return {
            accepted: false,
            reason:
              'This photo was not taken during this capture session. Photos must be taken live in the app, not chosen from your gallery.',
            reasonFa:
              'این عکس در این جلسه گرفته نشده است. عکس‌ها باید همان لحظه در اپلیکیشن گرفته شوند، نه از گالری انتخاب شوند.',
            findings: [finding],
            captureVerified: false,
            latencyMs,
          };
        }
        findings.push(finding);
      }
    }

    // --- Sanity checks that do not block on their own ------------------------
    if (latencyMs < MIN_CAPTURE_LATENCY_MS) {
      findings.push({
        code: 'capture_implausibly_fast',
        severity: 'medium',
        source: 'metadata',
        message: `The photo arrived ${latencyMs}ms after the frame was requested — too fast to have been framed and taken.`,
        messageFa: `عکس تنها ${latencyMs} میلی‌ثانیه پس از درخواست فریم رسید؛ برای کادربندی و عکس‌برداری خیلی سریع است.`,
        weight: 25,
        details: { latencyMs },
      });
    }

    const declaredDevice = session.deviceModel?.toLowerCase().trim();
    const exifDevice = [
      input.inspection.metadata.cameraMake,
      input.inspection.metadata.cameraModel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .trim();

    if (
      declaredDevice &&
      exifDevice &&
      !this.devicesAgree(declaredDevice, exifDevice)
    ) {
      findings.push({
        code: 'capture_device_mismatch',
        severity: 'high',
        source: 'metadata',
        message: `The session runs on "${session.deviceModel}" but the photo was written by "${exifDevice}".`,
        messageFa: `جلسه روی دستگاه «${session.deviceModel}» باز شده اما عکس با «${exifDevice}» ثبت شده است.`,
        weight: 35,
        details: { sessionDevice: session.deviceModel, exifDevice },
      });
    }

    if (session.attestationStatus !== 'verified') {
      findings.push({
        code: 'device_not_attested',
        severity: 'low',
        source: 'metadata',
        message: `Device attestation is "${session.attestationStatus}", so the app binary and device were not independently checked.`,
        messageFa: `وضعیت تأیید دستگاه «${session.attestationStatus}» است؛ اصالت اپلیکیشن و دستگاه مستقلاً بررسی نشده.`,
        weight: 8,
      });
    }

    const captureVerified = findings.every(
      (finding) =>
        finding.severity !== 'critical' &&
        finding.code !== 'capture_time_unverifiable',
    );

    return { accepted: true, findings, captureVerified, latencyMs };
  }

  /** Link a consumed frame to the photo row it produced. */
  async attachPhoto(
    frameToken: string,
    photoId: string,
    latencyMs: number | null,
    verified: boolean,
  ): Promise<string | null> {
    const frame = await this.repository.findCaptureFrameByToken(frameToken);
    if (!frame) return null;

    await this.repository.consumeCaptureFrame(
      frame.id,
      photoId,
      latencyMs,
      verified,
    );
    return frame.sessionId;
  }

  async closeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.loadOpenSession(sessionId, userId);
    await this.repository.closeCaptureSession(session.id, 'closed');
  }

  async getSession(sessionId: string, userId: string): Promise<CaptureSession> {
    const session = await this.repository.findCaptureSession(sessionId);
    if (!session) throw new NotFoundException('Capture session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'This capture session belongs to another account',
      );
    }
    return session;
  }

  private async loadOpenSession(
    sessionId: string,
    userId: string,
  ): Promise<CaptureSession> {
    const session = await this.getSession(sessionId, userId);

    if (session.status !== 'open' || session.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This capture session is no longer open');
    }
    return session;
  }

  /**
   * The OS and EXIF name the same device differently: iOS reports "iPhone15,3"
   * where EXIF writes "Apple iPhone 15 Pro". Matching those literally would
   * flag every legitimate iPhone session, so compare word tokens — split at
   * letter/digit boundaries too — and require one in common.
   *
   * Deliberately loose. This check exists to catch a set assembled on someone
   * else's camera, not to pin down the exact handset, and a false positive here
   * blocks an honest owner.
   */
  private devicesAgree(declared: string, exif: string): boolean {
    const tokens = (value: string) =>
      value
        .replace(/[^a-z0-9]+/g, ' ')
        // "iphone15" -> "iphone 15"
        .replace(/([a-z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-z])/g, '$1 $2')
        .split(' ')
        // Model numbers are too generic to match on; brand words are not.
        .filter((token) => token.length > 2 && /[a-z]/.test(token));

    const declaredTokens = new Set(tokens(declared));
    return tokens(exif).some((token) => declaredTokens.has(token));
  }

  private refuse(
    code: string,
    reason: string,
    reasonFa: string,
  ): CaptureVerdict {
    return {
      accepted: false,
      reason,
      reasonFa,
      findings: [
        {
          code,
          severity: 'critical',
          source: 'metadata',
          message: reason,
          messageFa: reasonFa,
          weight: 100,
        },
      ],
      captureVerified: false,
      latencyMs: null,
    };
  }
}
