import {
  normalizeMemoryPatchPathsFromFacts,
  normalizeSuggestedMemoryMarkdownPath,
} from './memory-path-canonical.util';

describe('normalizeSuggestedMemoryMarkdownPath', () => {
  it('should map episodes synonyms to episodic.md for episodic category', () => {
    expect(
      normalizeSuggestedMemoryMarkdownPath('memory/episodes.md', 'episodic'),
    ).toBe('memory/episodic.md');
    expect(
      normalizeSuggestedMemoryMarkdownPath(
        'memory/episodic/note.md',
        'episodic',
      ),
    ).toBe('memory/episodic.md');
  });

  it('should fall back to category default when basename is unknown', () => {
    expect(
      normalizeSuggestedMemoryMarkdownPath(
        'memory/episodic/open-questions.md',
        'decision',
      ),
    ).toBe('memory/decisions.md');
    expect(normalizeSuggestedMemoryMarkdownPath(undefined, 'glossary')).toBe(
      'memory/glossary.md',
    );
  });

  it('should accept whitelist basenames nested under bogus folders', () => {
    expect(
      normalizeSuggestedMemoryMarkdownPath(
        'memory/spam/conventions.md',
        'preference',
      ),
    ).toBe('memory/conventions.md');
  });
});

describe('normalizeMemoryPatchPathsFromFacts', () => {
  it('should coerce patch path using fact dedup category', () => {
    const { normalized, pathsCoercedCount } =
      normalizeMemoryPatchPathsFromFacts(
        [
          {
            path: 'memory/episodes.md',
            heading_anchor: '## 团队沉淀',
            op: 'add',
            body_md: '- a',
            dedup_key: 'f1',
          },
        ],
        [
          {
            category: 'episodic',
            text: 't',
            confidence: 1,
            dedup_key: 'f1',
            suggested_path: 'memory/episodic.md',
          },
        ],
      );
    expect(normalized).toHaveLength(1);
    expect(normalized[0]!.path).toBe('memory/episodic.md');
    expect(pathsCoercedCount).toBeGreaterThanOrEqual(1);
  });
});
