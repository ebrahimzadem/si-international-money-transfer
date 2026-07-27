import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  REQUIRED_PHOTO_COUNT,
  canAcceptShot,
  evaluateCoverage,
} from './shot-list';
import { ShotType } from '../prug.types';

/** The minimum complete set: the ten required frames. */
const COMPLETE_SET: ShotType[] = [
  'full_front',
  'full_back',
  'corner',
  'corner',
  'corner',
  'corner',
  'fringe_end',
  'fringe_end',
  'knot_macro',
  'pile_macro',
];

describe('capture plan', () => {
  it('requires exactly the documented number of frames', () => {
    expect(REQUIRED_PHOTO_COUNT).toBe(MIN_PHOTOS);
    expect(COMPLETE_SET).toHaveLength(MIN_PHOTOS);
  });

  it('accepts the minimum complete set', () => {
    const coverage = evaluateCoverage(COMPLETE_SET);

    expect(coverage.complete).toBe(true);
    expect(coverage.missing).toHaveLength(0);
    expect(coverage.total).toBe(10);
  });

  it('reports what is still missing', () => {
    const coverage = evaluateCoverage(['full_front', 'full_back', 'corner']);

    expect(coverage.complete).toBe(false);
    expect(coverage.missing).toEqual(
      expect.arrayContaining([
        { type: 'corner', have: 1, need: 4 },
        { type: 'fringe_end', have: 0, need: 2 },
        { type: 'knot_macro', have: 0, need: 1 },
        { type: 'pile_macro', have: 0, need: 1 },
      ]),
    );
  });

  it('stays complete when optional frames are added', () => {
    const coverage = evaluateCoverage([
      ...COMPLETE_SET,
      'signature',
      'defect',
      'defect',
    ]);

    expect(coverage.complete).toBe(true);
    expect(coverage.counts.defect).toBe(2);
  });

  it('reports a shot type submitted too many times', () => {
    const coverage = evaluateCoverage([...COMPLETE_SET, 'corner']);

    expect(coverage.complete).toBe(false);
    expect(coverage.overfilled).toEqual([{ type: 'corner', have: 5, max: 4 }]);
  });
});

describe('canAcceptShot', () => {
  it('accepts a shot type with room left', () => {
    expect(canAcceptShot(['corner', 'corner'], 'corner')).toEqual({ ok: true });
  });

  it('refuses a fifth corner', () => {
    const result = canAcceptShot(
      ['corner', 'corner', 'corner', 'corner'],
      'corner',
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('At most 4');
  });

  it('refuses anything past the overall cap', () => {
    const full = Array.from({ length: MAX_PHOTOS }, () => 'defect' as ShotType);
    const result = canAcceptShot(full, 'full_front');

    expect(result.ok).toBe(false);
    expect(result.reason).toContain(String(MAX_PHOTOS));
  });

  it('refuses an unknown shot type', () => {
    expect(canAcceptShot([], 'selfie' as ShotType).ok).toBe(false);
  });
});
