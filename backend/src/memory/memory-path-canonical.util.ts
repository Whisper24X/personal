import type {
  MemoryFact,
  MemoryFactCategory,
  MemoryPatch,
} from './memory.types';

/** Flat `memory/*.md` allowlist aligned with ingest seeds and design §7.6 */
export const CANONICAL_MEMORY_MARKDOWN_FILES = new Set([
  'README.md',
  'preferences.md',
  'conventions.md',
  'decisions.md',
  'incidents.md',
  'glossary.md',
  'episodic.md',
]);

const STEM_TO_CANONICAL_FILE: Record<string, string> = {
  readme: 'README.md',
  episodes: 'episodic.md',
  episode: 'episodic.md',
};

export function mapCategoryToMemoryPath(category: MemoryFactCategory): string {
  const m: Record<MemoryFactCategory, string> = {
    preference: 'memory/preferences.md',
    convention: 'memory/conventions.md',
    decision: 'memory/decisions.md',
    incident: 'memory/incidents.md',
    glossary: 'memory/glossary.md',
    episodic: 'memory/episodic.md',
  };
  return m[category];
}

/**
 * Map model-provided `memory/...` paths to a single flat whitelist file under `docs/memory/`.
 * Nested paths and unknown basenames fall back to the default file for `category`.
 */
export function normalizeSuggestedMemoryMarkdownPath(
  suggested_path: string | undefined,
  category: MemoryFactCategory,
): string {
  const fallback = mapCategoryToMemoryPath(category);
  const raw = suggested_path?.trim();
  if (!raw?.startsWith('memory/')) {
    return fallback;
  }
  const normalized = raw.replace(/\\/g, '/');
  if (normalized.includes('..')) {
    return fallback;
  }
  const rest = normalized.slice('memory/'.length);
  if (!rest) {
    return fallback;
  }
  const segments = rest.split('/').filter(Boolean);
  const basename = segments[segments.length - 1];
  if (!basename.endsWith('.md')) {
    return fallback;
  }
  const stem = basename.slice(0, -3).toLowerCase();
  const canonicalFile = STEM_TO_CANONICAL_FILE[stem] ?? `${stem}.md`;
  if (!CANONICAL_MEMORY_MARKDOWN_FILES.has(canonicalFile)) {
    return fallback;
  }
  return `memory/${canonicalFile}`;
}

/** Drop invalid patches; coerce LLM paths to the flat whitelist via fact-linked category. */
export function normalizeMemoryPatchPathsFromFacts(
  patches: MemoryPatch[],
  facts: MemoryFact[],
): { normalized: MemoryPatch[]; pathsCoercedCount: number } {
  const factByDedup = new Map(facts.map((f) => [f.dedup_key, f]));
  let pathsCoercedCount = 0;
  const normalized: MemoryPatch[] = [];
  for (const p of patches) {
    if (!p?.path?.trim() || !p?.dedup_key?.trim()) {
      continue;
    }
    const fact = factByDedup.get(p.dedup_key);
    const cat: MemoryFactCategory = fact?.category ?? 'convention';
    const before = p.path.trim();
    const norm = normalizeSuggestedMemoryMarkdownPath(before, cat);
    if (before.replace(/\\/g, '/') !== norm) {
      pathsCoercedCount += 1;
    }
    normalized.push({ ...p, path: norm });
  }
  return { normalized, pathsCoercedCount };
}
