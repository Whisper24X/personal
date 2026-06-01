import {
  initialTitleFromPrompt,
  MAX_TASK_TITLE_DB,
} from './task-title-placeholder';

describe('initialTitleFromPrompt', () => {
  it('should return trimmed single-line style title', () => {
    expect(initialTitleFromPrompt('  hello   world  ')).toBe('hello world');
  });

  it('should truncate with ellipsis when longer than DB limit', () => {
    const long = 'a'.repeat(MAX_TASK_TITLE_DB + 10);
    const out = initialTitleFromPrompt(long);
    expect(out.length).toBe(MAX_TASK_TITLE_DB);
    expect(out.endsWith('…')).toBe(true);
  });

  it('should return default when empty after trim', () => {
    expect(initialTitleFromPrompt('   ')).toBe('新建任务');
  });
});
