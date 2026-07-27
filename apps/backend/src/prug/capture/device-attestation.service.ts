/**
 * Device attestation.
 *
 * The capture session proves *when* a photo was taken. Attestation is what
 * proves the caller is the genuine Prug app on a genuine device, rather than a
 * script replaying the API with stored images — which is the attack the frame
 * tokens alone cannot stop.
 *
 * Verification is platform-specific and needs credentials Prug does not ship:
 *   iOS      Apple App Attest — validate the CBOR attestation object against
 *            Apple's root certificate, check the nonce in the client data hash,
 *            then track the assertion counter per key.
 *   Android  Play Integrity — decode the token through the Play Integrity API
 *            with a service account and check verdicts plus the nonce.
 *
 * Until a verifier is registered, this service reports `unavailable` and the
 * configured mode decides what that means. It never reports success for an
 * unchecked token: a permissive stub would be worse than no attestation at
 * all, because the risk engine would trust it.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttestationStatus } from '../prug.types';

export type AttestationMode = 'required' | 'optional' | 'off';

export interface AttestationRequest {
  platform: 'ios' | 'android' | 'web';
  token?: string;
  /** Session nonce the client must have embedded in the attestation. */
  nonce: string;
}

export interface AttestationResult {
  status: AttestationStatus;
  provider: 'app_attest' | 'play_integrity' | 'none';
  /** False when the session must be refused. */
  acceptable: boolean;
  reason?: string;
}

/** Implemented per platform and registered at bootstrap. */
export interface AttestationVerifier {
  readonly platform: 'ios' | 'android';
  readonly provider: 'app_attest' | 'play_integrity';
  verify(
    token: string,
    nonce: string,
  ): Promise<{ valid: boolean; reason?: string }>;
}

@Injectable()
export class DeviceAttestationService {
  private readonly logger = new Logger(DeviceAttestationService.name);
  private readonly mode: AttestationMode;
  private readonly verifiers = new Map<string, AttestationVerifier>();

  constructor(private readonly configService: ConfigService) {
    this.mode = this.configService.get<AttestationMode>(
      'PRUG_ATTESTATION_MODE',
      'optional',
    );

    if (this.mode === 'required') {
      this.logger.log('Device attestation is required for capture sessions');
    }
  }

  /** Register a platform verifier at bootstrap. */
  register(verifier: AttestationVerifier): void {
    this.verifiers.set(verifier.platform, verifier);
    this.logger.log(
      `Registered ${verifier.provider} verifier for ${verifier.platform}`,
    );
  }

  get attestationMode(): AttestationMode {
    return this.mode;
  }

  async verify(request: AttestationRequest): Promise<AttestationResult> {
    if (this.mode === 'off') {
      return { status: 'skipped', provider: 'none', acceptable: true };
    }

    const required = this.mode === 'required';

    if (request.platform === 'web') {
      // Browsers have no equivalent primitive; a web capture session can never
      // be attested and is only allowed where attestation is optional.
      return {
        status: 'unsupported',
        provider: 'none',
        acceptable: !required,
        reason: required
          ? 'This deployment requires an attested mobile device; capture from a browser is not accepted.'
          : undefined,
      };
    }

    if (!request.token) {
      return {
        status: 'missing',
        provider: 'none',
        acceptable: !required,
        reason: required
          ? 'A device attestation token is required to open a capture session.'
          : undefined,
      };
    }

    const verifier = this.verifiers.get(request.platform);
    if (!verifier) {
      this.logger.warn(
        `No attestation verifier registered for ${request.platform}; token cannot be checked`,
      );
      return {
        status: 'unavailable',
        provider: 'none',
        acceptable: !required,
        reason: required
          ? 'Device attestation is required but no verifier is configured on this deployment.'
          : undefined,
      };
    }

    try {
      const result = await verifier.verify(request.token, request.nonce);
      if (result.valid) {
        return {
          status: 'verified',
          provider: verifier.provider,
          acceptable: true,
        };
      }

      // A token that was checked and rejected is refused regardless of mode:
      // this is a failed check, not an absent one.
      return {
        status: 'failed',
        provider: verifier.provider,
        acceptable: false,
        reason: result.reason || 'Device attestation failed.',
      };
    } catch (error) {
      this.logger.error(`Attestation verification error: ${error.message}`);
      return {
        status: 'error',
        provider: verifier.provider,
        acceptable: !required,
        reason: required
          ? 'Device attestation could not be completed.'
          : undefined,
      };
    }
  }
}
