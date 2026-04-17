import path from 'path';
import { rewriteRunnerWorktreeAbsolutePaths } from './runner-platform-mcp-augmentation';

describe('runner-platform-mcp-augmentation', () => {
  it('should map claude mcp_config paths under host worktree to the container workspace', () => {
    const hostWt = '/data/worktrees/wk-1';
    const out = rewriteRunnerWorktreeAbsolutePaths(
      'claude',
      { mcp_config: [path.join(hostWt, '.cursor/mcp.json')] },
      hostWt,
      '/workspace',
    );
    expect(out.mcp_config).toEqual(['/workspace/.cursor/mcp.json']);
  });

  it('should leave paths outside the host worktree unchanged', () => {
    const out = rewriteRunnerWorktreeAbsolutePaths(
      'claude',
      { mcp_config: ['/tmp/other/mcp.json'] },
      '/data/worktrees/wk-1',
      '/workspace',
    );
    expect(out.mcp_config).toEqual(['/tmp/other/mcp.json']);
  });

  it('should map codex config_overrides entries that are host worktree absolute paths', () => {
    const hostWt = '/data/wt';
    const out = rewriteRunnerWorktreeAbsolutePaths(
      'codex',
      {
        config_overrides: [path.join(hostWt, 'extra.toml')],
      },
      hostWt,
      '/workspace',
    );
    expect(out.config_overrides).toEqual(['/workspace/extra.toml']);
  });

  it('should rewrite host paths embedded in codex config_overrides key=value lines', () => {
    const hostWt = '/data/wt';
    const script = path.join(hostWt, 'scripts', 'mcp.sh');
    const out = rewriteRunnerWorktreeAbsolutePaths(
      'codex',
      {
        config_overrides: [
          `mcp_servers.probe.command=${script}`,
          `path_hint="/data/wt/pkg/readme.md"`,
        ],
      },
      hostWt,
      '/workspace',
    );
    expect(out.config_overrides?.[0]).toBe(
      'mcp_servers.probe.command=/workspace/scripts/mcp.sh',
    );
    expect(out.config_overrides?.[1]).toBe(
      'path_hint="/workspace/pkg/readme.md"',
    );
  });
});
