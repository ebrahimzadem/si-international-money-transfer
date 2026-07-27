/**
 * KYC gate.
 *
 * A Prug certificate asserts that a specific, identity-verified person holds a
 * specific carpet — so identity verification is required at the two moments
 * that assertion is made: when a certificate is issued, and when ownership
 * changes hands. Drafting and photographing stay open so a new user can see
 * the flow before verifying.
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrugRepository } from '../prug.repository';

export type GatedAction =
  | 'issue_certificate'
  | 'transfer_out'
  | 'transfer_in'
  | 'tokenize';

export interface KycStatus {
  userId: string;
  email: string;
  fullName: string | null;
  verified: boolean;
  status: string;
}

const ACTION_LABELS: Record<GatedAction, { en: string; fa: string }> = {
  issue_certificate: {
    en: 'issue a carpet certificate',
    fa: 'صدور شناسنامه فرش',
  },
  transfer_out: { en: 'transfer a carpet', fa: 'انتقال فرش' },
  transfer_in: { en: 'receive a carpet', fa: 'دریافت فرش' },
  tokenize: { en: 'tokenise a carpet', fa: 'توکن‌سازی فرش' },
};

@Injectable()
export class PrugKycService {
  private readonly logger = new Logger(PrugKycService.name);
  private readonly required: boolean;

  constructor(
    private readonly repository: PrugRepository,
    private readonly configService: ConfigService,
  ) {
    // Disable only in development; a certificate from an unverified owner is
    // worth nothing to a future buyer.
    this.required =
      this.configService.get<string>('PRUG_KYC_REQUIRED', 'true') !== 'false';
    if (!this.required) {
      this.logger.warn(
        'PRUG_KYC_REQUIRED=false — certificates and transfers are not identity-gated',
      );
    }
  }

  async getStatus(userId: string): Promise<KycStatus | null> {
    const user = await this.repository.findUserById(userId);
    if (!user) return null;

    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.kycStatus,
      verified: user.kycStatus === 'verified',
    };
  }

  /** Throw unless the user has completed identity verification. */
  async assertVerified(
    userId: string,
    action: GatedAction,
  ): Promise<KycStatus> {
    const status = await this.getStatus(userId);
    if (!status) {
      throw new ForbiddenException('User not found');
    }

    if (!status.verified && this.required) {
      const label = ACTION_LABELS[action];
      throw new ForbiddenException({
        message: `Identity verification is required to ${label.en}. Your current KYC status is "${status.status}".`,
        messageFa: `برای ${label.fa} احراز هویت لازم است. وضعیت فعلی KYC شما «${status.status}» است.`,
        code: 'kyc_required',
        kycStatus: status.status,
      });
    }

    return status;
  }

  /** Whether the KYC gate is enforced in this deployment. */
  get enforced(): boolean {
    return this.required;
  }
}
