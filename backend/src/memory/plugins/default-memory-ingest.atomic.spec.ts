import type {
  HostCapabilities,
  MemoryHostLogger,
  MemoryIngestionJob,
} from '../memory.types';
import type { MemoryRuntimeConfigSnapshot } from '../memory-runtime.config';
import { DefaultMemoryIngestPlugin } from './default-memory-ingest.plugin';
import { MemoryPatchApplyService } from '../memory-patch-apply.service';

const logger: MemoryHostLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => logger),
};

function baseCapsConfig(): MemoryRuntimeConfigSnapshot {
  return {
    extractionEnabled: true,
    injectionEnabled: false,
    ingestPluginId: 'ainative.default',
    injectPluginId: 'ainative.default',
    confidenceMin: 0,
    factMaxChars: 800,
    queryMaxChars: 768,
    injectMaxChars: 12_000,
    l2TopKSections: 8,
    l2SectionMaxChars: 2500,
    preprocessCandidateBudgetChars: 80_000,
    dedupeJaccardMin: 0.9,
    preprocessFallbackFullTranscript: false,
    promotionScoreMin: 0,
    promotionRecallMin: 0,
    promotionDistinctQueriesMin: 0,
    promotionColdStart: true,
    memoryIngestDryRun: false,
    llmBaseUrl: 'http://localhost/v1/',
    llmApiKey: '',
    llmModel: 'gpt-4o-mini',
    llmMaxRetries: 0,
    scoreWeightRelevance: 0.3,
    scoreWeightFrequency: 0,
    scoreWeightQueryDiversity: 0,
    scoreWeightRecency: 0,
    scoreWeightSpanDays: 0,
    scoreWeightCohesion: 0,
    scoreWeightTagDensity: 0,
    signalInitial: 0,
    signalThemeBonus: 0,
    themeTagMinCount: 0,
    patchStrategy: 'all_or_nothing',
    jaccardNgramSize: 2,
    toolOutputLineCollapseAfter: 20,
    minSegmentChars: 4,
  };
}

describe('DefaultMemoryIngestPlugin all_or_nothing', () => {
  it('should not call writeDoc when any patch anchor misses', async () => {
    const patchApply = new MemoryPatchApplyService();
    const writeDoc = jest.fn().mockResolvedValue(undefined);
    const readDoc = jest
      .fn()
      .mockImplementation(() => Promise.resolve('# 标题\n\n## 团队沉淀\n\n'));
    const ensureFileExists = jest.fn().mockResolvedValue(undefined);
    const transcriptService = {
      buildFullTaskTranscript: jest.fn().mockResolvedValue({ text: 'body' }),
    };
    const preprocessService = {
      buildCandidatePool: jest.fn().mockReturnValue([
        {
          id: 's1',
          sourceRef: {},
          text: 'content',
          charCount: 7,
        },
      ]),
    };
    const promotion = {
      filterFactsByPromotionGate: jest
        .fn()
        .mockImplementation((_p: unknown, facts: unknown[]) =>
          Promise.resolve(facts),
        ),
      bumpSignalsAfterIngest: jest.fn().mockResolvedValue(undefined),
    };
    let completeCalls = 0;
    const completeJson = jest.fn().mockImplementation(() => {
      completeCalls += 1;
      if (completeCalls === 1) {
        return Promise.resolve({
          raw: '{}',
          parse: () => ({
            facts: [
              {
                category: 'convention',
                text: 'c',
                confidence: 1,
                dedup_key: 'k_conv',
                suggested_path: 'memory/conventions.md',
              },
              {
                category: 'decision',
                text: 'd',
                confidence: 1,
                dedup_key: 'k_dec',
                suggested_path: 'memory/decisions.md',
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        raw: '{}',
        parse: () => ({
          patches: [
            {
              path: 'memory/conventions.md',
              heading_anchor: '## 团队沉淀',
              op: 'add' as const,
              body_md: '- conv ok',
              dedup_key: 'k_conv',
            },
            {
              path: 'memory/decisions.md',
              heading_anchor: '## MISSING_SECTION_NOPE',
              op: 'add' as const,
              body_md: '- bad',
              dedup_key: 'k_dec',
            },
          ],
        }),
      });
    });

    const plugin = new DefaultMemoryIngestPlugin(
      transcriptService as never,
      preprocessService as never,
      promotion as never,
      patchApply,
      { ensureFileExists } as never,
    );

    const caps: Pick<
      HostCapabilities,
      | 'logger'
      | 'metrics'
      | 'writeDoc'
      | 'readDoc'
      | 'completeJson'
      | 'redact'
      | 'config'
      | 'getTaskWorkspaceMeta'
      | 'idempotentDone'
      | 'markIngestDone'
    > = {
      logger,
      metrics: { increment: jest.fn() },
      writeDoc,
      readDoc,
      completeJson,
      redact: (s: string) => s,
      config: baseCapsConfig(),
      getTaskWorkspaceMeta: jest.fn(),
      idempotentDone: jest.fn(),
      markIngestDone: jest.fn(),
    };

    const job: MemoryIngestionJob = {
      kind: 'task_done',
      projectId: 'p1',
      taskId: 't1',
      idempotencyKey: 'i1',
    };

    await plugin.onTaskDone(job, caps as HostCapabilities);

    expect(writeDoc).not.toHaveBeenCalled();
    expect(promotion.bumpSignalsAfterIngest).not.toHaveBeenCalled();
  });
});
