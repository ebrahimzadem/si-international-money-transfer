import {
  GENESIS_HASH,
  canonicalize,
  hashPayload,
  linkEvent,
  verifyLedger,
} from './ledger';
import { LedgerEvent, LedgerEventType } from '../prug.types';

const CARPET_ID = '11111111-2222-3333-4444-555555555555';

/** Build a well-formed chain, the way the repository does when appending. */
function buildChain(
  entries: Array<{
    eventType: LedgerEventType;
    payload: Record<string, unknown>;
  }>,
): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  let prevHash = GENESIS_HASH;

  entries.forEach((entry, index) => {
    const sequence = index + 1;
    const createdAt = new Date(Date.UTC(2026, 2, 14, 9, 0, index));
    const payloadHash = hashPayload(entry.payload);
    const eventHash = linkEvent({
      carpetId: CARPET_ID,
      sequence,
      eventType: entry.eventType,
      payloadHash,
      prevHash,
      createdAt,
    });

    events.push({
      id: `event-${sequence}`,
      carpetId: CARPET_ID,
      sequence,
      eventType: entry.eventType,
      payload: entry.payload,
      payloadHash,
      prevHash,
      eventHash,
      actorUserId: 'owner-1',
      createdAt,
    });

    prevHash = eventHash;
  });

  return events;
}

const CHAIN = () =>
  buildChain([
    { eventType: 'carpet_registered', payload: { title: 'Tabriz medallion' } },
    {
      eventType: 'certificate_issued',
      payload: { certificateNumber: 'PRUG-ABCDEFGH-123' },
    },
    { eventType: 'ownership_changed', payload: { toUserId: 'user-2' } },
  ]);

describe('canonicalize', () => {
  it('is independent of key order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it('sorts nested objects too', () => {
    expect(canonicalize({ outer: { z: 1, a: [{ y: 1, x: 2 }] } })).toBe(
      canonicalize({ outer: { a: [{ x: 2, y: 1 }], z: 1 } }),
    );
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it('drops undefined values so absent and undefined hash alike', () => {
    expect(hashPayload({ a: 1, b: undefined })).toBe(hashPayload({ a: 1 }));
  });
});

describe('verifyLedger', () => {
  it('accepts an intact chain', () => {
    const verification = verifyLedger(CHAIN());

    expect(verification.valid).toBe(true);
    expect(verification.eventCount).toBe(3);
    expect(verification.headHash).toHaveLength(64);
    expect(verification.breaks).toHaveLength(0);
  });

  it('accepts an empty chain', () => {
    expect(verifyLedger([])).toEqual({
      valid: true,
      eventCount: 0,
      headHash: null,
      breaks: [],
    });
  });

  it('detects an edited payload', () => {
    const events = CHAIN();
    events[1].payload = { certificateNumber: 'PRUG-FORGED0-999' };

    const verification = verifyLedger(events);
    expect(verification.valid).toBe(false);
    expect(
      verification.breaks.some((entry) => entry.reason.includes('modified')),
    ).toBe(true);
  });

  it('detects a removed event', () => {
    const events = CHAIN();
    events.splice(1, 1);

    const verification = verifyLedger(events);
    expect(verification.valid).toBe(false);
    expect(verification.breaks.length).toBeGreaterThan(0);
  });

  it('detects a re-linked chain where an event was replaced', () => {
    const events = CHAIN();
    events[2].prevHash = GENESIS_HASH;

    const verification = verifyLedger(events);
    expect(verification.valid).toBe(false);
    expect(
      verification.breaks.some((entry) =>
        entry.reason.includes('Previous-hash link'),
      ),
    ).toBe(true);
  });

  it('detects a back-dated event', () => {
    const events = CHAIN();
    events[0].createdAt = new Date(Date.UTC(2020, 0, 1));

    const verification = verifyLedger(events);
    expect(verification.valid).toBe(false);
    expect(
      verification.breaks.some((entry) =>
        entry.reason.includes('does not match its contents'),
      ),
    ).toBe(true);
  });

  it('detects an event inserted with a duplicate sequence number', () => {
    const events = CHAIN();
    events.splice(1, 0, { ...events[1], id: 'event-forged' });

    expect(verifyLedger(events).valid).toBe(false);
  });
});

describe('linkEvent', () => {
  it('changes when any component changes', () => {
    const base = {
      carpetId: CARPET_ID,
      sequence: 1,
      eventType: 'carpet_registered' as LedgerEventType,
      payloadHash: hashPayload({ a: 1 }),
      prevHash: GENESIS_HASH,
      createdAt: new Date(Date.UTC(2026, 2, 14)),
    };
    const hash = linkEvent(base);

    expect(linkEvent({ ...base, sequence: 2 })).not.toBe(hash);
    expect(linkEvent({ ...base, eventType: 'certificate_issued' })).not.toBe(
      hash,
    );
    expect(linkEvent({ ...base, payloadHash: hashPayload({ a: 2 }) })).not.toBe(
      hash,
    );
    expect(linkEvent({ ...base, prevHash: 'f'.repeat(64) })).not.toBe(hash);
  });
});
