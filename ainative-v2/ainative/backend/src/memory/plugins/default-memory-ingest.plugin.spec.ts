import { resolveMemoryMarkdownForPatch } from './default-memory-ingest.plugin';

describe('resolveMemoryMarkdownForPatch', () => {
  it('should return seed when read is null', () => {
    const r = resolveMemoryMarkdownForPatch(null, 'memory/conventions.md');
    expect(r).toContain('## 团队沉淀');
    expect(r).toContain('# 规约');
  });

  it('should return seed when read is empty string', () => {
    expect(resolveMemoryMarkdownForPatch('', 'memory/episodic.md')).toContain(
      '## 团队沉淀',
    );
  });

  it('should return seed when read is whitespace only', () => {
    expect(
      resolveMemoryMarkdownForPatch('  \n  ', 'memory/glossary.md'),
    ).toContain('# 术语');
  });

  it('should use default seed for unknown relative path', () => {
    expect(resolveMemoryMarkdownForPatch(null, 'memory/custom-only.md')).toBe(
      '# \n\n## 团队沉淀\n\n',
    );
  });

  it('should preserve non-empty read', () => {
    const body = '# x\n\n## 团队沉淀\n\nnote';
    expect(resolveMemoryMarkdownForPatch(body, 'memory/conventions.md')).toBe(
      body,
    );
  });
});
