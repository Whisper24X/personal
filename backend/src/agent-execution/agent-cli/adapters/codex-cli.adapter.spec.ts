import { CodexCliAdapter } from './codex-cli.adapter';
import { ClaudeCliAdapter } from './claude-cli.adapter';
import { CursorCliAdapter } from './cursor-cli.adapter';

describe('CodexCliAdapter', () => {
  const adapter = new CodexCliAdapter();

  describe('applyContinuation', () => {
    it('should remove --local-provider for codex exec resume when CLI does not accept it on resume', () => {
      const args = [
        'exec',
        '--json',
        '--skip-git-repo-check',
        '--model',
        'gpt-5.4',
        '--local-provider',
        'gpt-5.4',
        '--dangerously-bypass-approvals-and-sandbox',
        '-c',
        'model_provider="devices"',
        '-',
      ];
      const result = adapter.applyContinuation(args, {
        sessionId: '019d7122-06b0-7201-83c2-5771a12c81d9',
        continuationConfig: {},
      });

      expect(result).toEqual([
        'exec',
        'resume',
        '--json',
        '--skip-git-repo-check',
        '--model',
        'gpt-5.4',
        '--dangerously-bypass-approvals-and-sandbox',
        '-c',
        'model_provider="devices"',
        '019d7122-06b0-7201-83c2-5771a12c81d9',
        '-',
      ]);
      expect(result).not.toContain('--local-provider');
    });
  });
});

describe('pre-execution prompt records', () => {
  it.each([
    ['codex', new CodexCliAdapter()],
    ['cursor', new CursorCliAdapter()],
    ['claude', new ClaudeCliAdapter()],
  ])(
    'should record the prepared prompt for %s transcripts',
    (_name, adapter) => {
      const createdAt = new Date('2026-05-26T01:02:03.000Z');

      expect(
        adapter.buildPreExecutionOutputRecords({
          prompt: 'final prompt with memory',
          createdAt,
        }),
      ).toEqual([
        {
          type: 'user_message',
          message: 'final prompt with memory',
          created_at: createdAt.toISOString(),
          source: 'ainative_injected_prompt',
        },
      ]);
    },
  );
});
