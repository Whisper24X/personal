import { Injectable } from '@nestjs/common';
import {
  MemoryPatchApplyService,
  groupPatchesByPath,
} from '../memory-patch-apply.service';
import { MemoryPreprocessService } from '../memory-preprocess.service';
import { MemoryPromotionService } from '../memory-promotion.service';
import { MemoryTranscriptService } from '../memory-transcript.service';
import { ProjectMemoryInternalDocsService } from '../project-memory-internal-docs.service';
import { normalizeExtractedFacts } from '../memory-facts.helpers';
import { normalizeMemoryPatchPathsFromFacts } from '../memory-path-canonical.util';
import type { HostCapabilities } from '../memory.types';
import type { MemoryIngestPlugin } from '../memory.types';
import type { MemoryFact } from '../memory.types';
import type { MemoryPatch } from '../memory.types';
import { DEFAULT_MEMORY_PLUGIN_ID } from '../memory.types';
import { redactMemoryText } from '../memory-redact.util';

const SEED_BY_PATH: Record<string, string> = {
  'memory/README.md': `# 项目记忆\n\n## 概览\n\n本目录由「对话知识沉淀」自动维护。\n`,
  'memory/preferences.md': `# 偏好\n\n## 团队沉淀\n\n`,
  'memory/conventions.md': `# 规约\n\n## 团队沉淀\n\n`,
  'memory/decisions.md': `# 决策\n\n## 团队沉淀\n\n`,
  'memory/incidents.md': `# 事故与规避\n\n## 团队沉淀\n\n`,
  'memory/glossary.md': `# 术语\n\n## 团队沉淀\n\n`,
  'memory/episodic.md': `# 任务摘要\n\n## 团队沉淀\n\n`,
};

const DEFAULT_MEMORY_DOC_SEED = `# \n\n## 团队沉淀\n\n`;

const ALLOWED_MEMORY_PATH_HINT =
  'memory/README.md | memory/preferences.md | memory/conventions.md | memory/decisions.md | memory/incidents.md | memory/glossary.md | memory/episodic.md';

/** Exported for unit tests — coerces empty/whitespace reads to the path seed. */
export function resolveMemoryMarkdownForPatch(
  read: string | null,
  relPath: string,
): string {
  if (read == null || read.trim() === '') {
    return SEED_BY_PATH[relPath] ?? DEFAULT_MEMORY_DOC_SEED;
  }
  return read;
}

@Injectable()
export class DefaultMemoryIngestPlugin implements MemoryIngestPlugin {
  readonly id = DEFAULT_MEMORY_PLUGIN_ID;

  constructor(
    private readonly transcriptService: MemoryTranscriptService,
    private readonly preprocessService: MemoryPreprocessService,
    private readonly promotion: MemoryPromotionService,
    private readonly patchApply: MemoryPatchApplyService,
    private readonly internalDocs: ProjectMemoryInternalDocsService,
  ) {}

  async onTaskDone(
    job: import('../memory.types').MemoryIngestionJob,
    caps: HostCapabilities,
  ): Promise<void> {
    const cfg = caps.config;

    const { text: transcript } =
      await this.transcriptService.buildFullTaskTranscript(job.taskId);

    let candidates = this.preprocessService.buildCandidatePool(transcript, cfg);

    if (!candidates.length && cfg.preprocessFallbackFullTranscript) {
      caps.logger.warn('memory_preprocess_fallback_full_transcript');
      candidates = [
        {
          id: 'fallback',
          sourceRef: {},
          text: transcript.slice(0, cfg.preprocessCandidateBudgetChars),
          charCount: Math.min(
            transcript.length,
            cfg.preprocessCandidateBudgetChars,
          ),
        },
      ];
    }

    let facts: MemoryFact[] = [];
    if (candidates.length && cfg.llmBaseUrl.trim()) {
      try {
        const extracted = await this.extractFacts(caps, candidates);
        facts = normalizeExtractedFacts(extracted, cfg);
      } catch (e) {
        caps.logger.error(
          `memory_llm_extract_facts_fail ${e instanceof Error ? e.message : String(e)}`,
        );
        caps.metrics.increment('memory_llm_extract_facts_fail_total');
        return;
      }
    } else if (!candidates.length) {
      caps.metrics.increment('memory_preprocess_empty_pool');
    }

    facts = await this.promotion.filterFactsByPromotionGate(
      job.projectId,
      facts,
      cfg,
    );

    if (!facts.length) {
      return;
    }

    if (!cfg.llmBaseUrl.trim()) {
      return;
    }

    let patches: MemoryPatch[] = [];
    try {
      patches = await this.buildPatches(caps, job, facts);
      const { normalized, pathsCoercedCount } =
        normalizeMemoryPatchPathsFromFacts(patches, facts);
      patches = normalized;
      for (let i = 0; i < pathsCoercedCount; i += 1) {
        caps.metrics.increment('memory_patch_path_normalized_total');
      }
    } catch (e) {
      caps.logger.error(
        `memory_llm_patches_fail ${e instanceof Error ? e.message : String(e)}`,
      );
      caps.metrics.increment('memory_llm_patches_fail_total');
      return;
    }

    if (!patches.length) {
      return;
    }

    for (const p of patches) {
      p.body_md = redactMemoryText(p.body_md);
    }

    if (cfg.memoryIngestDryRun) {
      caps.logger.info(
        `memory_ingest_dry_run patches=${patches.length} facts=${facts.length}`,
      );
      return;
    }

    const byPath = groupPatchesByPath(patches);
    for (const relPath of byPath.keys()) {
      await this.internalDocs.ensureFileExists(
        job.projectId,
        relPath,
        SEED_BY_PATH[relPath] ?? DEFAULT_MEMORY_DOC_SEED,
      );
    }

    const pendingWrites = new Map<string, string>();

    for (const [relPath, plist] of byPath) {
      const raw = await caps.readDoc({
        projectId: job.projectId,
        relativePath: relPath,
      });
      let current = resolveMemoryMarkdownForPatch(raw, relPath);
      for (const patch of plist) {
        const { ok, next } = this.patchApply.applyToMarkdown(
          current,
          patch,
          cfg,
        );
        if (!ok && cfg.patchStrategy === 'all_or_nothing') {
          caps.metrics.increment('memory_patch_apply_errors_total');
          caps.logger.warn(
            `memory_ingest_all_or_nothing_abort path=${relPath} dedup=${patch.dedup_key}`,
          );
          return;
        }
        current = next;
      }
      pendingWrites.set(relPath, redactMemoryText(current));
    }

    for (const [relPath, content] of pendingWrites) {
      await caps.writeDoc({
        projectId: job.projectId,
        relativePath: relPath,
        content,
        mode: 'update',
      });
    }

    await this.promotion.bumpSignalsAfterIngest(
      job.projectId,
      facts.map((f) => f.dedup_key),
    );
  }

  private async extractFacts(
    caps: HostCapabilities,
    candidates: import('../memory.types').MemorySegment[],
  ): Promise<MemoryFact[]> {
    const system = [
      'You extract durable project knowledge as JSON.',
      'Output a single JSON object: { "facts": [ ... ] } only.',
      'Each fact: category (preference|convention|decision|incident|glossary|episodic),',
      'text (short, Chinese), confidence 0-1, dedup_key (stable slug, ascii),',
      `suggested_path must be one of: ${ALLOWED_MEMORY_PATH_HINT} — use only these exact paths (single file under memory/, no subfolders); optional suggested_heading.`,
    ].join(' ');
    const user = JSON.stringify({ candidates });
    const res = await caps.completeJson({
      system,
      user,
      maxOutputTokens: 4096,
    });
    const parsed = res.parse() as unknown as { facts?: MemoryFact[] };
    return Array.isArray(parsed.facts) ? parsed.facts : [];
  }

  private async buildPatches(
    caps: HostCapabilities,
    job: import('../memory.types').MemoryIngestionJob,
    facts: MemoryFact[],
  ): Promise<MemoryPatch[]> {
    const paths = Array.from(new Set(facts.map((f) => f.suggested_path)));
    const fileBits: string[] = [];
    for (const p of paths) {
      if (!SEED_BY_PATH[p]) {
        await this.internalDocs.ensureFileExists(
          job.projectId,
          p,
          DEFAULT_MEMORY_DOC_SEED,
        );
      }
      const body = await caps.readDoc({
        projectId: job.projectId,
        relativePath: p,
      });
      const head = resolveMemoryMarkdownForPatch(body, p).slice(0, 12_000);
      fileBits.push(`FILE ${p}:\n${head}`);
    }
    const system = [
      'You format facts into markdown patches as JSON: { "patches": [ ... ] } only.',
      `Each patch path must be one of: ${ALLOWED_MEMORY_PATH_HINT} — flat paths only.`,
      'heading_anchor MUST be exactly the line: ## 团队沉淀 (matches the seed files; do not use the file H1 title as anchor).',
      'Fields: heading_anchor (exact ## 团队沉淀), op: add|replace|delete, body_md (markdown, short), dedup_key (same as fact).',
      'Use op=add to append a bullet or paragraph under that section.',
    ].join(' ');
    const user = [
      `taskId=${job.taskId}`,
      'FACTS:\n' + JSON.stringify(facts),
      'FILES:\n' + fileBits.join('\n---\n'),
    ].join('\n');
    const res = await caps.completeJson({
      system,
      user,
      maxOutputTokens: 4096,
    });
    const parsed = res.parse() as unknown as { patches?: MemoryPatch[] };
    return Array.isArray(parsed.patches) ? parsed.patches : [];
  }
}
