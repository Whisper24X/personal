import { normalizeExtractedFacts } from './memory-facts.helpers';
import type { MemoryFact } from './memory.types';

const baseCfg = {
  confidenceMin: 0,
  factMaxChars: 800,
} as import('./memory-runtime.config').MemoryRuntimeConfigSnapshot;

describe('normalizeExtractedFacts', () => {
  it('should canonicalize episodic episodes path and trim by confidence', () => {
    const raw: MemoryFact[] = [
      {
        category: 'episodic',
        text: 'hello',
        confidence: 0.9,
        dedup_key: 'a',
        suggested_path: 'memory/episodes.md',
      },
    ];
    const out = normalizeExtractedFacts(raw, baseCfg);
    expect(out).toHaveLength(1);
    expect(out[0]!.suggested_path).toBe('memory/episodic.md');
  });

  it('should map episodic category when path missing', () => {
    const raw: MemoryFact[] = [
      {
        category: 'episodic',
        text: 'x',
        confidence: 0.9,
        dedup_key: 'b',
        suggested_path: '',
      },
    ];
    const out = normalizeExtractedFacts(raw, baseCfg);
    expect(out[0]!.suggested_path).toBe('memory/episodic.md');
  });
});
