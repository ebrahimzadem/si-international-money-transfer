/**
 * Vision passes against the Claude API.
 *
 * All three passes go through one structured-output helper so refusals,
 * server-side fallbacks and schema validation are handled in a single place.
 *
 * Photos are pulled through a loader rather than passed in as buffers: a
 * twenty-photo set at full resolution is hundreds of megabytes, and only one
 * batch needs to be resident at a time.
 */

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  CarpetIdentity,
  CoverageAssessment,
  DeclaredAttributes,
  ShotType,
} from '../prug.types';
import {
  COVERAGE_SYSTEM_PROMPT,
  IDENTITY_SYSTEM_PROMPT,
  MANIPULATION_SYSTEM_PROMPT,
} from './prompts';
import {
  COVERAGE_SCHEMA,
  IDENTITY_SCHEMA,
  MANIPULATION_SCHEMA,
} from './schemas';
import { SHOT_SPECS } from '../capture/shot-list';

export interface VisionPhotoRef {
  id: string;
  shotType: ShotType;
  mimeType: string;
  position: number;
}

/** Returns the photo bytes, or null when they cannot be read. */
export type PhotoLoader = (ref: VisionPhotoRef) => Promise<Buffer | null>;

export interface ManipulationFinding {
  photoId: string;
  code: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: string;
}

export interface ManipulationResult {
  findings: ManipulationFinding[];
  overallAssessment: string;
}

const DEFAULT_MODEL = 'claude-opus-5';
/** Server-side fallbacks: a safety refusal is re-run on Anthropic's recommended model. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Photos per manipulation request — keeps each frame's evidence in focus. */
const FORENSIC_BATCH_SIZE = 5;
/** Enough of the set to judge whether every frame shows one carpet. */
const COVERAGE_MAX_PHOTOS = 14;
/** The identity pass needs the informative angles, not every angle. */
const IDENTITY_MAX_PHOTOS = 10;

/** Shot types the identity pass values most, best first. */
const IDENTITY_SHOT_PRIORITY: ShotType[] = [
  'full_front',
  'full_back',
  'knot_macro',
  'pile_macro',
  'fringe_end',
  'signature',
  'field_detail',
  'corner',
  'edge_selvedge',
  'label',
  'measurement',
  'defect',
];

@Injectable()
export class ClaudeVisionService {
  private readonly logger = new Logger(ClaudeVisionService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  private useFallbacks: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.model = this.configService.get<string>('PRUG_AI_MODEL', DEFAULT_MODEL);
    this.effort = this.configService.get<'high'>('PRUG_AI_EFFORT', 'high');
    this.useFallbacks =
      this.configService.get<string>('PRUG_AI_FALLBACKS', 'true') !== 'false';

    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log(
        `Claude vision ready — model=${this.model} effort=${this.effort}`,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — vision passes are disabled and every analysis will fall through to manual review',
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  get modelId(): string {
    return this.model;
  }

  /** Verify the photo set is usable evidence before anything is inferred from it. */
  async assessCoverage(
    refs: VisionPhotoRef[],
    load: PhotoLoader,
  ): Promise<CoverageAssessment | null> {
    if (!this.client || !refs.length) return null;

    const selected = this.selectByPriority(
      refs,
      IDENTITY_SHOT_PRIORITY,
      COVERAGE_MAX_PHOTOS,
    );
    const result = await this.callStructured<{
      sameCarpetThroughout: boolean;
      inconsistentSubjectPhotoIds: string[];
      mismatchedPhotos: Array<{
        photoId: string;
        declared: string;
        observed: string;
        note: string;
      }>;
      unusablePhotoIds: string[];
      notes: string;
    }>({
      system: COVERAGE_SYSTEM_PROMPT,
      refs: selected,
      load,
      instruction: 'Review this photo set and report any problems with it.',
      schema: COVERAGE_SCHEMA,
      maxTokens: 4000,
    });

    if (!result) return null;

    return {
      missingShots: [],
      mismatchedPhotos: result.mismatchedPhotos.map((entry) => ({
        photoId: entry.photoId,
        declared: entry.declared as ShotType,
        observed: entry.observed,
        note: entry.note,
      })),
      inconsistentSubjectPhotoIds: result.inconsistentSubjectPhotoIds,
      unusablePhotoIds: result.unusablePhotoIds,
      sameCarpetThroughout: result.sameCarpetThroughout,
      notes: result.notes,
    };
  }

  /**
   * Look for evidence that a photo is not a plain photograph of a real carpet.
   * Runs in small batches so each frame gets attention and so only a few
   * images are held in memory at once.
   */
  async detectManipulation(
    refs: VisionPhotoRef[],
    load: PhotoLoader,
  ): Promise<ManipulationResult | null> {
    if (!this.client || !refs.length) return null;

    const findings: ManipulationFinding[] = [];
    const assessments: string[] = [];

    for (let i = 0; i < refs.length; i += FORENSIC_BATCH_SIZE) {
      const batch = refs.slice(i, i + FORENSIC_BATCH_SIZE);
      const result = await this.callStructured<ManipulationResult>({
        system: MANIPULATION_SYSTEM_PROMPT,
        refs: batch,
        load,
        instruction:
          'Examine each photo for evidence of digital manipulation, synthetic generation, or recapture from a screen or print.',
        schema: MANIPULATION_SCHEMA,
        maxTokens: 6000,
      });

      if (result) {
        findings.push(
          ...result.findings.filter((finding) => finding.code !== 'none'),
        );
        assessments.push(result.overallAssessment);
      }
    }

    return { findings, overallAssessment: assessments.join(' ') };
  }

  /** Build the identity document from the photo set and the owner's declaration. */
  async buildIdentity(
    refs: VisionPhotoRef[],
    load: PhotoLoader,
    declared: DeclaredAttributes,
  ): Promise<CarpetIdentity | null> {
    if (!this.client || !refs.length) return null;

    return this.callStructured<CarpetIdentity>({
      system: IDENTITY_SYSTEM_PROMPT,
      refs: this.selectByPriority(
        refs,
        IDENTITY_SHOT_PRIORITY,
        IDENTITY_MAX_PHOTOS,
      ),
      load,
      instruction: `Catalogue this carpet.\n\nOwner's declared attributes (a claim to verify, not a fact):\n${JSON.stringify(
        declared,
        null,
        2,
      )}`,
      schema: IDENTITY_SCHEMA,
      maxTokens: 8000,
    });
  }

  /**
   * Take one photo per shot type in priority order, then a second of each, and
   * so on — so a set heavy on corner shots still contributes its knot macro.
   */
  private selectByPriority(
    refs: VisionPhotoRef[],
    priority: ShotType[],
    limit: number,
  ): VisionPhotoRef[] {
    if (refs.length <= limit) return refs;

    const byType = new Map<ShotType, VisionPhotoRef[]>();
    for (const ref of refs) {
      const bucket = byType.get(ref.shotType) || [];
      bucket.push(ref);
      byType.set(ref.shotType, bucket);
    }

    const selected: VisionPhotoRef[] = [];
    for (let round = 0; selected.length < limit; round++) {
      let added = false;
      for (const shotType of priority) {
        const bucket = byType.get(shotType);
        if (bucket && bucket.length > round) {
          selected.push(bucket[round]);
          added = true;
          if (selected.length >= limit) break;
        }
      }
      if (!added) break;
    }

    return selected.sort((a, b) => a.position - b.position);
  }

  /**
   * One structured-output request.
   *
   * Returns null rather than throwing when the model declines or the response
   * cannot be parsed — the caller records that the pass was inconclusive and
   * routes the carpet to manual review instead of failing the whole run.
   */
  private async callStructured<T>(input: {
    system: string;
    refs: VisionPhotoRef[];
    load: PhotoLoader;
    instruction: string;
    schema: Record<string, unknown>;
    maxTokens: number;
  }): Promise<T | null> {
    if (!this.client) return null;

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];

    for (const ref of input.refs) {
      const data = await input.load(ref);
      if (!data) {
        this.logger.warn(
          `Photo ${ref.id} could not be loaded; excluded from this pass`,
        );
        continue;
      }

      const spec = SHOT_SPECS[ref.shotType];
      content.push({
        type: 'text',
        text: `Photo id: ${ref.id} (position ${ref.position}) — filed as "${ref.shotType}"${spec ? ` (${spec.labelEn})` : ''}`,
      });
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: ref.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
          data: data.toString('base64'),
        },
      });
    }

    if (!content.length) return null;
    content.push({ type: 'text', text: input.instruction });

    const request: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: input.maxTokens,
      system: input.system,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: this.effort,
        format: { type: 'json_schema', schema: input.schema },
      },
      messages: [{ role: 'user', content }],
    };

    try {
      const response = await this.send(request);
      if (!response) return null;

      if (response.stop_reason === 'refusal') {
        this.logger.warn(
          'Vision request was declined by safety classifiers; pass recorded as inconclusive',
        );
        return null;
      }

      if (response.stop_reason === 'max_tokens') {
        this.logger.warn(
          'Vision response hit max_tokens; pass recorded as inconclusive',
        );
        return null;
      }

      const text = response.content
        .filter(
          (block): block is Anthropic.Beta.BetaTextBlock =>
            block.type === 'text',
        )
        .map((block) => block.text)
        .join('');

      if (!text.trim()) return null;
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException(
          'Image analysis is rate limited; please retry shortly',
        );
      }
      this.logger.error(`Vision request failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Send with server-side fallbacks enabled. If the account or API version
   * rejects the fallback parameter, retry once without it and remember that,
   * rather than failing every subsequent analysis.
   */
  private async send(
    request: Anthropic.Beta.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Beta.BetaMessage | null> {
    if (!this.client) return null;

    if (this.useFallbacks) {
      try {
        return await this.client.beta.messages.create({
          ...request,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
        });
      } catch (error) {
        if (!(error instanceof Anthropic.BadRequestError)) throw error;
        this.logger.warn(
          `Server-side fallbacks rejected (${error.message}); continuing without them`,
        );
        this.useFallbacks = false;
      }
    }

    return this.client.beta.messages.create(request);
  }
}
