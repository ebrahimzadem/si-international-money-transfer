/**
 * Certificate numbers, profile slugs, and the document hash that binds a
 * certificate to the exact photos and identity it was issued from.
 */

import { createHash } from 'crypto';
import { CarpetIdentity, PrugPhoto } from '../prug.types';
import { canonicalize, sha256Hex } from './ledger';

/** Crockford base32 without I, L, O and U, so serials are unambiguous aloud. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function base32(bytes: Buffer, length: number): string {
  let output = '';
  for (let i = 0; i < length; i++) {
    output += ALPHABET[bytes[i % bytes.length] % ALPHABET.length];
  }
  return output;
}

/** Damm-style checksum over the serial body, for transcription errors. */
function checksum(body: string): string {
  let total = 0;
  for (let i = 0; i < body.length; i++) {
    total = (total * 31 + ALPHABET.indexOf(body[i]) + 1) % 997;
  }
  return String(total).padStart(3, '0');
}

/**
 * Derive the public certificate number, e.g. `PRUG-7QK3M9WX-482`.
 * Deterministic from the carpet id, so it can be recomputed but not guessed
 * without knowing the id.
 */
export function buildCertificateNumber(carpetId: string): string {
  const digest = createHash('sha256')
    .update(`prug:certificate:${carpetId}`)
    .digest();
  const body = base32(digest, 8);
  return `PRUG-${body}-${checksum(body)}`;
}

export function isValidCertificateNumber(value: string): boolean {
  const match = /^PRUG-([0-9A-HJKMNP-TV-Z]{8})-(\d{3})$/.exec(
    value.trim().toUpperCase(),
  );
  return !!match && checksum(match[1]) === match[2];
}

const SLUG_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'carpet',
  'rug',
  'and',
  'of',
]);

/**
 * Human-readable profile handle, e.g. `tabriz-medallion-7qk3m9`.
 * The suffix keeps it unique; the caller retries with a fresh suffix on collision.
 */
export function buildProfileSlug(
  title: string,
  seed: string,
  attempt = 0,
): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word && !SLUG_STOPWORDS.has(word))
    .slice(0, 4);

  const stem = words.join('-').slice(0, 48) || 'carpet';
  const digest = createHash('sha256').update(`${seed}:${attempt}`).digest();
  const suffix = base32(digest, 6).toLowerCase();

  return `${stem}-${suffix}`;
}

/**
 * The document hash committed to the ledger — and, when tokenised, on chain.
 *
 * It is a Merkle-style fold over the photo digests plus the identity document,
 * so a certificate can be proven to describe these photos and no others.
 */
export function buildDocumentHash(input: {
  carpetId: string;
  certificateNumber: string;
  identity: CarpetIdentity;
  photos: Array<Pick<PrugPhoto, 'id' | 'sha256' | 'shotType'>>;
  ledgerHeadHash: string | null;
}): { documentHash: string; photoSetHash: string; identityHash: string } {
  const photoSetHash = sha256Hex(
    input.photos
      .map((photo) => `${photo.shotType}:${photo.sha256}`)
      .sort()
      .join('|'),
  );

  const identityHash = sha256Hex(
    canonicalize(input.identity as unknown as Record<string, unknown>),
  );

  const documentHash = sha256Hex(
    [
      'prug-document-v1',
      input.carpetId,
      input.certificateNumber,
      identityHash,
      photoSetHash,
      input.ledgerHeadHash || '',
    ].join('|'),
  );

  return { documentHash, photoSetHash, identityHash };
}
