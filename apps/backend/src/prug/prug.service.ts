/**
 * The Prug agent.
 *
 * Orchestrates the whole lifecycle of a carpet identity:
 *
 *   draft → guided capture → analysis → certificate → transfers → tokenisation
 *
 * Analysis is a fixed pipeline rather than a free-running loop: deterministic
 * forensics first, vision passes second, scoring last. That ordering matters —
 * the model never gets to overrule a hash collision or a stripped EXIF block,
 * and every decision the agent makes can be replayed from the stored findings.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CarpetIdentity,
  CarpetToken,
  CoverageAssessment,
  ForensicFinding,
  ForensicReport,
  LedgerEventType,
  PrugPhoto,
  ShotType,
} from './prug.types';
import {
  CarpetRow,
  PrugRepository,
  ProfileVisibility,
} from './prug.repository';
import { ForensicsService, RegistryMatch } from './forensics/forensics.service';
import {
  ClaudeVisionService,
  PhotoLoader,
  VisionPhotoRef,
} from './agent/claude-vision.service';
import { PhotoStorageService } from './storage/photo-storage.service';
import { PrugKycService } from './kyc/prug-kyc.service';
import { OwnershipService } from './ownership/ownership.service';
import { TokenizationService } from './tokenization/tokenization.service';
import {
  MAX_PHOTOS,
  SHOT_SPECS,
  canAcceptShot,
  evaluateCoverage,
} from './capture/shot-list';
import {
  buildCertificateNumber,
  buildDocumentHash,
  buildProfileSlug,
} from './identity/certificate';
import { verifyLedger } from './identity/ledger';
import { hashBands, hashFromHex } from './forensics/perceptual-hash';

/** Photos larger than this are stored but skipped by the vision passes. */
const MAX_AI_PHOTO_BYTES = 8 * 1024 * 1024;

export interface AddPhotoResult {
  photo: PrugPhoto;
  findings: ForensicFinding[];
  coverage: ReturnType<typeof evaluateCoverage>;
  /** True when the immediate checks found something worth a retake. */
  retakeRecommended: boolean;
}

export interface AnalysisResult {
  carpet: CarpetRow;
  report: ForensicReport;
  identity: CarpetIdentity | null;
  certificateNumber: string | null;
  /** Set when the analysis passed but the owner has not completed KYC. */
  certificatePendingReason: string | null;
}

@Injectable()
export class PrugService {
  private readonly logger = new Logger(PrugService.name);

  constructor(
    private readonly repository: PrugRepository,
    private readonly forensics: ForensicsService,
    private readonly vision: ClaudeVisionService,
    private readonly storage: PhotoStorageService,
    private readonly kyc: PrugKycService,
    private readonly ownership: OwnershipService,
    private readonly tokenization: TokenizationService,
  ) {}

  // ==========================================================================
  // REGISTRATION
  // ==========================================================================

  async createCarpet(
    userId: string,
    input: {
      title: string;
      declared: Record<string, unknown>;
      acquisitionType?: string;
      acquiredAt?: string;
    },
  ): Promise<CarpetRow> {
    const slug = await this.reserveSlug(input.title, userId);
    const user = await this.repository.findUserById(userId);

    const carpet = await this.repository.createCarpet({
      ownerUserId: userId,
      title: input.title,
      declared: input.declared,
      profileSlug: slug,
    });

    await this.ownership.openInitialOwnership({
      carpetId: carpet.id,
      ownerUserId: userId,
      ownerName: user?.fullName || user?.email || 'Registrant',
      acquisitionType: (input.acquisitionType as never) || 'unknown',
      acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : null,
      verified: user?.kycStatus === 'verified',
    });

    await this.appendEvent(carpet.id, 'carpet_registered', userId, {
      title: carpet.title,
      declared: input.declared,
      profileSlug: slug,
    });

    return carpet;
  }

  /** Find a free profile slug, re-rolling the suffix on collision. */
  private async reserveSlug(title: string, seed: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = buildProfileSlug(title, `${seed}:${Date.now()}`, attempt);
      if (!(await this.repository.profileSlugExists(slug))) return slug;
    }
    throw new BadRequestException(
      'Could not allocate a profile address; please retry',
    );
  }

  async getOwnedCarpet(userId: string, carpetId: string): Promise<CarpetRow> {
    const carpet = await this.repository.findCarpetById(carpetId);
    if (!carpet) throw new NotFoundException('Carpet not found');
    if (carpet.ownerUserId !== userId)
      throw new ForbiddenException('You do not own this carpet');
    return carpet;
  }

  async listCarpets(userId: string): Promise<CarpetRow[]> {
    return this.repository.findCarpetsByOwner(userId);
  }

  async updateProfile(
    userId: string,
    carpetId: string,
    updates: {
      visibility?: ProfileVisibility;
      story?: string;
      coverPhotoId?: string;
    },
  ): Promise<CarpetRow> {
    await this.getOwnedCarpet(userId, carpetId);

    if (updates.coverPhotoId) {
      const photo = await this.repository.getPhoto(updates.coverPhotoId);
      if (!photo || photo.carpetId !== carpetId) {
        throw new BadRequestException('Cover photo must belong to this carpet');
      }
    }

    return this.repository.updateCarpet(carpetId, {
      profileVisibility: updates.visibility,
      profileStory: updates.story,
      coverPhotoId: updates.coverPhotoId,
    });
  }

  // ==========================================================================
  // CAPTURE
  // ==========================================================================

  /**
   * Accept one photo. Container forensics run inline so the client can prompt
   * for a retake while the owner is still standing over the carpet.
   */
  async addPhoto(
    userId: string,
    carpetId: string,
    input: { shotType: ShotType; data: Buffer; isPublic?: boolean },
  ): Promise<AddPhotoResult> {
    const carpet = await this.getOwnedCarpet(userId, carpetId);
    if (carpet.certificateNumber) {
      throw new BadRequestException(
        'This carpet already has a certificate; photos are frozen',
      );
    }

    const existing = await this.repository.listPhotos(carpetId);
    const accept = canAcceptShot(
      existing.map((photo) => photo.shotType),
      input.shotType,
    );
    if (!accept.ok) throw new BadRequestException(accept.reason);

    const inspection = this.forensics.inspectUpload(input.data, input.shotType);
    if (!inspection) {
      throw new BadRequestException(
        'Unsupported image. Send JPEG or PNG — HEIC and WebP cannot be verified and must be converted first.',
      );
    }

    if (existing.some((photo) => photo.sha256 === inspection.metadata.sha256)) {
      throw new BadRequestException(
        'This exact photo has already been uploaded for this carpet',
      );
    }

    const extension = inspection.metadata.format === 'png' ? 'png' : 'jpg';
    const storageKey = await this.storage.put(
      carpetId,
      inspection.metadata.sha256,
      extension,
      input.data,
    );
    const fingerprint = inspection.metadata.fingerprint;

    const photo = await this.repository.addPhoto({
      carpetId,
      shotType: input.shotType,
      position: await this.repository.nextPhotoPosition(carpetId),
      storageKey,
      mimeType: extension === 'png' ? 'image/png' : 'image/jpeg',
      byteSize: input.data.length,
      width: inspection.metadata.width,
      height: inspection.metadata.height,
      sha256: inspection.metadata.sha256,
      dhash: fingerprint?.dhash ?? null,
      phash: fingerprint?.phash ?? null,
      bands: fingerprint ? hashBands(hashFromHex(fingerprint.dhash)) : [],
      metadata: inspection.metadata,
      findings: inspection.findings,
      isPublic: input.isPublic ?? true,
    });

    const shots = [...existing.map((p) => p.shotType), input.shotType];
    const retakeRecommended = inspection.findings.some(
      (finding) =>
        finding.severity === 'high' || finding.severity === 'critical',
    );

    return {
      photo,
      findings: inspection.findings,
      coverage: evaluateCoverage(shots),
      retakeRecommended,
    };
  }

  async listPhotos(userId: string, carpetId: string): Promise<PrugPhoto[]> {
    await this.getOwnedCarpet(userId, carpetId);
    return this.repository.listPhotos(carpetId);
  }

  async deletePhoto(
    userId: string,
    carpetId: string,
    photoId: string,
  ): Promise<void> {
    const carpet = await this.getOwnedCarpet(userId, carpetId);
    if (carpet.certificateNumber) {
      throw new BadRequestException(
        'This carpet already has a certificate; photos are frozen',
      );
    }

    const photo = await this.repository.getPhoto(photoId);
    if (!photo || photo.carpetId !== carpetId)
      throw new NotFoundException('Photo not found');

    await this.repository.deletePhoto(photoId);
    await this.storage.delete(photo.storageKey);
  }

  async getPhotoBytes(
    userId: string,
    carpetId: string,
    photoId: string,
  ): Promise<{ data: Buffer; mimeType: string }> {
    await this.getOwnedCarpet(userId, carpetId);
    const photo = await this.repository.getPhoto(photoId);
    if (!photo || photo.carpetId !== carpetId)
      throw new NotFoundException('Photo not found');

    const data = await this.storage.get(photo.storageKey);
    if (!data)
      throw new NotFoundException('Photo bytes are no longer available');

    return { data, mimeType: photo.mimeType };
  }

  // ==========================================================================
  // ANALYSIS — the agent run
  // ==========================================================================

  async analyze(userId: string, carpetId: string): Promise<AnalysisResult> {
    let carpet = await this.getOwnedCarpet(userId, carpetId);
    if (carpet.certificateNumber) {
      throw new BadRequestException('This carpet has already been certified');
    }

    const photos = await this.repository.listPhotos(carpetId);
    const coverage = evaluateCoverage(photos.map((photo) => photo.shotType));
    if (!coverage.complete) {
      throw new BadRequestException({
        message: 'The photo set is incomplete',
        missing: coverage.missing.map((entry) => ({
          shotType: entry.type,
          have: entry.have,
          need: entry.need,
          guidanceEn: SHOT_SPECS[entry.type]?.guidanceEn,
          guidanceFa: SHOT_SPECS[entry.type]?.guidanceFa,
        })),
        overfilled: coverage.overfilled,
        total: coverage.total,
      });
    }

    carpet = await this.repository.updateCarpet(carpetId, {
      status: 'analyzing',
    });
    await this.appendEvent(carpetId, 'photos_submitted', userId, {
      photoCount: photos.length,
      photoHashes: photos.map((photo) => ({
        shotType: photo.shotType,
        sha256: photo.sha256,
      })),
    });

    // --- Layer 1: deterministic ---------------------------------------------
    const findings: ForensicFinding[] = [];
    for (const photo of photos) {
      findings.push(
        ...(photo.findings || []).map((finding) => ({
          ...finding,
          photoId: photo.id,
        })),
      );
    }
    findings.push(...this.forensics.crossPhotoFindings(photos));

    const registry = await this.forensics.findRegistryMatches(
      photos,
      carpetId,
      userId,
    );
    findings.push(...registry.findings);

    // --- Layer 2: vision ----------------------------------------------------
    const { refs, load } = this.buildVisionInputs(photos, findings);
    let visionCoverage: CoverageAssessment | null = null;
    let identity: CarpetIdentity | null = null;

    if (this.vision.enabled && refs.length) {
      visionCoverage = await this.vision.assessCoverage(refs, load);
      if (visionCoverage)
        findings.push(...this.coverageFindings(visionCoverage, photos));

      const manipulation = await this.vision.detectManipulation(refs, load);
      if (manipulation)
        findings.push(...this.manipulationFindings(manipulation.findings));

      // A set that has already failed decisively does not need cataloguing.
      const decisive = findings.some(
        (finding) => finding.severity === 'critical',
      );
      if (!decisive) {
        identity = await this.vision.buildIdentity(refs, load, carpet.declared);
        if (identity?.declarationConflicts?.length) {
          findings.push({
            code: 'declaration_conflict',
            severity: 'low',
            source: 'vision',
            message: `The photographs disagree with the declared attributes: ${identity.declarationConflicts.join('; ')}`,
            messageFa: `عکس‌ها با مشخصات اعلام‌شده هم‌خوانی ندارند: ${identity.declarationConflicts.join('؛ ')}`,
            weight: 8,
          });
        }
      }
    } else {
      findings.push({
        code: 'vision_unavailable',
        severity: 'medium',
        source: 'vision',
        message:
          'Automated image review did not run, so this carpet needs a human reviewer before certification.',
        messageFa:
          'بررسی خودکار تصاویر انجام نشد؛ این فرش پیش از صدور شناسنامه به بازبینی انسانی نیاز دارد.',
        weight: 25,
      });
    }

    // --- Layer 3: score and decide ------------------------------------------
    const score = this.forensics.score(findings);
    const report: ForensicReport = {
      ...score,
      findings,
      coverage: visionCoverage,
      registryMatches: registry.matches.map((match: RegistryMatch) => ({
        photoId: match.photoId,
        matchedCarpetId: match.matchedCarpetId,
        distance: match.distance,
      })),
      analyzedAt: new Date(),
      visionModel: this.vision.enabled ? this.vision.modelId : undefined,
    };

    await this.repository.saveForensicReport(carpetId, report);
    await this.appendEvent(carpetId, 'analysis_completed', userId, {
      riskScore: report.riskScore,
      riskLevel: report.riskLevel,
      verdict: report.verdict,
      findingCodes: findings.map((finding) => finding.code),
      visionModel: report.visionModel || null,
    });

    const status =
      score.verdict === 'pass'
        ? 'verified'
        : score.verdict === 'review'
          ? 'manual_review'
          : 'rejected';
    carpet = await this.repository.updateCarpet(carpetId, {
      status,
      riskScore: score.riskScore,
      riskLevel: score.riskLevel,
      identity,
      identityModel: identity ? this.vision.modelId : null,
      reviewNotes:
        score.verdict === 'pass' ? null : this.summarizeForReviewer(findings),
    });

    // --- Certificate ---------------------------------------------------------
    let certificateNumber: string | null = null;
    let certificatePendingReason: string | null = null;

    if (score.verdict === 'pass' && identity) {
      try {
        certificateNumber = await this.issueCertificate(userId, carpetId);
        carpet = (await this.repository.findCarpetById(carpetId)) as CarpetRow;
      } catch (error) {
        if (error instanceof ForbiddenException) {
          certificatePendingReason =
            'Analysis passed. Complete identity verification (KYC) to have the certificate issued.';
          await this.repository.updateCarpet(carpetId, {
            reviewNotes: certificatePendingReason,
          });
        } else {
          throw error;
        }
      }
    } else if (score.verdict === 'pass' && !identity) {
      certificatePendingReason =
        'Analysis passed but no identity document was produced; a reviewer must complete it.';
    }

    this.logger.log(
      `Carpet ${carpetId} analysed: verdict=${score.verdict} risk=${score.riskScore} findings=${findings.length}`,
    );

    return {
      carpet,
      report,
      identity,
      certificateNumber,
      certificatePendingReason,
    };
  }

  /** Photos the vision passes may see, plus a loader that reads them on demand. */
  private buildVisionInputs(
    photos: PrugPhoto[],
    findings: ForensicFinding[],
  ): { refs: VisionPhotoRef[]; load: PhotoLoader } {
    const refs: VisionPhotoRef[] = [];
    const keys = new Map<string, string>();

    for (const photo of photos) {
      if (photo.byteSize > MAX_AI_PHOTO_BYTES) {
        findings.push({
          code: 'photo_too_large_for_review',
          severity: 'low',
          source: 'vision',
          message: `Photo ${photo.position} is ${(photo.byteSize / 1024 / 1024).toFixed(1)} MB and was excluded from automated visual review. Upload it at 2576px on the long edge.`,
          messageFa: `عکس ${photo.position} با حجم ${(photo.byteSize / 1024 / 1024).toFixed(1)} مگابایت از بررسی خودکار کنار گذاشته شد. آن را با بزرگ‌ترین ضلع ۲۵۷۶ پیکسل بارگذاری کنید.`,
          photoId: photo.id,
          weight: 8,
        });
        continue;
      }

      keys.set(photo.id, photo.storageKey);
      refs.push({
        id: photo.id,
        shotType: photo.shotType,
        mimeType: photo.mimeType,
        position: photo.position,
      });
    }

    const load: PhotoLoader = async (ref) => {
      const key = keys.get(ref.id);
      return key ? this.storage.get(key) : null;
    };

    return { refs, load };
  }

  private coverageFindings(
    coverage: CoverageAssessment,
    photos: PrugPhoto[],
  ): ForensicFinding[] {
    const findings: ForensicFinding[] = [];
    const position = (photoId: string) =>
      photos.find((photo) => photo.id === photoId)?.position ?? 0;

    if (!coverage.sameCarpetThroughout) {
      findings.push({
        code: 'multiple_carpets_in_set',
        severity: 'critical',
        source: 'vision',
        message: `The photos do not all show the same carpet. ${coverage.notes}`,
        messageFa: 'همه عکس‌ها یک فرش را نشان نمی‌دهند.',
        weight: 100,
        details: { inconsistentPhotoIds: coverage.inconsistentSubjectPhotoIds },
      });
    }

    for (const mismatch of coverage.mismatchedPhotos) {
      findings.push({
        code: 'shot_type_mismatch',
        severity: 'medium',
        source: 'vision',
        message: `Photo ${position(mismatch.photoId)} was filed as "${mismatch.declared}" but shows ${mismatch.observed}. ${mismatch.note}`,
        messageFa: `عکس ${position(mismatch.photoId)} به‌عنوان «${mismatch.declared}» ثبت شده اما ${mismatch.observed} را نشان می‌دهد.`,
        photoId: mismatch.photoId,
        weight: 15,
      });
    }

    for (const photoId of coverage.unusablePhotoIds) {
      findings.push({
        code: 'unusable_photo',
        severity: 'medium',
        source: 'vision',
        message: `Photo ${position(photoId)} is too blurry, dark or distant to assess and should be retaken.`,
        messageFa: `عکس ${position(photoId)} برای ارزیابی بیش از حد تار، تاریک یا دور است و باید دوباره گرفته شود.`,
        photoId,
        weight: 12,
      });
    }

    return findings;
  }

  private manipulationFindings(
    findings: Array<{
      photoId: string;
      code: string;
      severity: ForensicFinding['severity'];
      confidence: number;
      evidence: string;
    }>,
  ): ForensicFinding[] {
    return findings.map((finding) => ({
      code: `vision_${finding.code}`,
      severity: finding.severity,
      source: 'vision' as const,
      message: `${finding.evidence} (confidence ${(finding.confidence * 100).toFixed(0)}%)`,
      photoId: finding.photoId,
      // Low-confidence observations should not carry full weight.
      weight: Math.round(
        this.severityWeight(finding.severity) *
          Math.max(0.3, Math.min(1, finding.confidence)),
      ),
      details: { rawCode: finding.code, confidence: finding.confidence },
    }));
  }

  private severityWeight(severity: ForensicFinding['severity']): number {
    switch (severity) {
      case 'critical':
        return 100;
      case 'high':
        return 40;
      case 'medium':
        return 20;
      case 'low':
        return 8;
      default:
        return 0;
    }
  }

  private summarizeForReviewer(findings: ForensicFinding[]): string {
    const notable = findings
      .filter(
        (finding) =>
          finding.severity === 'critical' ||
          finding.severity === 'high' ||
          finding.severity === 'medium',
      )
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    return notable.length
      ? notable
          .map(
            (finding) =>
              `[${finding.severity}] ${finding.code}: ${finding.message}`,
          )
          .join('\n')
      : 'No significant findings.';
  }

  // ==========================================================================
  // CERTIFICATE
  // ==========================================================================

  /** Issue the certificate. KYC is enforced here and nowhere else. */
  async issueCertificate(userId: string, carpetId: string): Promise<string> {
    const carpet = await this.getOwnedCarpet(userId, carpetId);
    if (carpet.certificateNumber) return carpet.certificateNumber;
    if (!carpet.identity)
      throw new BadRequestException(
        'Run analysis before issuing a certificate',
      );
    if (carpet.status === 'rejected')
      throw new BadRequestException('This carpet failed verification');

    await this.kyc.assertVerified(userId, 'issue_certificate');

    const certificateNumber = buildCertificateNumber(carpetId);
    const photos = await this.repository.listPhotos(carpetId);
    const events = await this.repository.listLedgerEvents(carpetId);
    const { documentHash, photoSetHash, identityHash } = buildDocumentHash({
      carpetId,
      certificateNumber,
      identity: carpet.identity,
      photos,
      ledgerHeadHash: events.length
        ? events[events.length - 1].eventHash
        : null,
    });

    await this.repository.updateCarpet(carpetId, {
      certificateNumber,
      certificateIssuedAt: new Date(),
      status: 'verified',
    });

    await this.appendEvent(carpetId, 'certificate_issued', userId, {
      certificateNumber,
      documentHash,
      photoSetHash,
      identityHash,
    });

    this.logger.log(
      `Certificate ${certificateNumber} issued for carpet ${carpetId}`,
    );
    return certificateNumber;
  }

  // ==========================================================================
  // PROVENANCE
  // ==========================================================================

  async declareHistoricalOwner(
    userId: string,
    carpetId: string,
    input: Parameters<OwnershipService['addDeclaredHistoricalOwner']>[1],
  ) {
    await this.getOwnedCarpet(userId, carpetId);
    const record = await this.ownership.addDeclaredHistoricalOwner(
      carpetId,
      input,
    );

    await this.appendEvent(carpetId, 'historical_owner_declared', userId, {
      ownerName: record.ownerName,
      acquisitionType: record.acquisitionType,
      acquiredAt: record.acquiredAt?.toISOString() ?? null,
      releasedAt: record.releasedAt?.toISOString() ?? null,
      verified: false,
    });

    return record;
  }

  async initiateTransfer(
    userId: string,
    carpetId: string,
    input: {
      toEmail: string;
      message?: string;
      priceAmount?: string;
      priceCurrency?: string;
    },
  ) {
    const carpet = await this.getOwnedCarpet(userId, carpetId);
    if (!carpet.certificateNumber) {
      throw new BadRequestException(
        'Only certified carpets can be transferred',
      );
    }

    const transfer = await this.ownership.initiateTransfer({
      carpetId,
      fromUserId: userId,
      ...input,
    });
    await this.repository.updateCarpet(carpetId, { status: 'transferring' });
    await this.appendEvent(carpetId, 'transfer_initiated', userId, {
      transferId: transfer.id,
      toEmail: transfer.toEmail,
      priceAmount: transfer.priceAmount ?? null,
      priceCurrency: transfer.priceCurrency ?? null,
    });

    return transfer;
  }

  async acceptTransfer(userId: string, transferId: string) {
    const { transfer, previousOwnerId, record } =
      await this.ownership.acceptTransfer({
        transferId,
        recipientUserId: userId,
      });

    await this.appendEvent(transfer.carpetId, 'transfer_accepted', userId, {
      transferId: transfer.id,
    });
    await this.appendEvent(transfer.carpetId, 'ownership_changed', userId, {
      fromUserId: previousOwnerId,
      toUserId: userId,
      ownerName: record.ownerName,
      acquisitionType: record.acquisitionType,
      verified: true,
    });

    return { transfer, record };
  }

  async declineTransfer(userId: string, transferId: string) {
    const transfer = await this.ownership.declineTransfer(transferId, userId);
    await this.restoreCertifiedStatus(transfer.carpetId);
    await this.appendEvent(transfer.carpetId, 'transfer_declined', userId, {
      transferId,
    });
    return transfer;
  }

  async cancelTransfer(userId: string, transferId: string) {
    const transfer = await this.ownership.cancelTransfer(transferId, userId);
    await this.restoreCertifiedStatus(transfer.carpetId);
    await this.appendEvent(transfer.carpetId, 'transfer_cancelled', userId, {
      transferId,
    });
    return transfer;
  }

  private async restoreCertifiedStatus(carpetId: string): Promise<void> {
    const carpet = await this.repository.findCarpetById(carpetId);
    if (carpet?.status === 'transferring') {
      await this.repository.updateCarpet(carpetId, { status: 'verified' });
    }
  }

  async getLedger(carpetId: string) {
    const events = await this.repository.listLedgerEvents(carpetId);
    return { events, verification: verifyLedger(events) };
  }

  // ==========================================================================
  // TOKENISATION
  // ==========================================================================

  async prepareTokenization(userId: string, carpetId: string) {
    const carpet = await this.getOwnedCarpet(userId, carpetId);
    if (!carpet.certificateNumber || !carpet.identity) {
      throw new BadRequestException('Only certified carpets can be tokenised');
    }

    const [photos, events, ownership] = await Promise.all([
      this.repository.listPhotos(carpetId),
      this.repository.listLedgerEvents(carpetId),
      this.repository.listOwnership(carpetId),
    ]);

    const ledgerHeadHash = events.length
      ? events[events.length - 1].eventHash
      : null;
    const hashes = buildDocumentHash({
      carpetId,
      certificateNumber: carpet.certificateNumber,
      identity: carpet.identity,
      photos,
      ledgerHeadHash,
    });

    const metadata = this.tokenization.buildMetadata({
      carpet,
      identity: carpet.identity,
      documentHash: hashes.documentHash,
      photoSetHash: hashes.photoSetHash,
      identityHash: hashes.identityHash,
      ledgerHeadHash,
      coverPhotoId:
        carpet.profile.coverPhotoId ||
        photos.find((photo) => photo.shotType === 'full_front')?.id ||
        null,
      ownership,
    });

    return this.tokenization.buildPlan(metadata, hashes.documentHash);
  }

  async tokenize(
    userId: string,
    carpetId: string,
    recipientAddress?: string,
  ): Promise<CarpetToken> {
    await this.kyc.assertVerified(userId, 'tokenize');
    const carpet = await this.getOwnedCarpet(userId, carpetId);
    const plan = await this.prepareTokenization(userId, carpetId);

    const existing = await this.repository.getLatestToken(carpetId);
    if (existing && existing.status === 'confirmed') {
      throw new BadRequestException('This carpet has already been tokenised');
    }

    const tokenUri = `${this.publicProfileUrl(carpet.profile.slug)}/metadata`;
    const result = await this.tokenization.execute({
      carpetId,
      plan,
      tokenUri,
      recipientAddress,
    });
    const token = await this.repository.saveToken(result);

    await this.appendEvent(
      carpetId,
      result.standard === 'erc721' ? 'token_minted' : 'document_anchored',
      userId,
      {
        chain: token.chain,
        network: token.network,
        standard: token.standard,
        contractAddress: token.contractAddress,
        tokenId: token.tokenId,
        documentHash: token.documentHash,
        metadataHash: token.metadataHash,
        txHash: token.anchorTxHash,
      },
    );

    return token;
  }

  private publicProfileUrl(slug: string): string {
    return `/api/prug/profiles/${slug}`;
  }

  // ==========================================================================
  // PUBLIC PROFILE
  // ==========================================================================

  /**
   * The public face of a carpet: what a buyer sees before money changes hands.
   * Owner identity is reduced to a display name — the registry proves the chain
   * of custody without publishing who holds the rug today.
   */
  async getPublicProfile(identifier: string) {
    const carpet =
      (await this.repository.findCarpetByProfileSlug(identifier)) ||
      (await this.repository.findCarpetByCertificateNumber(
        identifier.toUpperCase(),
      ));

    if (!carpet) throw new NotFoundException('Carpet profile not found');
    if (carpet.profile.visibility === 'private') {
      throw new NotFoundException('This carpet profile is private');
    }

    const [photos, ownership, events, token, report] = await Promise.all([
      this.repository.listPhotos(carpet.id),
      this.repository.listOwnership(carpet.id),
      this.repository.listLedgerEvents(carpet.id),
      this.repository.getLatestToken(carpet.id),
      this.repository.latestForensicReport(carpet.id),
    ]);

    const verification = verifyLedger(events);
    const publicPhotos = photos.filter((photo) => photo.isPublic);

    return {
      slug: carpet.profile.slug,
      title: carpet.title,
      story: carpet.profile.story,
      status: carpet.status,
      certificate: carpet.certificateNumber
        ? {
            number: carpet.certificateNumber,
            issuedAt: carpet.certificateIssuedAt,
            verified: verification.valid,
          }
        : null,
      identity: carpet.identity,
      photos: publicPhotos.map((photo) => ({
        id: photo.id,
        shotType: photo.shotType,
        width: photo.width,
        height: photo.height,
        url: `${this.publicProfileUrl(carpet.profile.slug)}/photos/${photo.id}`,
      })),
      coverPhotoId: carpet.profile.coverPhotoId || publicPhotos[0]?.id || null,
      provenance: ownership.map((record) => ({
        ownerName: record.ownerName,
        ownerCountry: record.ownerCountry,
        acquisitionType: record.acquisitionType,
        acquiredAt: record.acquiredAt,
        releasedAt: record.releasedAt,
        isCurrent: record.isCurrent,
        // The distinction a buyer actually needs: who did Prug verify?
        verified: record.verified,
        source: record.source,
      })),
      integrity: {
        ledgerValid: verification.valid,
        eventCount: verification.eventCount,
        headHash: verification.headHash,
        riskLevel: report?.riskLevel ?? null,
      },
      token: token
        ? {
            chain: token.chain,
            network: token.network,
            standard: token.standard,
            contractAddress: token.contractAddress,
            tokenId: token.tokenId,
            txHash: token.anchorTxHash,
            documentHash: token.documentHash,
            status: token.status,
          }
        : null,
    };
  }

  async getPublicPhoto(
    slug: string,
    photoId: string,
  ): Promise<{ data: Buffer; mimeType: string }> {
    const carpet = await this.repository.findCarpetByProfileSlug(slug);
    if (!carpet || carpet.profile.visibility === 'private')
      throw new NotFoundException('Carpet profile not found');

    const photo = await this.repository.getPhoto(photoId);
    if (!photo || photo.carpetId !== carpet.id || !photo.isPublic)
      throw new NotFoundException('Photo not found');

    const data = await this.storage.get(photo.storageKey);
    if (!data)
      throw new NotFoundException('Photo bytes are no longer available');

    return { data, mimeType: photo.mimeType };
  }

  /** ERC-721 tokenURI document for a certified carpet. */
  async getPublicTokenMetadata(slug: string) {
    const carpet = await this.repository.findCarpetByProfileSlug(slug);
    if (!carpet || !carpet.certificateNumber || !carpet.identity) {
      throw new NotFoundException('No token metadata for this carpet');
    }

    const [photos, events, ownership] = await Promise.all([
      this.repository.listPhotos(carpet.id),
      this.repository.listLedgerEvents(carpet.id),
      this.repository.listOwnership(carpet.id),
    ]);

    const ledgerHeadHash = events.length
      ? events[events.length - 1].eventHash
      : null;
    const hashes = buildDocumentHash({
      carpetId: carpet.id,
      certificateNumber: carpet.certificateNumber,
      identity: carpet.identity,
      photos,
      ledgerHeadHash,
    });

    return this.tokenization.buildMetadata({
      carpet,
      identity: carpet.identity,
      documentHash: hashes.documentHash,
      photoSetHash: hashes.photoSetHash,
      identityHash: hashes.identityHash,
      ledgerHeadHash,
      coverPhotoId:
        carpet.profile.coverPhotoId ||
        photos.find((photo) => photo.isPublic)?.id ||
        null,
      ownership,
    });
  }

  // ==========================================================================

  private async appendEvent(
    carpetId: string,
    eventType: LedgerEventType,
    actorUserId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.repository.appendLedgerEvent({
      carpetId,
      eventType,
      payload,
      actorUserId,
    });
  }

  /** Capture plan for clients rendering the guided flow. */
  get captureLimits() {
    return { maxPhotos: MAX_PHOTOS };
  }
}
