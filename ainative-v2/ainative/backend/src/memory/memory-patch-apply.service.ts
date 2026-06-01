import { Injectable, Logger } from '@nestjs/common';
import type { MemoryPatch } from './memory.types';
import type { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';

@Injectable()
export class MemoryPatchApplyService {
  private readonly logger = new Logger(MemoryPatchApplyService.name);

  applyToMarkdown(
    body: string,
    patch: MemoryPatch,
    config: MemoryRuntimeConfigSnapshot,
  ): { ok: boolean; next: string } {
    const lines = body.split(/\r?\n/);
    const anchor = patch.heading_anchor.trim();
    const anchorLine = anchor.startsWith('##') ? anchor : `## ${anchor}`;
    let idx = lines.findIndex((l) => l.trim() === anchorLine.trim());
    if (idx < 0) {
      idx = lines.findIndex(
        (l) => l.trim() === anchor || l.trim().endsWith(anchor),
      );
    }
    if (idx < 0) {
      this.logger.warn(`memory_patch_anchor_miss ${patch.path} ${anchorLine}`);
      return config.patchStrategy === 'best_effort'
        ? { ok: false, next: body }
        : { ok: false, next: body };
    }

    const marker = `<!-- dedup:${patch.dedup_key} -->`;
    const block = `${marker}\n${patch.body_md}\n`;

    if (patch.op === 'delete') {
      const next = this.removeDedupBlock(body, patch.dedup_key);
      return { ok: true, next };
    }

    let insertAt = idx + 1;
    for (let j = idx + 1; j < lines.length; j++) {
      if (lines[j].startsWith('##')) {
        insertAt = j;
        break;
      }
      insertAt = j + 1;
    }

    if (patch.op === 'replace') {
      const without = this.removeDedupBlock(body, patch.dedup_key);
      const l2 = without.split(/\r?\n/);
      const i2 = l2.findIndex((l) => l.trim() === anchorLine.trim());
      if (i2 < 0) {
        return { ok: false, next: body };
      }
      let ins = i2 + 1;
      for (let j = i2 + 1; j < l2.length; j++) {
        if (l2[j].startsWith('##')) {
          ins = j;
          break;
        }
        ins = j + 1;
      }
      l2.splice(ins, 0, ...block.split(/\r?\n/));
      return { ok: true, next: l2.join('\n') };
    }

    lines.splice(insertAt, 0, ...block.split(/\r?\n/));
    return { ok: true, next: lines.join('\n') };
  }

  private removeDedupBlock(md: string, key: string): string {
    const re = new RegExp(
      `\\n?<!-- dedup:${escapeRegExp(key)} -->[\\s\\S]*?(?=\\n## |\\n<!-- dedup:|$)`,
    );
    return md.replace(re, '\n').replace(/\n{3,}/g, '\n\n');
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function groupPatchesByPath(
  patches: MemoryPatch[],
): Map<string, MemoryPatch[]> {
  const m = new Map<string, MemoryPatch[]>();
  const sorted = [...patches].sort((a, b) =>
    a.path.localeCompare(b.path, 'en'),
  );
  for (const p of sorted) {
    const list = m.get(p.path) ?? [];
    list.push(p);
    m.set(p.path, list);
  }
  return m;
}
