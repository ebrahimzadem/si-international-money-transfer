/**
 * JSON schemas for the agent's structured outputs.
 *
 * Structured outputs constrain the model to exactly these shapes, so the
 * pipeline never has to defend against prose where an object was expected.
 * Every property is required and `additionalProperties` is false, as the
 * structured-output validator demands; "unknown" is expressed as a value
 * rather than an absent key.
 */

export const COVERAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sameCarpetThroughout: {
      type: 'boolean',
      description:
        'True only if every photo plausibly shows the same physical carpet.',
    },
    inconsistentSubjectPhotoIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ids of photos that appear to show a different carpet from the rest of the set.',
    },
    mismatchedPhotos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          photoId: { type: 'string' },
          declared: { type: 'string' },
          observed: {
            type: 'string',
            description: 'What the photo actually shows.',
          },
          note: { type: 'string' },
        },
        required: ['photoId', 'declared', 'observed', 'note'],
      },
    },
    unusablePhotoIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ids of photos too blurry, dark, distant or obstructed to assess.',
    },
    notes: { type: 'string' },
  },
  required: [
    'sameCarpetThroughout',
    'inconsistentSubjectPhotoIds',
    'mismatchedPhotos',
    'unusablePhotoIds',
    'notes',
  ],
} as const;

export const MANIPULATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          photoId: { type: 'string' },
          code: {
            type: 'string',
            enum: [
              'digital_retouching',
              'cloned_region',
              'spliced_content',
              'inconsistent_lighting',
              'inconsistent_perspective',
              'ai_generated_appearance',
              'photo_of_screen',
              'photo_of_print',
              'watermark_removal',
              'staged_or_stock_image',
              'text_overlay',
              'none',
            ],
          },
          severity: {
            type: 'string',
            enum: ['info', 'low', 'medium', 'high', 'critical'],
          },
          confidence: {
            type: 'number',
            description: 'Confidence from 0 to 1.',
          },
          evidence: {
            type: 'string',
            description:
              'The specific visual evidence, naming where in the frame.',
          },
        },
        required: ['photoId', 'code', 'severity', 'confidence', 'evidence'],
      },
    },
    overallAssessment: { type: 'string' },
  },
  required: ['findings', 'overallAssessment'],
} as const;

export const IDENTITY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    originCountry: { type: 'string' },
    originRegion: {
      type: 'string',
      description: 'Weaving region or town, e.g. Tabriz, Kashan, Hereke.',
    },
    designFamily: {
      type: 'string',
      description:
        'Design family, e.g. medallion-and-corner, herati, boteh, gol farang.',
    },
    motifs: { type: 'array', items: { type: 'string' } },
    knotType: {
      type: 'string',
      description:
        'Persian (asymmetric), Turkish (symmetric), jufti, or unknown.',
    },
    estimatedKnotDensity: {
      type: 'string',
      description:
        'Knots per square decimetre or raj, with the range you can support.',
    },
    pileMaterial: { type: 'string' },
    warpMaterial: { type: 'string' },
    weftMaterial: { type: 'string' },
    dyeAssessment: {
      type: 'string',
      description:
        'Natural, synthetic, or mixed, and the visual basis for saying so.',
    },
    estimatedAgeRange: { type: 'string' },
    dominantColors: { type: 'array', items: { type: 'string' } },
    estimatedDimensions: { type: 'string' },
    condition: { type: 'string' },
    defects: { type: 'array', items: { type: 'string' } },
    distinguishingMarks: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Features that identify this individual carpet: signatures, repairs, irregularities, abrash bands.',
    },
    summaryEn: { type: 'string' },
    summaryFa: {
      type: 'string',
      description: 'The same summary written in Persian.',
    },
    confidence: { type: 'number' },
    declarationConflicts: {
      type: 'array',
      items: { type: 'string' },
      description:
        "Points where the photos contradict the owner's declared attributes.",
    },
  },
  required: [
    'originCountry',
    'originRegion',
    'designFamily',
    'motifs',
    'knotType',
    'estimatedKnotDensity',
    'pileMaterial',
    'warpMaterial',
    'weftMaterial',
    'dyeAssessment',
    'estimatedAgeRange',
    'dominantColors',
    'estimatedDimensions',
    'condition',
    'defects',
    'distinguishingMarks',
    'summaryEn',
    'summaryFa',
    'confidence',
    'declarationConflicts',
  ],
} as const;
