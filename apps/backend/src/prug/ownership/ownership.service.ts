/**
 * Ownership and provenance.
 *
 * Two kinds of owner live in the chain of custody:
 *   declared      — historical owners the registrant names (unverified by us)
 *   platform      — handovers Prug executed between two KYC-verified users
 *
 * The distinction is preserved forever and shown on the public profile, so a
 * buyer can see exactly which links in the chain the platform stands behind.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AcquisitionType,
  CarpetTransfer,
  OwnershipRecord,
} from '../prug.types';
import { PrugRepository } from '../prug.repository';
import { PrugKycService } from '../kyc/prug-kyc.service';

const TRANSFER_TTL_DAYS = 30;

export interface DeclaredOwnerInput {
  ownerName: string;
  ownerCountry?: string;
  acquisitionType: AcquisitionType;
  acquiredAt?: string;
  releasedAt?: string;
  notes?: string;
}

@Injectable()
export class OwnershipService {
  private readonly logger = new Logger(OwnershipService.name);

  constructor(
    private readonly repository: PrugRepository,
    private readonly kycService: PrugKycService,
  ) {}

  /** Open the current owner's record when a carpet is first registered. */
  async openInitialOwnership(input: {
    carpetId: string;
    ownerUserId: string;
    ownerName: string;
    ownerCountry?: string;
    acquisitionType: AcquisitionType;
    acquiredAt?: Date | null;
    verified: boolean;
  }): Promise<OwnershipRecord> {
    return this.repository.addOwnershipRecord({
      carpetId: input.carpetId,
      ownerUserId: input.ownerUserId,
      ownerName: input.ownerName,
      ownerCountry: input.ownerCountry,
      acquisitionType: input.acquisitionType,
      acquiredAt: input.acquiredAt ?? new Date(),
      releasedAt: null,
      isCurrent: true,
      verified: input.verified,
      source: input.verified ? 'kyc_verified' : 'declared',
    });
  }

  /**
   * Record a previous owner the registrant knows about. These are the people
   * who held the carpet before it entered the registry; Prug cannot verify
   * them, and the record says so.
   */
  async addDeclaredHistoricalOwner(
    carpetId: string,
    input: DeclaredOwnerInput,
  ): Promise<OwnershipRecord> {
    const acquiredAt = input.acquiredAt ? new Date(input.acquiredAt) : null;
    const releasedAt = input.releasedAt ? new Date(input.releasedAt) : null;

    if (acquiredAt && releasedAt && acquiredAt > releasedAt) {
      throw new BadRequestException('acquiredAt must be before releasedAt');
    }

    return this.repository.addOwnershipRecord({
      carpetId,
      ownerUserId: null,
      ownerName: input.ownerName,
      ownerCountry: input.ownerCountry,
      acquisitionType: input.acquisitionType,
      acquiredAt,
      releasedAt,
      isCurrent: false,
      verified: false,
      source: 'declared',
      notes: input.notes,
    });
  }

  async listOwnership(carpetId: string): Promise<OwnershipRecord[]> {
    return this.repository.listOwnership(carpetId);
  }

  /**
   * Start a handover. The carpet does not move until the recipient accepts,
   * so a mistyped address cannot lose a certificate.
   */
  async initiateTransfer(input: {
    carpetId: string;
    fromUserId: string;
    toEmail: string;
    message?: string;
    priceAmount?: string;
    priceCurrency?: string;
  }): Promise<CarpetTransfer> {
    await this.kycService.assertVerified(input.fromUserId, 'transfer_out');

    const sender = await this.repository.findUserById(input.fromUserId);
    if (sender && sender.email.toLowerCase() === input.toEmail.toLowerCase()) {
      throw new BadRequestException(
        'A carpet cannot be transferred to its current owner',
      );
    }

    const pending = await this.repository.listTransfers({
      carpetId: input.carpetId,
      status: 'pending',
    });
    if (pending.length) {
      throw new ConflictException(
        'A transfer is already pending for this carpet',
      );
    }

    const expiresAt = new Date(Date.now() + TRANSFER_TTL_DAYS * 86_400_000);
    const transfer = await this.repository.createTransfer({
      ...input,
      expiresAt,
    });

    this.logger.log(
      `Transfer ${transfer.id} opened for carpet ${input.carpetId}`,
    );
    return transfer;
  }

  /**
   * Complete a handover: close the outgoing owner's record, open the
   * recipient's, and hand back both so the caller can write the ledger events.
   */
  async acceptTransfer(input: {
    transferId: string;
    recipientUserId: string;
  }): Promise<{
    transfer: CarpetTransfer;
    previousOwnerId: string;
    record: OwnershipRecord;
  }> {
    const transfer = await this.repository.getTransfer(input.transferId);
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'pending') {
      throw new ConflictException(`Transfer is already ${transfer.status}`);
    }
    if (transfer.expiresAt.getTime() < Date.now()) {
      await this.repository.updateTransferStatus(transfer.id, 'expired');
      throw new ConflictException('Transfer has expired');
    }

    const recipient = await this.kycService.assertVerified(
      input.recipientUserId,
      'transfer_in',
    );
    if (recipient.email.toLowerCase() !== transfer.toEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This transfer was addressed to a different account',
      );
    }

    const now = new Date();
    await this.repository.closeCurrentOwnership(transfer.carpetId, now);

    const record = await this.repository.addOwnershipRecord({
      carpetId: transfer.carpetId,
      ownerUserId: recipient.userId,
      ownerName: recipient.fullName || recipient.email,
      acquisitionType: transfer.priceAmount ? 'purchase' : 'gift',
      acquiredAt: now,
      releasedAt: null,
      isCurrent: true,
      verified: true,
      source: 'platform_transfer',
    });

    const accepted = await this.repository.updateTransferStatus(
      transfer.id,
      'accepted',
      recipient.userId,
    );
    await this.repository.updateCarpet(transfer.carpetId, {
      ownerUserId: recipient.userId,
      status: 'verified',
    });

    this.logger.log(
      `Carpet ${transfer.carpetId} transferred to ${recipient.userId}`,
    );
    return { transfer: accepted, previousOwnerId: transfer.fromUserId, record };
  }

  async declineTransfer(
    transferId: string,
    recipientUserId: string,
  ): Promise<CarpetTransfer> {
    const transfer = await this.repository.getTransfer(transferId);
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'pending')
      throw new ConflictException(`Transfer is already ${transfer.status}`);

    const recipient = await this.repository.findUserById(recipientUserId);
    if (
      !recipient ||
      recipient.email.toLowerCase() !== transfer.toEmail.toLowerCase()
    ) {
      throw new ForbiddenException(
        'This transfer was addressed to a different account',
      );
    }

    return this.repository.updateTransferStatus(
      transferId,
      'declined',
      recipientUserId,
    );
  }

  async cancelTransfer(
    transferId: string,
    ownerUserId: string,
  ): Promise<CarpetTransfer> {
    const transfer = await this.repository.getTransfer(transferId);
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.fromUserId !== ownerUserId)
      throw new ForbiddenException('Only the sender can cancel a transfer');
    if (transfer.status !== 'pending')
      throw new ConflictException(`Transfer is already ${transfer.status}`);

    return this.repository.updateTransferStatus(transferId, 'cancelled');
  }

  async listIncomingTransfers(email: string): Promise<CarpetTransfer[]> {
    return this.repository.listTransfers({ toEmail: email, status: 'pending' });
  }

  async listCarpetTransfers(carpetId: string): Promise<CarpetTransfer[]> {
    return this.repository.listTransfers({ carpetId });
  }
}
