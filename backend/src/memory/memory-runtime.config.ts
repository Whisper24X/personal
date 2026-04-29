import { ConfigService } from '@nestjs/config';

export type MemoryRuntimeConfigSnapshot = {
  extractionEnabled: boolean;
  injectionEnabled: boolean;
  ingestPluginId: string;
  injectPluginId: string;
  confidenceMin: number;
  factMaxChars: number;
  queryMaxChars: number;
  injectMaxChars: number;
  l2TopKSections: number;
  l2SectionMaxChars: number;
  preprocessCandidateBudgetChars: number;
  dedupeJaccardMin: number;
  preprocessFallbackFullTranscript: boolean;
  promotionScoreMin: number;
  promotionRecallMin: number;
  promotionDistinctQueriesMin: number;
  promotionColdStart: boolean;
  memoryIngestDryRun: boolean;
  /** OpenAI-compatible chat completion */
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmMaxRetries: number;
  scoreWeightRelevance: number;
  scoreWeightFrequency: number;
  scoreWeightQueryDiversity: number;
  scoreWeightRecency: number;
  scoreWeightSpanDays: number;
  scoreWeightCohesion: number;
  scoreWeightTagDensity: number;
  signalInitial: number;
  signalThemeBonus: number;
  themeTagMinCount: number;
  patchStrategy: 'all_or_nothing' | 'best_effort';
  jaccardNgramSize: number;
  toolOutputLineCollapseAfter: number;
  minSegmentChars: number;
};

const envString = (key: string, defaultValue: string): string => {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return defaultValue;
  }
  return v.trim();
};

/** Explicit MEMORY_LLM_* only (no baked-in defaults for merge chain). */
const memoryLlmEnvString = (key: string): string => {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return '';
  }
  return v.trim();
};

const envBool = (key: string, defaultValue: boolean): boolean => {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return defaultValue;
  }
  return v === '1' || v.toLowerCase() === 'true';
};

const envNumber = (key: string, defaultValue: number): number => {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return defaultValue;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultValue;
};

export const loadMemoryRuntimeConfigFromEnv =
  (): MemoryRuntimeConfigSnapshot => ({
    extractionEnabled: envBool('MEMORY_EXTRACTION_ENABLED', false),
    injectionEnabled: envBool('MEMORY_INJECTION_ENABLED', false),
    ingestPluginId: envString('MEMORY_INGEST_PLUGIN_ID', 'ainative.default'),
    injectPluginId: envString('MEMORY_INJECT_PLUGIN_ID', 'ainative.default'),
    confidenceMin: envNumber('MEMORY_CONFIDENCE_MIN', 0.65),
    factMaxChars: envNumber('MEMORY_FACT_MAX_CHARS', 800),
    queryMaxChars: envNumber('MEMORY_QUERY_MAX_CHARS', 768),
    injectMaxChars: envNumber('MEMORY_INJECT_MAX_CHARS', 12_000),
    l2TopKSections: envNumber('MEMORY_L2_TOP_K_SECTIONS', 8),
    l2SectionMaxChars: envNumber('MEMORY_L2_SECTION_MAX_CHARS', 2500),
    preprocessCandidateBudgetChars: envNumber(
      'MEMORY_PREPROCESS_CANDIDATE_BUDGET_CHARS',
      80_000,
    ),
    dedupeJaccardMin: envNumber('MEMORY_DEDUPE_JACCARD_MIN', 0.9),
    preprocessFallbackFullTranscript: envBool(
      'MEMORY_PREPROCESS_FALLBACK_FULL_TRANSCRIPT',
      false,
    ),
    promotionScoreMin: envNumber('MEMORY_PROMOTION_SCORE_MIN', 0.75),
    promotionRecallMin: envNumber('MEMORY_PROMOTION_RECALL_MIN', 2),
    promotionDistinctQueriesMin: envNumber(
      'MEMORY_PROMOTION_DISTINCT_QUERIES_MIN',
      2,
    ),
    promotionColdStart: envBool('MEMORY_PROMOTION_COLD_START', true),
    memoryIngestDryRun: envBool('MEMORY_INGEST_DRY_RUN', false),
    llmBaseUrl: memoryLlmEnvString('MEMORY_LLM_BASE_URL'),
    llmApiKey: memoryLlmEnvString('MEMORY_LLM_API_KEY'),
    llmModel: memoryLlmEnvString('MEMORY_LLM_MODEL'),
    llmMaxRetries: envNumber('MEMORY_LLM_MAX_RETRIES', 2),
    scoreWeightRelevance: envNumber('MEMORY_SCORE_WEIGHT_RELEVANCE', 0.3),
    scoreWeightFrequency: envNumber('MEMORY_SCORE_WEIGHT_FREQUENCY', 0.24),
    scoreWeightQueryDiversity: envNumber(
      'MEMORY_SCORE_WEIGHT_QUERY_DIVERSITY',
      0.15,
    ),
    scoreWeightRecency: envNumber('MEMORY_SCORE_WEIGHT_RECENCY', 0.15),
    scoreWeightSpanDays: envNumber('MEMORY_SCORE_WEIGHT_SPAN', 0.1),
    scoreWeightCohesion: envNumber('MEMORY_SCORE_WEIGHT_COHESION', 0.06),
    scoreWeightTagDensity: envNumber('MEMORY_SCORE_WEIGHT_TAG_DENSITY', 0.0),
    signalInitial: envNumber('MEMORY_SIGNAL_INITIAL', 0.5),
    signalThemeBonus: envNumber('MEMORY_SIGNAL_THEME_BONUS', 0.1),
    themeTagMinCount: envNumber('MEMORY_THEME_TAG_MIN_COUNT', 3),
    patchStrategy: envString('MEMORY_PATCH_STRATEGY', 'all_or_nothing') as
      | 'all_or_nothing'
      | 'best_effort',
    jaccardNgramSize: envNumber('MEMORY_DEDUPE_NGRAM', 2),
    toolOutputLineCollapseAfter: envNumber('MEMORY_TOOL_OUTPUT_MAX_LINES', 20),
    minSegmentChars: envNumber('MEMORY_MIN_SEGMENT_CHARS', 4),
  });

export const getMemoryConfigFromConfigService = (
  config: ConfigService,
): MemoryRuntimeConfigSnapshot => {
  void config;
  return loadMemoryRuntimeConfigFromEnv();
};

const openAiEnvTrim = (key: string): string => {
  const v = process.env[key];
  if (v === undefined || v === '') {
    return '';
  }
  return v.trim();
};

/** Fills blank llm triple fields from process OPENAI_* (after MEMORY and DB merges). */
export const applyOpenAiProcessEnvFallback = (
  snap: MemoryRuntimeConfigSnapshot,
): MemoryRuntimeConfigSnapshot => ({
  ...snap,
  llmBaseUrl: snap.llmBaseUrl.trim()
    ? snap.llmBaseUrl
    : openAiEnvTrim('OPENAI_BASE_URL'),
  llmApiKey: snap.llmApiKey.trim()
    ? snap.llmApiKey
    : openAiEnvTrim('OPENAI_API_KEY'),
  llmModel: snap.llmModel.trim()
    ? snap.llmModel
    : openAiEnvTrim('OPENAI_MODEL'),
});

export const mergeLlmTripleIfBlankFromPartial = (
  snap: MemoryRuntimeConfigSnapshot,
  partial: Partial<{
    llmBaseUrl: string;
    llmApiKey: string;
    llmModel: string;
  }>,
): MemoryRuntimeConfigSnapshot => ({
  ...snap,
  llmBaseUrl: snap.llmBaseUrl.trim()
    ? snap.llmBaseUrl
    : (partial.llmBaseUrl?.trim() ?? ''),
  llmApiKey: snap.llmApiKey.trim()
    ? snap.llmApiKey
    : (partial.llmApiKey?.trim() ?? ''),
  llmModel: snap.llmModel.trim()
    ? snap.llmModel
    : (partial.llmModel?.trim() ?? ''),
});

const DEFAULT_MEMORY_LLM_MODEL = 'gpt-4o-mini';

/** Ensures model is non-empty for chat/completions request body. */
export const finalizeMemoryLlmModelIfBlank = (
  snap: MemoryRuntimeConfigSnapshot,
): MemoryRuntimeConfigSnapshot => ({
  ...snap,
  llmModel: snap.llmModel.trim() ? snap.llmModel : DEFAULT_MEMORY_LLM_MODEL,
});
