import type { MemoryFact, MemoryFactCategory } from './memory.types';
import type { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';

export function mapCategoryToMemoryPath(category: MemoryFactCategory): string {
  const m: Record<MemoryFactCategory, string> = {
    preference: 'memory/preferences.md',
    convention: 'memory/conventions.md',
    decision: 'memory/decisions.md',
    incident: 'memory/incidents.md',
    glossary: 'memory/glossary.md',
    episodic: 'memory/decisions.md',
  };
  return m[category];
}

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
    const path = f.suggested_path?.startsWith('memory/')
      ? f.suggested_path
      : mapCategoryToMemoryPath(cat);
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
