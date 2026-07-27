import { ConfigService } from '@nestjs/config';
import {
  AttestationMode,
  AttestationVerifier,
  DeviceAttestationService,
} from './device-attestation.service';

function build(mode: AttestationMode) {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'PRUG_ATTESTATION_MODE' ? mode : fallback,
    ),
  } as unknown as ConfigService;

  return new DeviceAttestationService(config);
}

const passingVerifier: AttestationVerifier = {
  platform: 'ios',
  provider: 'app_attest',
  verify: async () => ({ valid: true }),
};

const failingVerifier: AttestationVerifier = {
  platform: 'ios',
  provider: 'app_attest',
  verify: async () => ({
    valid: false,
    reason: 'Signature does not match Apple root',
  }),
};

describe('DeviceAttestationService', () => {
  it('skips verification when attestation is off', async () => {
    const result = await build('off').verify({
      platform: 'ios',
      token: 'anything',
      nonce: 'n',
    });

    expect(result).toEqual({
      status: 'skipped',
      provider: 'none',
      acceptable: true,
    });
  });

  it('never reports success for a token nothing checked', async () => {
    // The whole point: an unverified token must not be recorded as verified,
    // or the risk engine would trust a claim no one validated.
    const result = await build('optional').verify({
      platform: 'ios',
      token: 'unchecked-token',
      nonce: 'n',
    });

    expect(result.status).toBe('unavailable');
    expect(result.acceptable).toBe(true);
  });

  it('blocks the session when attestation is required and no verifier exists', async () => {
    const result = await build('required').verify({
      platform: 'android',
      token: 'token',
      nonce: 'n',
    });

    expect(result.status).toBe('unavailable');
    expect(result.acceptable).toBe(false);
    expect(result.reason).toContain('no verifier is configured');
  });

  it('blocks a required session with no token', async () => {
    const result = await build('required').verify({
      platform: 'ios',
      nonce: 'n',
    });

    expect(result.status).toBe('missing');
    expect(result.acceptable).toBe(false);
  });

  it('accepts a verified token', async () => {
    const service = build('required');
    service.register(passingVerifier);

    const result = await service.verify({
      platform: 'ios',
      token: 'good',
      nonce: 'n',
    });

    expect(result).toEqual({
      status: 'verified',
      provider: 'app_attest',
      acceptable: true,
    });
  });

  it('refuses a token that was checked and rejected, even in optional mode', async () => {
    // A failed check is different from an absent one: something claimed to be
    // an attested device and the claim was false.
    const service = build('optional');
    service.register(failingVerifier);

    const result = await service.verify({
      platform: 'ios',
      token: 'forged',
      nonce: 'n',
    });

    expect(result.status).toBe('failed');
    expect(result.acceptable).toBe(false);
    expect(result.reason).toContain('Apple root');
  });

  it('passes the session nonce to the verifier so attestations cannot be replayed', async () => {
    const verify = jest.fn().mockResolvedValue({ valid: true });
    const service = build('optional');
    service.register({ platform: 'ios', provider: 'app_attest', verify });

    await service.verify({ platform: 'ios', token: 'tok', nonce: 'nonce-123' });

    expect(verify).toHaveBeenCalledWith('tok', 'nonce-123');
  });

  it('treats a verifier crash as unchecked rather than verified', async () => {
    const service = build('optional');
    service.register({
      platform: 'ios',
      provider: 'app_attest',
      verify: async () => {
        throw new Error('Apple endpoint unreachable');
      },
    });

    const result = await service.verify({
      platform: 'ios',
      token: 'tok',
      nonce: 'n',
    });

    expect(result.status).toBe('error');
    expect(result.acceptable).toBe(true); // optional mode tolerates it
  });

  it('cannot attest a browser, and says so when attestation is required', async () => {
    expect(
      (await build('optional').verify({ platform: 'web', nonce: 'n' }))
        .acceptable,
    ).toBe(true);

    const required = await build('required').verify({
      platform: 'web',
      nonce: 'n',
    });
    expect(required.status).toBe('unsupported');
    expect(required.acceptable).toBe(false);
  });
});
