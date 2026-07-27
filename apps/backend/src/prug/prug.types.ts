/**
 * Shared types for Prug — the handwoven-carpet identity agent.
 *
 * A Prug record ("شناسنامه فرش" / carpet birth certificate) is built from a
 * guided photo set, an AI-extracted identity document, a fraud-detection
 * report, a KYC-gated owner, a tamper-evident provenance ledger, and an
 * optional on-chain token.
 */

/** Every photo angle the capture flow understands. */
export type ShotType =
  | 'full_front'
  | 'full_back'
  | 'corner'
  | 'fringe_end'
  | 'knot_macro'
  | 'pile_macro'
  | 'edge_selvedge'
  | 'signature'
  | 'field_detail'
  | 'defect'
  | 'label'
  | 'measurement';

export type CarpetStatus =
  | 'draft'
  | 'analyzing'
  | 'verified'
  | 'manual_review'
  | 'rejected'
  | 'transferring';

export type RiskLevel = 'low' | 'medium' | 'high' | 'severe';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type FindingSource =
  | 'metadata'
  | 'pixel'
  | 'cross_photo'
  | 'registry'
  | 'vision';

export interface ForensicFinding {
  /** Stable machine code, e.g. 'editor_software' or 'duplicate_registration'. */
  code: string;
  severity: FindingSeverity;
  source: FindingSource;
  /** English explanation shown to reviewers. */
  message: string;
  /** Persian explanation shown to the owner. */
  messageFa?: string;
  /** Photo this finding relates to, when photo-specific. */
  photoId?: string;
  /** Contribution to the 0-100 risk score. */
  weight: number;
  details?: Record<string, unknown>;
}

export interface PhotoMetadataSummary {
  format: 'jpeg' | 'png';
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
  hasExif: boolean;
  cameraMake?: string;
  cameraModel?: string;
  software?: string;
  dateTimeOriginal?: string;
  modifyDate?: string;
  gps?: { latitude: number; longitude: number };
  /** Editor and provenance markers found in the container. */
  markers: {
    adobeApp14: boolean;
    photoshopIrb: boolean;
    c2pa: boolean;
    xmpHistory: boolean;
    aiGenerator?: string;
  };
  jpegQuality?: number;
  progressive?: boolean;
  trailingBytes: number;
  /** Null when the format could not be decoded to pixels. */
  fingerprint: { dhash: string; phash: string } | null;
}

export interface PrugPhoto {
  id: string;
  carpetId: string;
  shotType: ShotType;
  position: number;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  dhash: string | null;
  phash: string | null;
  metadata: PhotoMetadataSummary;
  findings: ForensicFinding[];
  createdAt: Date;
}

/** Owner-declared facts, used as a prior and cross-checked against the photos. */
export interface DeclaredAttributes {
  title?: string;
  originCountry?: string;
  originRegion?: string;
  weaverName?: string;
  knotType?: 'persian_asymmetric' | 'turkish_symmetric' | 'jufti' | 'unknown';
  materials?: string[];
  lengthCm?: number;
  widthCm?: number;
  estimatedYear?: number;
  purchasePrice?: { amount: number; currency: string };
  notes?: string;
}

/** The AI-extracted identity document — the substance of the شناسنامه. */
export interface CarpetIdentity {
  originCountry: string;
  originRegion: string;
  designFamily: string;
  motifs: string[];
  knotType: string;
  estimatedKnotDensity: string;
  pileMaterial: string;
  warpMaterial: string;
  weftMaterial: string;
  dyeAssessment: string;
  estimatedAgeRange: string;
  dominantColors: string[];
  estimatedDimensions: string;
  condition: string;
  defects: string[];
  distinguishingMarks: string[];
  summaryEn: string;
  summaryFa: string;
  /** 0-1 self-reported confidence from the vision pass. */
  confidence: number;
  /** Points where the photos contradict the owner's declaration. */
  declarationConflicts: string[];
}

export interface CoverageAssessment {
  /** Shot types the client still needs to capture. */
  missingShots: ShotType[];
  /** Photos whose content does not match the shot type they were filed under. */
  mismatchedPhotos: Array<{
    photoId: string;
    declared: ShotType;
    observed: string;
    note: string;
  }>;
  /** Photos that appear to show a different carpet than the rest of the set. */
  inconsistentSubjectPhotoIds: string[];
  /** Photos too blurry, dark or distant to assess. */
  unusablePhotoIds: string[];
  sameCarpetThroughout: boolean;
  notes: string;
}

export interface ForensicReport {
  riskScore: number;
  riskLevel: RiskLevel;
  verdict: 'pass' | 'review' | 'fail';
  findings: ForensicFinding[];
  coverage: CoverageAssessment | null;
  /** Photos matching an already-registered carpet. */
  registryMatches: Array<{
    photoId: string;
    matchedCarpetId: string;
    distance: number;
  }>;
  analyzedAt: Date;
  /** Model that produced the vision findings, when the AI pass ran. */
  visionModel?: string;
}

export type AcquisitionType =
  | 'original_weaver'
  | 'purchase'
  | 'inheritance'
  | 'gift'
  | 'auction'
  | 'trade'
  | 'unknown';

export interface OwnershipRecord {
  id: string;
  carpetId: string;
  /** Null for historical owners who are not Prug users. */
  ownerUserId: string | null;
  ownerName: string;
  ownerCountry?: string;
  acquisitionType: AcquisitionType;
  acquiredAt: Date | null;
  releasedAt: Date | null;
  isCurrent: boolean;
  /** True only when the platform verified the party via KYC at handover time. */
  verified: boolean;
  source: 'declared' | 'kyc_verified' | 'platform_transfer';
  notes?: string;
}

export type LedgerEventType =
  | 'carpet_registered'
  | 'photos_submitted'
  | 'analysis_completed'
  | 'certificate_issued'
  | 'certificate_revoked'
  | 'historical_owner_declared'
  | 'transfer_initiated'
  | 'transfer_accepted'
  | 'transfer_declined'
  | 'transfer_cancelled'
  | 'ownership_changed'
  | 'token_minted'
  | 'document_anchored';

export interface LedgerEvent {
  id: string;
  carpetId: string;
  sequence: number;
  eventType: LedgerEventType;
  payload: Record<string, unknown>;
  payloadHash: string;
  prevHash: string;
  eventHash: string;
  actorUserId: string | null;
  createdAt: Date;
}

export type TransferStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'expired';

export interface CarpetTransfer {
  id: string;
  carpetId: string;
  fromUserId: string;
  toEmail: string;
  toUserId: string | null;
  status: TransferStatus;
  message?: string;
  priceAmount?: string;
  priceCurrency?: string;
  createdAt: Date;
  respondedAt: Date | null;
  expiresAt: Date;
}

export interface CarpetToken {
  id: string;
  carpetId: string;
  chain: string;
  network: string;
  standard: 'erc721' | 'anchor';
  contractAddress: string | null;
  tokenId: string | null;
  tokenUri: string | null;
  metadataHash: string;
  documentHash: string;
  anchorTxHash: string | null;
  status: 'prepared' | 'submitted' | 'confirmed' | 'failed';
  createdAt: Date;
}

export interface CarpetRecord {
  id: string;
  ownerUserId: string;
  status: CarpetStatus;
  title: string;
  declared: DeclaredAttributes;
  identity: CarpetIdentity | null;
  identityModel: string | null;
  certificateNumber: string | null;
  certificateIssuedAt: Date | null;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
