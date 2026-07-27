/**
 * Tamper-evident provenance ledger.
 *
 * Each event hashes its own payload and the previous event's hash, so any
 * edit to history invalidates every event after it. The chain is verifiable
 * by anyone holding the events — no trust in the database is required.
 */

import { createHash } from 'crypto';
import { LedgerEvent, LedgerEventType } from '../prug.types';

export const GENESIS_HASH = '0'.repeat(64);

/**
 * Canonical JSON: keys sorted at every level so the same logical payload
 * always hashes to the same digest regardless of property order.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => `${JSON.stringify(key)}:${canonicalize(v)}`);

  return `{${entries.join(',')}}`;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashPayload(payload: Record<string, unknown>): string {
  return sha256Hex(canonicalize(payload));
}

/** Compute an event's hash from its position in the chain. */
export function linkEvent(input: {
  carpetId: string;
  sequence: number;
  eventType: LedgerEventType;
  payloadHash: string;
  prevHash: string;
  createdAt: Date;
}): string {
  return sha256Hex(
    [
      input.prevHash,
      input.carpetId,
      String(input.sequence),
      input.eventType,
      input.payloadHash,
      input.createdAt.toISOString(),
    ].join('|'),
  );
}

export interface LedgerVerification {
  valid: boolean;
  eventCount: number;
  headHash: string | null;
  /** Sequence numbers where the chain breaks, with the reason. */
  breaks: Array<{ sequence: number; reason: string }>;
}

/** Recompute every hash and link in a carpet's chain. */
export function verifyLedger(events: LedgerEvent[]): LedgerVerification {
  const breaks: LedgerVerification['breaks'] = [];
  let expectedPrev = GENESIS_HASH;
  let expectedSequence = 1;

  for (const event of events) {
    if (event.sequence !== expectedSequence) {
      breaks.push({
        sequence: event.sequence,
        reason: `Expected sequence ${expectedSequence}`,
      });
    }

    if (event.prevHash !== expectedPrev) {
      breaks.push({
        sequence: event.sequence,
        reason: 'Previous-hash link does not match the preceding event',
      });
    }

    const payloadHash = hashPayload(event.payload);
    if (payloadHash !== event.payloadHash) {
      breaks.push({
        sequence: event.sequence,
        reason: 'Payload has been modified since it was recorded',
      });
    }

    const eventHash = linkEvent({
      carpetId: event.carpetId,
      sequence: event.sequence,
      eventType: event.eventType,
      payloadHash: event.payloadHash,
      prevHash: event.prevHash,
      createdAt: new Date(event.createdAt),
    });
    if (eventHash !== event.eventHash) {
      breaks.push({
        sequence: event.sequence,
        reason: 'Event hash does not match its contents',
      });
    }

    expectedPrev = event.eventHash;
    expectedSequence = event.sequence + 1;
  }

  return {
    valid: breaks.length === 0,
    eventCount: events.length,
    headHash: events.length ? events[events.length - 1].eventHash : null,
    breaks,
  };
}
