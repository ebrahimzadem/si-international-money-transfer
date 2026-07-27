/**
 * Fraud detection.
 *
 * Three deterministic layers run before any model is consulted:
 *   per-photo   — container metadata, editor markers, thumbnail agreement
 *   cross-photo — duplicates, mixed capture devices, impossible timelines
 *   registry    — photos that already belong to another registered carpet
 *
 * The vision findings are folded in afterwards by the agent, which owns the
 * final score. Every finding carries a weight so the score is explainable.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ForensicFinding, PrugPhoto, RiskLevel, ShotType } from '../prug.types';
import { PhotoInspection, inspectPhoto } from './image-metadata';
import {
  computeDHash,
  decodeToGray,
  hammingDistance,
  hashBands,
  hashFromHex,
} from './perceptual-hash';
import { PrugRepository } from '../prug.repository';
import { parseExifDate } from './exif';

/** dHash distance below which two photos are the same image. */
const DUPLICATE_THRESHOLD = 6;
/** dHash distance below which two photos show the same scene — near-duplicate. */
const NEAR_DUPLICATE_THRESHOLD = 12;
/** EXIF thumbnail may legitimately drift this far from its own image. */
const THUMBNAIL_THRESHOLD = 18;

const MACRO_SHOTS: ShotType[] = ['knot_macro', 'pile_macro'];

export interface RegistryMatch {
  photoId: string;
  matchedCarpetId: string;
  matchedPhotoId: string;
  distance: number;
  sameOwner: boolean;
}

export interface ScoreResult {
  riskScore: number;
  riskLevel: RiskLevel;
  verdict: 'pass' | 'review' | 'fail';
}

@Injectable()
export class ForensicsService {
  private readonly logger = new Logger(ForensicsService.name);

  constructor(private readonly repository: PrugRepository) {}

  /**
   * Inspect one uploaded photo: container metadata plus the EXIF
   * thumbnail-versus-image comparison, which catches edits made by tools that
   * do not refresh the embedded preview.
   */
  inspectUpload(buf: Buffer, shotType: ShotType): PhotoInspection | null {
    const inspection = inspectPhoto(buf, {
      isMacro: MACRO_SHOTS.includes(shotType),
    });
    if (!inspection) return null;

    if (inspection.thumbnail && inspection.metadata.fingerprint) {
      const thumbnailGray = decodeToGray(inspection.thumbnail);
      if (
        thumbnailGray &&
        thumbnailGray.width >= 8 &&
        thumbnailGray.height >= 8
      ) {
        const distance = hammingDistance(
          computeDHash(thumbnailGray),
          hashFromHex(inspection.metadata.fingerprint.dhash),
        );

        if (distance > THUMBNAIL_THRESHOLD) {
          inspection.findings.push({
            code: 'thumbnail_mismatch',
            severity: 'high',
            source: 'pixel',
            message: `The embedded EXIF preview does not match the image it belongs to (distance ${distance}). The picture was altered after the camera wrote it.`,
            messageFa: `پیش‌نمایش داخل فایل با خود تصویر هم‌خوانی ندارد (فاصله ${distance}). عکس پس از ثبت توسط دوربین تغییر کرده است.`,
            weight: 35,
            details: { distance, threshold: THUMBNAIL_THRESHOLD },
          });
        }
      }
    }

    return inspection;
  }

  /**
   * Checks that only make sense across the whole set: the same frame submitted
   * twice, photos from different devices, and timelines that cannot be a
   * single photo session.
   */
  crossPhotoFindings(photos: PrugPhoto[]): ForensicFinding[] {
    const findings: ForensicFinding[] = [];
    if (photos.length < 2) return findings;

    // --- Identical or near-identical frames ---------------------------------
    for (let i = 0; i < photos.length; i++) {
      for (let j = i + 1; j < photos.length; j++) {
        const a = photos[i];
        const b = photos[j];

        if (a.sha256 === b.sha256) {
          findings.push({
            code: 'duplicate_photo',
            severity: 'high',
            source: 'cross_photo',
            message: `Photos ${a.position} and ${b.position} are byte-identical; the same file was submitted for two different shots.`,
            messageFa: `عکس‌های ${a.position} و ${b.position} کاملاً یکسان هستند؛ یک فایل برای دو نمای مختلف ارسال شده است.`,
            photoId: b.id,
            weight: 30,
            details: { otherPhotoId: a.id },
          });
          continue;
        }

        if (!a.dhash || !b.dhash) continue;
        const distance = hammingDistance(
          hashFromHex(a.dhash),
          hashFromHex(b.dhash),
        );

        if (distance <= DUPLICATE_THRESHOLD && a.shotType !== b.shotType) {
          findings.push({
            code: 'near_duplicate_photo',
            severity: 'medium',
            source: 'cross_photo',
            message: `Photos ${a.position} (${a.shotType}) and ${b.position} (${b.shotType}) are the same image re-saved; each shot must be a separate capture.`,
            messageFa: `عکس‌های ${a.position} (${a.shotType}) و ${b.position} (${b.shotType}) یک تصویر دوباره‌ذخیره‌شده هستند؛ هر نما باید عکس جداگانه باشد.`,
            photoId: b.id,
            weight: 20,
            details: { distance, otherPhotoId: a.id },
          });
        }
      }
    }

    // --- Capture device consistency ----------------------------------------
    const devices = new Set(
      photos
        .map((photo) =>
          [photo.metadata.cameraMake, photo.metadata.cameraModel]
            .filter(Boolean)
            .join(' ')
            .trim(),
        )
        .filter((device) => device.length > 0),
    );

    if (devices.size > 2) {
      findings.push({
        code: 'mixed_capture_devices',
        severity: 'medium',
        source: 'cross_photo',
        message: `The photos come from ${devices.size} different cameras (${[...devices].join(', ')}), which is unusual for one owner documenting one carpet.`,
        messageFa: `عکس‌ها با ${devices.size} دوربین متفاوت گرفته شده‌اند (${[...devices].join('، ')})؛ برای مستندسازی یک فرش توسط یک مالک غیرعادی است.`,
        weight: 18,
        details: { devices: [...devices] },
      });
    }

    // --- Capture timeline ---------------------------------------------------
    const timestamps = photos
      .map((photo) => parseExifDate(photo.metadata.dateTimeOriginal))
      .filter((date): date is Date => date !== null)
      .map((date) => date.getTime())
      .sort((a, b) => a - b);

    if (timestamps.length >= 3) {
      const spanDays =
        (timestamps[timestamps.length - 1] - timestamps[0]) / 86_400_000;

      if (spanDays > 365) {
        findings.push({
          code: 'implausible_capture_span',
          severity: 'medium',
          source: 'cross_photo',
          message: `The photos were taken over ${Math.round(spanDays)} days. A documentation set should be a single session; this suggests images collected from elsewhere.`,
          messageFa: `عکس‌ها در بازه ${Math.round(spanDays)} روز گرفته شده‌اند. مجموعه مستندسازی باید در یک نشست باشد؛ این حالت نشان می‌دهد تصاویر از منابع دیگر جمع‌آوری شده‌اند.`,
          weight: 20,
          details: { spanDays: Math.round(spanDays) },
        });
      }
    }

    const missingTimestamps = photos.filter(
      (photo) => !photo.metadata.dateTimeOriginal,
    ).length;
    if (missingTimestamps === photos.length && photos.length >= 5) {
      findings.push({
        code: 'no_capture_timeline',
        severity: 'medium',
        source: 'cross_photo',
        message:
          'No photo in the set carries a capture timestamp, so the session cannot be dated.',
        messageFa:
          'هیچ‌کدام از عکس‌ها زمان ثبت ندارند، بنابراین زمان عکس‌برداری قابل تعیین نیست.',
        weight: 12,
      });
    }

    return findings;
  }

  /**
   * Search the registry for photos that already belong to a different carpet.
   * A hit on another owner's verified carpet is the strongest signal Prug has
   * that someone is registering a rug they do not hold.
   */
  async findRegistryMatches(
    photos: PrugPhoto[],
    carpetId: string,
    ownerUserId: string,
  ): Promise<{ matches: RegistryMatch[]; findings: ForensicFinding[] }> {
    const matches: RegistryMatch[] = [];
    const findings: ForensicFinding[] = [];

    for (const photo of photos) {
      if (!photo.dhash) continue;

      const hash = hashFromHex(photo.dhash);
      const candidates = await this.repository.findFingerprintCandidates(
        hashBands(hash),
        carpetId,
      );

      for (const candidate of candidates) {
        const distance = hammingDistance(hash, hashFromHex(candidate.dhash));
        if (distance > NEAR_DUPLICATE_THRESHOLD) continue;

        const sameOwner = candidate.ownerUserId === ownerUserId;
        matches.push({
          photoId: photo.id,
          matchedCarpetId: candidate.carpetId,
          matchedPhotoId: candidate.photoId,
          distance,
          sameOwner,
        });

        findings.push(
          sameOwner
            ? {
                code: 'duplicate_registration_same_owner',
                severity: 'medium',
                source: 'registry',
                message: `Photo ${photo.position} also appears on carpet ${candidate.carpetId}, which you already registered. A carpet may only be registered once.`,
                messageFa: `عکس ${photo.position} در فرش ${candidate.carpetId} که قبلاً ثبت کرده‌اید نیز وجود دارد. هر فرش تنها یک بار قابل ثبت است.`,
                photoId: photo.id,
                weight: 35,
                details: { matchedCarpetId: candidate.carpetId, distance },
              }
            : {
                code: 'duplicate_registration_other_owner',
                severity: 'critical',
                source: 'registry',
                message: `Photo ${photo.position} matches a photo already registered to a different owner (carpet ${candidate.carpetId}, distance ${distance}). This registration cannot proceed without manual investigation.`,
                messageFa: `عکس ${photo.position} با عکسی که قبلاً به نام مالک دیگری ثبت شده مطابقت دارد (فرش ${candidate.carpetId}، فاصله ${distance}). این ثبت بدون بررسی دستی ادامه نمی‌یابد.`,
                photoId: photo.id,
                weight: 100,
                details: { matchedCarpetId: candidate.carpetId, distance },
              },
        );
      }
    }

    return { matches, findings };
  }

  /**
   * Fold findings into a 0-100 risk score.
   *
   * Weights are summed with diminishing returns so a pile of minor signals
   * cannot outweigh one decisive finding, and any critical finding floors the
   * score at the rejection threshold.
   */
  score(findings: ForensicFinding[]): ScoreResult {
    const sorted = [...findings].sort((a, b) => b.weight - a.weight);

    let total = 0;
    sorted.forEach((finding, index) => {
      // Each successive finding contributes less than the last.
      total += finding.weight * Math.pow(0.85, index);
    });

    const hasCritical = findings.some(
      (finding) => finding.severity === 'critical',
    );
    const riskScore = Math.min(
      100,
      Math.round(hasCritical ? Math.max(total, 85) : total),
    );

    const riskLevel: RiskLevel =
      riskScore >= 75
        ? 'severe'
        : riskScore >= 45
          ? 'high'
          : riskScore >= 20
            ? 'medium'
            : 'low';

    const verdict: ScoreResult['verdict'] =
      riskScore >= 75 ? 'fail' : riskScore >= 20 ? 'review' : 'pass';

    return { riskScore, riskLevel, verdict };
  }
}
