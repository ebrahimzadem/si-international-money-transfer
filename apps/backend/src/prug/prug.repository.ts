/**
 * Prug data access.
 *
 * Raw `pg` queries, matching the pattern used by the wallets and transactions
 * services. The ledger append is the one place that needs a transaction: the
 * sequence number and previous-hash link must be read and written atomically.
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import {
  AcquisitionType,
  CarpetIdentity,
  CarpetRecord,
  CarpetStatus,
  CarpetToken,
  CarpetTransfer,
  DeclaredAttributes,
  ForensicReport,
  LedgerEvent,
  LedgerEventType,
  OwnershipRecord,
  PrugPhoto,
  RiskLevel,
  ShotType,
  TransferStatus,
} from './prug.types';
import { hashPayload, linkEvent } from './identity/ledger';

export type ProfileVisibility = 'public' | 'unlisted' | 'private';

export interface CarpetProfile {
  slug: string;
  visibility: ProfileVisibility;
  story: string | null;
  coverPhotoId: string | null;
}

export interface CarpetRow extends CarpetRecord {
  profile: CarpetProfile;
}

export interface FingerprintCandidate {
  photoId: string;
  carpetId: string;
  ownerUserId: string;
  dhash: string;
  phash: string | null;
  shotType: ShotType;
  carpetStatus: CarpetStatus;
}

const CARPET_COLUMNS = `
  id, owner_user_id as "ownerUserId", status, title,
  declared, identity, identity_model as "identityModel",
  certificate_number as "certificateNumber", certificate_issued_at as "certificateIssuedAt",
  risk_score as "riskScore", risk_level as "riskLevel", review_notes as "reviewNotes",
  profile_slug as "profileSlug", profile_visibility as "profileVisibility",
  profile_story as "profileStory", cover_photo_id as "coverPhotoId",
  created_at as "createdAt", updated_at as "updatedAt"
`;

const PHOTO_COLUMNS = `
  id, carpet_id as "carpetId", shot_type as "shotType", position,
  storage_key as "storageKey", mime_type as "mimeType", byte_size as "byteSize",
  width, height, sha256, dhash, phash, metadata, findings,
  is_public as "isPublic", created_at as "createdAt"
`;

interface RawCarpet {
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
  profileSlug: string;
  profileVisibility: ProfileVisibility;
  profileStory: string | null;
  coverPhotoId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toCarpet(row: RawCarpet): CarpetRow {
  const {
    profileSlug,
    profileVisibility,
    profileStory,
    coverPhotoId,
    ...record
  } = row;
  return {
    ...record,
    riskScore: record.riskScore === null ? null : Number(record.riskScore),
    profile: {
      slug: profileSlug,
      visibility: profileVisibility,
      story: profileStory,
      coverPhotoId,
    },
  };
}

@Injectable()
export class PrugRepository implements OnModuleDestroy {
  private readonly logger = new Logger(PrugRepository.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl?.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.logger.log('Prug repository initialized');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  // ==========================================================================
  // CARPETS
  // ==========================================================================

  async createCarpet(input: {
    ownerUserId: string;
    title: string;
    declared: DeclaredAttributes;
    profileSlug: string;
  }): Promise<CarpetRow> {
    const result = await this.pool.query<RawCarpet>(
      `INSERT INTO prug_carpets (owner_user_id, title, declared, profile_slug)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING ${CARPET_COLUMNS}`,
      [
        input.ownerUserId,
        input.title,
        JSON.stringify(input.declared),
        input.profileSlug,
      ],
    );
    return toCarpet(result.rows[0]);
  }

  async findCarpetById(id: string): Promise<CarpetRow | null> {
    const result = await this.pool.query<RawCarpet>(
      `SELECT ${CARPET_COLUMNS} FROM prug_carpets WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toCarpet(result.rows[0]) : null;
  }

  async findCarpetsByOwner(ownerUserId: string): Promise<CarpetRow[]> {
    const result = await this.pool.query<RawCarpet>(
      `SELECT ${CARPET_COLUMNS} FROM prug_carpets WHERE owner_user_id = $1 ORDER BY created_at DESC`,
      [ownerUserId],
    );
    return result.rows.map(toCarpet);
  }

  async findCarpetByCertificateNumber(
    certificateNumber: string,
  ): Promise<CarpetRow | null> {
    const result = await this.pool.query<RawCarpet>(
      `SELECT ${CARPET_COLUMNS} FROM prug_carpets WHERE certificate_number = $1`,
      [certificateNumber],
    );
    return result.rows[0] ? toCarpet(result.rows[0]) : null;
  }

  async findCarpetByProfileSlug(slug: string): Promise<CarpetRow | null> {
    const result = await this.pool.query<RawCarpet>(
      `SELECT ${CARPET_COLUMNS} FROM prug_carpets WHERE profile_slug = $1`,
      [slug],
    );
    return result.rows[0] ? toCarpet(result.rows[0]) : null;
  }

  async profileSlugExists(slug: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM prug_carpets WHERE profile_slug = $1',
      [slug],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateCarpet(
    id: string,
    updates: Partial<{
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
      ownerUserId: string;
      profileVisibility: ProfileVisibility;
      profileStory: string | null;
      coverPhotoId: string | null;
    }>,
  ): Promise<CarpetRow> {
    const columnMap: Record<string, string> = {
      status: 'status',
      title: 'title',
      declared: 'declared',
      identity: 'identity',
      identityModel: 'identity_model',
      certificateNumber: 'certificate_number',
      certificateIssuedAt: 'certificate_issued_at',
      riskScore: 'risk_score',
      riskLevel: 'risk_level',
      reviewNotes: 'review_notes',
      ownerUserId: 'owner_user_id',
      profileVisibility: 'profile_visibility',
      profileStory: 'profile_story',
      coverPhotoId: 'cover_photo_id',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key];
      if (!column || value === undefined) continue;
      const cast = key === 'declared' || key === 'identity' ? '::jsonb' : '';
      setClauses.push(`${column} = $${index}${cast}`);
      values.push(cast ? JSON.stringify(value) : value);
      index++;
    }

    if (!setClauses.length) {
      const existing = await this.findCarpetById(id);
      if (!existing) throw new Error(`Carpet ${id} not found`);
      return existing;
    }

    values.push(id);
    const result = await this.pool.query<RawCarpet>(
      `UPDATE prug_carpets SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${index}
       RETURNING ${CARPET_COLUMNS}`,
      values,
    );
    return toCarpet(result.rows[0]);
  }

  // ==========================================================================
  // PHOTOS
  // ==========================================================================

  async addPhoto(
    photo: Omit<PrugPhoto, 'id' | 'createdAt'> & {
      isPublic: boolean;
      bands: number[];
    },
  ): Promise<PrugPhoto> {
    const result = await this.pool.query(
      `INSERT INTO prug_photos (
         carpet_id, shot_type, position, storage_key, mime_type, byte_size,
         width, height, sha256, dhash, phash, band0, band1, band2, band3,
         metadata, findings, is_public
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18)
       RETURNING ${PHOTO_COLUMNS}`,
      [
        photo.carpetId,
        photo.shotType,
        photo.position,
        photo.storageKey,
        photo.mimeType,
        photo.byteSize,
        photo.width,
        photo.height,
        photo.sha256,
        photo.dhash,
        photo.phash,
        photo.bands[0] ?? null,
        photo.bands[1] ?? null,
        photo.bands[2] ?? null,
        photo.bands[3] ?? null,
        JSON.stringify(photo.metadata),
        JSON.stringify(photo.findings),
        photo.isPublic,
      ],
    );
    return result.rows[0];
  }

  async listPhotos(
    carpetId: string,
  ): Promise<Array<PrugPhoto & { isPublic: boolean }>> {
    const result = await this.pool.query(
      `SELECT ${PHOTO_COLUMNS} FROM prug_photos WHERE carpet_id = $1 ORDER BY position ASC`,
      [carpetId],
    );
    return result.rows;
  }

  async getPhoto(
    photoId: string,
  ): Promise<(PrugPhoto & { isPublic: boolean }) | null> {
    const result = await this.pool.query(
      `SELECT ${PHOTO_COLUMNS} FROM prug_photos WHERE id = $1`,
      [photoId],
    );
    return result.rows[0] || null;
  }

  async deletePhoto(photoId: string): Promise<void> {
    await this.pool.query('DELETE FROM prug_photos WHERE id = $1', [photoId]);
  }

  async setPhotoVisibility(photoId: string, isPublic: boolean): Promise<void> {
    await this.pool.query(
      'UPDATE prug_photos SET is_public = $1 WHERE id = $2',
      [isPublic, photoId],
    );
  }

  async nextPhotoPosition(carpetId: string): Promise<number> {
    const result = await this.pool.query<{ next: string }>(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM prug_photos WHERE carpet_id = $1',
      [carpetId],
    );
    return Number(result.rows[0].next);
  }

  /**
   * Locality-sensitive lookup: any photo sharing at least one 16-bit band with
   * the query hash is a candidate, and the exact Hamming distance is computed
   * in the service. This keeps the index selective without a bitwise scan.
   */
  async findFingerprintCandidates(
    bands: number[],
    excludeCarpetId: string,
    limit = 200,
  ): Promise<FingerprintCandidate[]> {
    const result = await this.pool.query<FingerprintCandidate>(
      `SELECT p.id as "photoId", p.carpet_id as "carpetId", c.owner_user_id as "ownerUserId",
              p.dhash, p.phash, p.shot_type as "shotType", c.status as "carpetStatus"
       FROM prug_photos p
       JOIN prug_carpets c ON c.id = p.carpet_id
       WHERE p.carpet_id <> $1
         AND p.dhash IS NOT NULL
         AND c.status <> 'rejected'
         AND (p.band0 = $2 OR p.band1 = $3 OR p.band2 = $4 OR p.band3 = $5)
       LIMIT $6`,
      [excludeCarpetId, bands[0], bands[1], bands[2], bands[3], limit],
    );
    return result.rows;
  }

  // ==========================================================================
  // FORENSIC REPORTS
  // ==========================================================================

  async saveForensicReport(
    carpetId: string,
    report: ForensicReport,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO prug_forensic_reports (carpet_id, risk_score, risk_level, verdict, findings, coverage, registry_matches, vision_model)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
      [
        carpetId,
        report.riskScore,
        report.riskLevel,
        report.verdict,
        JSON.stringify(report.findings),
        JSON.stringify(report.coverage),
        JSON.stringify(report.registryMatches),
        report.visionModel || null,
      ],
    );
  }

  async latestForensicReport(carpetId: string): Promise<ForensicReport | null> {
    const result = await this.pool.query(
      `SELECT risk_score as "riskScore", risk_level as "riskLevel", verdict, findings,
              coverage, registry_matches as "registryMatches", vision_model as "visionModel",
              created_at as "analyzedAt"
       FROM prug_forensic_reports
       WHERE carpet_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [carpetId],
    );
    if (!result.rows[0]) return null;
    return { ...result.rows[0], riskScore: Number(result.rows[0].riskScore) };
  }

  // ==========================================================================
  // OWNERSHIP
  // ==========================================================================

  async addOwnershipRecord(input: {
    carpetId: string;
    ownerUserId: string | null;
    ownerName: string;
    ownerCountry?: string;
    acquisitionType: AcquisitionType;
    acquiredAt: Date | null;
    releasedAt: Date | null;
    isCurrent: boolean;
    verified: boolean;
    source: OwnershipRecord['source'];
    notes?: string;
  }): Promise<OwnershipRecord> {
    const result = await this.pool.query<OwnershipRecord>(
      `INSERT INTO prug_ownership_records
         (carpet_id, owner_user_id, owner_name, owner_country, acquisition_type,
          acquired_at, released_at, is_current, verified, source, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, carpet_id as "carpetId", owner_user_id as "ownerUserId", owner_name as "ownerName",
                 owner_country as "ownerCountry", acquisition_type as "acquisitionType",
                 acquired_at as "acquiredAt", released_at as "releasedAt", is_current as "isCurrent",
                 verified, source, notes`,
      [
        input.carpetId,
        input.ownerUserId,
        input.ownerName,
        input.ownerCountry || null,
        input.acquisitionType,
        input.acquiredAt,
        input.releasedAt,
        input.isCurrent,
        input.verified,
        input.source,
        input.notes || null,
      ],
    );
    return result.rows[0];
  }

  async listOwnership(carpetId: string): Promise<OwnershipRecord[]> {
    const result = await this.pool.query<OwnershipRecord>(
      `SELECT id, carpet_id as "carpetId", owner_user_id as "ownerUserId", owner_name as "ownerName",
              owner_country as "ownerCountry", acquisition_type as "acquisitionType",
              acquired_at as "acquiredAt", released_at as "releasedAt", is_current as "isCurrent",
              verified, source, notes
       FROM prug_ownership_records
       WHERE carpet_id = $1
       ORDER BY COALESCE(acquired_at, '-infinity'::timestamp) ASC, created_at ASC`,
      [carpetId],
    );
    return result.rows;
  }

  async closeCurrentOwnership(
    carpetId: string,
    releasedAt: Date,
  ): Promise<void> {
    await this.pool.query(
      'UPDATE prug_ownership_records SET is_current = false, released_at = $2 WHERE carpet_id = $1 AND is_current = true',
      [carpetId, releasedAt],
    );
  }

  // ==========================================================================
  // TRANSFERS
  // ==========================================================================

  async createTransfer(input: {
    carpetId: string;
    fromUserId: string;
    toEmail: string;
    message?: string;
    priceAmount?: string;
    priceCurrency?: string;
    expiresAt: Date;
  }): Promise<CarpetTransfer> {
    const result = await this.pool.query<CarpetTransfer>(
      `INSERT INTO prug_transfers (carpet_id, from_user_id, to_email, message, price_amount, price_currency, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, carpet_id as "carpetId", from_user_id as "fromUserId", to_email as "toEmail",
                 to_user_id as "toUserId", status, message, price_amount as "priceAmount",
                 price_currency as "priceCurrency", created_at as "createdAt",
                 responded_at as "respondedAt", expires_at as "expiresAt"`,
      [
        input.carpetId,
        input.fromUserId,
        input.toEmail.toLowerCase(),
        input.message || null,
        input.priceAmount || null,
        input.priceCurrency || null,
        input.expiresAt,
      ],
    );
    return result.rows[0];
  }

  async getTransfer(id: string): Promise<CarpetTransfer | null> {
    const result = await this.pool.query<CarpetTransfer>(
      `SELECT id, carpet_id as "carpetId", from_user_id as "fromUserId", to_email as "toEmail",
              to_user_id as "toUserId", status, message, price_amount as "priceAmount",
              price_currency as "priceCurrency", created_at as "createdAt",
              responded_at as "respondedAt", expires_at as "expiresAt"
       FROM prug_transfers WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  async listTransfers(filter: {
    carpetId?: string;
    toEmail?: string;
    status?: TransferStatus;
  }): Promise<CarpetTransfer[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (filter.carpetId) {
      clauses.push(`carpet_id = $${index++}`);
      values.push(filter.carpetId);
    }
    if (filter.toEmail) {
      clauses.push(`to_email = $${index++}`);
      values.push(filter.toEmail.toLowerCase());
    }
    if (filter.status) {
      clauses.push(`status = $${index++}`);
      values.push(filter.status);
    }

    const result = await this.pool.query<CarpetTransfer>(
      `SELECT id, carpet_id as "carpetId", from_user_id as "fromUserId", to_email as "toEmail",
              to_user_id as "toUserId", status, message, price_amount as "priceAmount",
              price_currency as "priceCurrency", created_at as "createdAt",
              responded_at as "respondedAt", expires_at as "expiresAt"
       FROM prug_transfers
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY created_at DESC`,
      values,
    );
    return result.rows;
  }

  async updateTransferStatus(
    id: string,
    status: TransferStatus,
    toUserId?: string | null,
  ): Promise<CarpetTransfer> {
    const result = await this.pool.query<CarpetTransfer>(
      `UPDATE prug_transfers
       SET status = $2, responded_at = NOW(), to_user_id = COALESCE($3, to_user_id)
       WHERE id = $1
       RETURNING id, carpet_id as "carpetId", from_user_id as "fromUserId", to_email as "toEmail",
                 to_user_id as "toUserId", status, message, price_amount as "priceAmount",
                 price_currency as "priceCurrency", created_at as "createdAt",
                 responded_at as "respondedAt", expires_at as "expiresAt"`,
      [id, status, toUserId ?? null],
    );
    return result.rows[0];
  }

  // ==========================================================================
  // LEDGER
  // ==========================================================================

  /**
   * Append one event to a carpet's hash chain.
   *
   * The carpet row is locked for the duration so concurrent writers cannot
   * claim the same sequence number or link to a stale head.
   */
  async appendLedgerEvent(input: {
    carpetId: string;
    eventType: LedgerEventType;
    payload: Record<string, unknown>;
    actorUserId: string | null;
  }): Promise<LedgerEvent> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT id FROM prug_carpets WHERE id = $1 FOR UPDATE',
        [input.carpetId],
      );

      const head = await client.query<{ sequence: number; eventHash: string }>(
        `SELECT sequence, event_hash as "eventHash"
         FROM prug_ledger_events
         WHERE carpet_id = $1
         ORDER BY sequence DESC
         LIMIT 1`,
        [input.carpetId],
      );

      const sequence = head.rows[0] ? Number(head.rows[0].sequence) + 1 : 1;
      const prevHash = head.rows[0]?.eventHash ?? '0'.repeat(64);
      const createdAt = new Date();
      const payloadHash = hashPayload(input.payload);
      const eventHash = linkEvent({
        carpetId: input.carpetId,
        sequence,
        eventType: input.eventType,
        payloadHash,
        prevHash,
        createdAt,
      });

      const result = await client.query<LedgerEvent>(
        `INSERT INTO prug_ledger_events
           (carpet_id, sequence, event_type, payload, payload_hash, prev_hash, event_hash, actor_user_id, created_at)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
         RETURNING id, carpet_id as "carpetId", sequence, event_type as "eventType", payload,
                   payload_hash as "payloadHash", prev_hash as "prevHash", event_hash as "eventHash",
                   actor_user_id as "actorUserId", created_at as "createdAt"`,
        [
          input.carpetId,
          sequence,
          input.eventType,
          JSON.stringify(input.payload),
          payloadHash,
          prevHash,
          eventHash,
          input.actorUserId,
          createdAt,
        ],
      );

      await client.query('COMMIT');
      return { ...result.rows[0], sequence: Number(result.rows[0].sequence) };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to append ledger event: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async listLedgerEvents(carpetId: string): Promise<LedgerEvent[]> {
    const result = await this.pool.query<LedgerEvent>(
      `SELECT id, carpet_id as "carpetId", sequence, event_type as "eventType", payload,
              payload_hash as "payloadHash", prev_hash as "prevHash", event_hash as "eventHash",
              actor_user_id as "actorUserId", created_at as "createdAt"
       FROM prug_ledger_events
       WHERE carpet_id = $1
       ORDER BY sequence ASC`,
      [carpetId],
    );
    return result.rows.map((row) => ({
      ...row,
      sequence: Number(row.sequence),
    }));
  }

  // ==========================================================================
  // TOKENS
  // ==========================================================================

  async saveToken(
    input: Omit<CarpetToken, 'id' | 'createdAt'>,
  ): Promise<CarpetToken> {
    const result = await this.pool.query<CarpetToken>(
      `INSERT INTO prug_tokens
         (carpet_id, chain, network, standard, contract_address, token_id, token_uri,
          metadata_hash, document_hash, anchor_tx_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, carpet_id as "carpetId", chain, network, standard,
                 contract_address as "contractAddress", token_id as "tokenId", token_uri as "tokenUri",
                 metadata_hash as "metadataHash", document_hash as "documentHash",
                 anchor_tx_hash as "anchorTxHash", status, created_at as "createdAt"`,
      [
        input.carpetId,
        input.chain,
        input.network,
        input.standard,
        input.contractAddress,
        input.tokenId,
        input.tokenUri,
        input.metadataHash,
        input.documentHash,
        input.anchorTxHash,
        input.status,
      ],
    );
    return result.rows[0];
  }

  async getLatestToken(carpetId: string): Promise<CarpetToken | null> {
    const result = await this.pool.query<CarpetToken>(
      `SELECT id, carpet_id as "carpetId", chain, network, standard,
              contract_address as "contractAddress", token_id as "tokenId", token_uri as "tokenUri",
              metadata_hash as "metadataHash", document_hash as "documentHash",
              anchor_tx_hash as "anchorTxHash", status, created_at as "createdAt"
       FROM prug_tokens
       WHERE carpet_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [carpetId],
    );
    return result.rows[0] || null;
  }

  async updateTokenStatus(
    id: string,
    status: CarpetToken['status'],
    anchorTxHash?: string,
    tokenId?: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE prug_tokens
       SET status = $2,
           anchor_tx_hash = COALESCE($3, anchor_tx_hash),
           token_id = COALESCE($4, token_id)
       WHERE id = $1`,
      [id, status, anchorTxHash ?? null, tokenId ?? null],
    );
  }

  // ==========================================================================
  // USER LOOKUPS (KYC gate + transfer targeting)
  // ==========================================================================

  async findUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    fullName: string | null;
    kycStatus: string;
  } | null> {
    const result = await this.pool.query(
      `SELECT id, email, full_name as "fullName", kyc_status as "kycStatus"
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    return result.rows[0] || null;
  }

  async findUserById(id: string): Promise<{
    id: string;
    email: string;
    fullName: string | null;
    kycStatus: string;
  } | null> {
    const result = await this.pool.query(
      `SELECT id, email, full_name as "fullName", kyc_status as "kycStatus"
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }
}
