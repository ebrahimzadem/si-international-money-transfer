/**
 * The guided capture plan.
 *
 * Ten required frames establish identity (whole rug from both faces, all four
 * corners, both fringe ends, and macros of the knots and pile); up to ten more
 * optional frames document signatures, defects and repairs. Every count here
 * is enforced before analysis is allowed to run.
 */

import { ShotType } from '../prug.types';

export interface ShotSpec {
  type: ShotType;
  required: boolean;
  minCount: number;
  maxCount: number;
  labelEn: string;
  labelFa: string;
  guidanceEn: string;
  guidanceFa: string;
}

export const MIN_PHOTOS = 10;
export const MAX_PHOTOS = 20;

export const SHOT_LIST: ShotSpec[] = [
  {
    type: 'full_front',
    required: true,
    minCount: 1,
    maxCount: 2,
    labelEn: 'Full front',
    labelFa: 'نمای کامل رو',
    guidanceEn:
      'The whole carpet face-up, shot square from above, all four edges in frame.',
    guidanceFa: 'کل فرش از روبرو و از بالا، طوری که هر چهار لبه در کادر باشد.',
  },
  {
    type: 'full_back',
    required: true,
    minCount: 1,
    maxCount: 2,
    labelEn: 'Full back',
    labelFa: 'نمای کامل پشت',
    guidanceEn:
      'The whole carpet flipped over; the back reveals knot structure and repairs.',
    guidanceFa: 'کل پشت فرش؛ ساختار گره و رفوها از پشت مشخص می‌شود.',
  },
  {
    type: 'corner',
    required: true,
    minCount: 4,
    maxCount: 4,
    labelEn: 'Corners',
    labelFa: 'چهار گوشه',
    guidanceEn:
      'One frame per corner, close enough to read the border pattern and any wear.',
    guidanceFa:
      'از هر گوشه یک عکس، آن‌قدر نزدیک که نقش حاشیه و ساییدگی دیده شود.',
  },
  {
    type: 'fringe_end',
    required: true,
    minCount: 2,
    maxCount: 2,
    labelEn: 'Fringe ends',
    labelFa: 'دو سر ریشه',
    guidanceEn: 'Both ends of the warp fringe, including any kilim finish.',
    guidanceFa: 'هر دو سر ریشه به همراه گلیم‌بافت انتهایی.',
  },
  {
    type: 'knot_macro',
    required: true,
    minCount: 1,
    maxCount: 3,
    labelEn: 'Knot macro',
    labelFa: 'ماکرو گره',
    guidanceEn:
      'Close-up of the back, roughly a 10 cm square, sharp enough to count knots.',
    guidanceFa:
      'نمای نزدیک از پشت، حدود ۱۰ سانتی‌متر مربع، به‌قدری واضح که گره‌ها قابل شمارش باشد.',
  },
  {
    type: 'pile_macro',
    required: true,
    minCount: 1,
    maxCount: 3,
    labelEn: 'Pile macro',
    labelFa: 'ماکرو پرز',
    guidanceEn:
      'Close-up of the pile surface showing fibre, sheen and pile height.',
    guidanceFa:
      'نمای نزدیک از سطح پرز که جنس الیاف، درخشش و ارتفاع پرز را نشان دهد.',
  },
  {
    type: 'edge_selvedge',
    required: false,
    minCount: 0,
    maxCount: 2,
    labelEn: 'Selvedge',
    labelFa: 'شیرازه',
    guidanceEn: 'The bound side edge along its length.',
    guidanceFa: 'لبه کناری شیرازه‌شده در امتداد طول فرش.',
  },
  {
    type: 'signature',
    required: false,
    minCount: 0,
    maxCount: 2,
    labelEn: 'Signature / cartouche',
    labelFa: 'امضا / کتیبه',
    guidanceEn: 'Any woven signature, cartouche, date or workshop mark.',
    guidanceFa: 'هر امضا، کتیبه، تاریخ یا نشان کارگاه که در فرش بافته شده است.',
  },
  {
    type: 'field_detail',
    required: false,
    minCount: 0,
    maxCount: 3,
    labelEn: 'Field detail',
    labelFa: 'جزئیات متن',
    guidanceEn: 'The medallion or a distinctive motif in the field.',
    guidanceFa: 'ترنج یا یک نقش شاخص در متن فرش.',
  },
  {
    type: 'defect',
    required: false,
    minCount: 0,
    maxCount: 6,
    labelEn: 'Defects and repairs',
    labelFa: 'عیوب و رفو',
    guidanceEn: 'Each stain, moth damage, tear or repair as its own frame.',
    guidanceFa: 'هر لکه، آسیب بید، پارگی یا رفو در یک عکس جداگانه.',
  },
  {
    type: 'label',
    required: false,
    minCount: 0,
    maxCount: 2,
    labelEn: 'Label or tag',
    labelFa: 'برچسب',
    guidanceEn: 'Any sewn-on label, gallery tag or existing certificate.',
    guidanceFa: 'هر برچسب دوخته‌شده، اتیکت گالری یا شناسنامه قبلی.',
  },
  {
    type: 'measurement',
    required: false,
    minCount: 0,
    maxCount: 2,
    labelEn: 'Measurement',
    labelFa: 'اندازه‌گیری',
    guidanceEn: 'A tape measure laid along the length and the width.',
    guidanceFa: 'متر اندازه‌گیری در امتداد طول و عرض فرش.',
  },
];

export const SHOT_SPECS: Record<ShotType, ShotSpec> = SHOT_LIST.reduce(
  (accumulator, spec) => {
    accumulator[spec.type] = spec;
    return accumulator;
  },
  {} as Record<ShotType, ShotSpec>,
);

export const REQUIRED_PHOTO_COUNT = SHOT_LIST.filter((s) => s.required).reduce(
  (total, spec) => total + spec.minCount,
  0,
);

export interface CoverageStatus {
  complete: boolean;
  total: number;
  /** Required shot types that still need more frames. */
  missing: Array<{ type: ShotType; have: number; need: number }>;
  /** Shot types with more frames than the plan allows. */
  overfilled: Array<{ type: ShotType; have: number; max: number }>;
  counts: Record<string, number>;
}

export function countByShotType(shots: ShotType[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const shot of shots) {
    counts[shot] = (counts[shot] || 0) + 1;
  }
  return counts;
}

/** Evaluate a photo set against the plan. */
export function evaluateCoverage(shots: ShotType[]): CoverageStatus {
  const counts = countByShotType(shots);
  const missing: CoverageStatus['missing'] = [];
  const overfilled: CoverageStatus['overfilled'] = [];

  for (const spec of SHOT_LIST) {
    const have = counts[spec.type] || 0;
    if (spec.required && have < spec.minCount) {
      missing.push({ type: spec.type, have, need: spec.minCount });
    }
    if (have > spec.maxCount) {
      overfilled.push({ type: spec.type, have, max: spec.maxCount });
    }
  }

  return {
    complete:
      missing.length === 0 &&
      overfilled.length === 0 &&
      shots.length >= MIN_PHOTOS,
    total: shots.length,
    missing,
    overfilled,
    counts,
  };
}

/** True when another frame of this type may still be added. */
export function canAcceptShot(
  existing: ShotType[],
  candidate: ShotType,
): { ok: boolean; reason?: string } {
  if (existing.length >= MAX_PHOTOS) {
    return {
      ok: false,
      reason: `A carpet may have at most ${MAX_PHOTOS} photos`,
    };
  }

  const spec = SHOT_SPECS[candidate];
  if (!spec) {
    return { ok: false, reason: `Unknown shot type: ${candidate}` };
  }

  const have = existing.filter((shot) => shot === candidate).length;
  if (have >= spec.maxCount) {
    return {
      ok: false,
      reason: `At most ${spec.maxCount} photo(s) of type "${candidate}" are allowed`,
    };
  }

  return { ok: true };
}
