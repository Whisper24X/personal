import type { MemoryFact } from './memory.types';
import type { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';
import { normalizeSuggestedMemoryMarkdownPath } from './memory-path-canonical.util';

export { mapCategoryToMemoryPath } from './memory-path-canonical.util';

export function normalizeExtractedFacts(
  raw: MemoryFact[],
  config: MemoryRuntimeConfigSnapshot,
): MemoryFact[] {
  const minC = config.confidenceMin;
  const withPath: MemoryFact[] = [];
  for (const f of raw) {
    if (!f?.text?.trim() || !f.dedup_key?.trim()) {
      continue;
    }
    if (f.confidence < minC) {
      continue;
    }
    const text =
      f.text.length > config.factMaxChars
        ? `${f.text.slice(0, config.factMaxChars)}…`
        : f.text;
    const cat = f.category ?? 'convention';
    const path = normalizeSuggestedMemoryMarkdownPath(f.suggested_path, cat);
    withPath.push({
      ...f,
      text,
      category: cat,
      suggested_path: path,
    });
  }
  const byKey = new Map<string, MemoryFact>();
  for (const f of withPath) {
    const prev = byKey.get(f.dedup_key);
    if (!prev || f.confidence > prev.confidence) {
      byKey.set(f.dedup_key, f);
    } else if (
      f.confidence === prev.confidence &&
      f.text.length < prev.text.length
    ) {
      byKey.set(f.dedup_key, f);
    }
  }
  return Array.from(byKey.values());
}
