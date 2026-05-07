import { Injectable } from '@nestjs/common';
import { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';
import type { MemorySegment } from './memory.types';
import { hashSegment, jaccard, ngrams } from './memory-text.util';

const THINKING_TYPES = new Set(['thinking']);
const TOOL_TYPES = new Set(['tool_call', 'tool_result']);

@Injectable()
export class MemoryPreprocessService {
  buildCandidatePool(
    rawTranscript: string,
    config: MemoryRuntimeConfigSnapshot,
  ): MemorySegment[] {
    const lines = rawTranscript.split(/\r?\n/);
    const rough: string[] = [];
    for (const line of lines) {
      const t = this.cleanLine(line, config);
      if (t) {
        rough.push(t);
      }
    }
    const merged = this.mergeSimilarAdjacent(rough, config);
    const segments = this.windowSegments(merged);
    return this.applyBudget(segments, config);
  }

  private cleanLine(
    line: string,
    config: MemoryRuntimeConfigSnapshot,
  ): string | null {
    const t = line.trim();
    if (!t) {
      return null;
    }
    if (t.length < config.minSegmentChars) {
      return null;
    }
    if (/^(ok|yes|no|done)\.?$/i.test(t)) {
      return null;
    }
    if (!t.startsWith('{')) {
      return t;
    }
    const s = t;
    try {
      const maybe = JSON.parse(t) as Record<string, unknown>;
      const type = typeof maybe.type === 'string' ? maybe.type : '';
      if (THINKING_TYPES.has(type)) {
        return null;
      }
      if (TOOL_TYPES.has(type) && JSON.stringify(maybe).length > 400) {
        return this.summarizeToolJson(maybe, config);
      }
    } catch {
      return t;
    }
    if (s.length > 8000) {
      return `${s.slice(0, 200)}… [truncated ${s.length} chars]`;
    }
    return s;
  }

  private summarizeToolJson(
    record: Record<string, unknown>,
    config: MemoryRuntimeConfigSnapshot,
  ): string {
    const raw = JSON.stringify(record);
    const lines = raw.split(/\r?\n/);
    if (lines.length <= config.toolOutputLineCollapseAfter) {
      return raw;
    }
    return `[tool output truncated ${lines.length} lines] ${lines[0]?.slice(0, 200) ?? ''}`;
  }

  private mergeSimilarAdjacent(
    lines: string[],
    config: MemoryRuntimeConfigSnapshot,
  ): string[] {
    const out: string[] = [];
    for (const line of lines) {
      const last = out[out.length - 1];
      if (!last) {
        out.push(line);
        continue;
      }
      if (hashSegment(last) === hashSegment(line)) {
        continue;
      }
      const ng = config.jaccardNgramSize;
      if (
        jaccard(ngrams(last, ng), ngrams(line, ng)) >= config.dedupeJaccardMin
      ) {
        continue;
      }
      out.push(line);
    }
    return out;
  }

  private windowSegments(lines: string[]): MemorySegment[] {
    const window = 6000;
    const overlap = 400;
    const out: MemorySegment[] = [];
    const full = lines.join('\n\n');
    if (!full.trim()) {
      return [];
    }
    let turn = 0;
    for (let i = 0; i < full.length; i += window - overlap) {
      const chunk = full.slice(i, i + window);
      if (!chunk.trim()) {
        break;
      }
      out.push({
        id: `seg-${turn}`,
        sourceRef: { turnIndex: turn },
        text: chunk,
        charCount: chunk.length,
      });
      turn += 1;
    }
    return out;
  }

  private applyBudget(
    segments: MemorySegment[],
    config: MemoryRuntimeConfigSnapshot,
  ): MemorySegment[] {
    const max = config.preprocessCandidateBudgetChars;
    let used = 0;
    const out: MemorySegment[] = [];
    for (const s of segments) {
      if (used + s.charCount > max) {
        break;
      }
      out.push(s);
      used += s.charCount;
    }
    return out;
  }
}
