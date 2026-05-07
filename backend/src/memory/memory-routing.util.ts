/**
 * Subset parser for _routing.yaml used by memory inject (no full YAML dependency).
 * Supports: include_globs, slots[templateId] list of file paths
 */
export type MemoryRoutingFile = {
  includeGlobs: string[];
  slots: Record<string, string[]>;
};

export function parseMemoryRoutingYaml(yaml: string): MemoryRoutingFile {
  const lines = yaml.split(/\r?\n/);
  const out: MemoryRoutingFile = { includeGlobs: [], slots: {} };
  let mode: 'include' | 'slots' | 'slotList' | null = null;
  let currentSlotKey: string | null = null;

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    if (t === 'include_globs:' || t.startsWith('include_globs:')) {
      mode = 'include';
      currentSlotKey = null;
      continue;
    }
    if (t === 'slots:' || t.startsWith('slots:')) {
      mode = 'slots';
      currentSlotKey = null;
      continue;
    }
    if (mode === 'include' && t.startsWith('- ')) {
      out.includeGlobs.push(
        t
          .slice(2)
          .trim()
          .replace(/^["']|["']$/g, ''),
      );
      continue;
    }
    if (mode === 'slots' && /^[\w-]+:\s*$/.test(t)) {
      const key = t.replace(/:\s*$/, '');
      out.slots[key] = out.slots[key] ?? [];
      currentSlotKey = key;
      mode = 'slotList';
      continue;
    }
    if (mode === 'slotList' && currentSlotKey && t.startsWith('- ')) {
      out.slots[currentSlotKey]!.push(
        t
          .slice(2)
          .trim()
          .replace(/^["']|["']$/g, ''),
      );
      continue;
    }
  }

  return out;
}

export function pathMatchesGlobs(
  filePath: string,
  patterns: string[],
): boolean {
  if (!patterns.length) {
    return true;
  }
  const p = filePath.replace(/^\.\//, '');
  for (const g of patterns) {
    if (g.startsWith('*') && p.endsWith(g.slice(1))) {
      return true;
    }
    if (g.includes('*')) {
      const re = new RegExp(
        `^${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`,
      );
      if (re.test(p)) {
        return true;
      }
    } else if (p === g || p.endsWith(`/${g}`) || p.endsWith(g)) {
      return true;
    }
  }
  return false;
}
