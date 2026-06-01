import { CodexCliAdapter } from './codex-cli.adapter';

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
