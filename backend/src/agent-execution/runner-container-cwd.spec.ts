import path from 'path';
import { computeRunnerContainerCwd } from './runner-container-cwd';

describe('computeRunnerContainerCwd', () => {
  const wt = path.resolve('/data/proj/worktrees/wk-1');

  it('should map worktree root to container mount', () => {
    expect(
      computeRunnerContainerCwd({
        hostWorktreeAbs: wt,
        hostResolvedCwd: wt,
        containerMount: '/workspace',
      }),
    ).toBe('/workspace');
  });

  it('should map subdirectory under worktree', () => {
    const sub = path.join(wt, 'packages', 'app');
    expect(
      computeRunnerContainerCwd({
        hostWorktreeAbs: wt,
        hostResolvedCwd: sub,
        containerMount: '/workspace',
      }),
    ).toBe('/workspace/packages/app');
  });

  it('should normalize trailing slash on mount', () => {
    expect(
      computeRunnerContainerCwd({
        hostWorktreeAbs: wt,
        hostResolvedCwd: wt,
        containerMount: '/workspace/',
      }),
    ).toBe('/workspace');
  });

  it('should throw when cwd escapes worktree', () => {
    expect(() =>
      computeRunnerContainerCwd({
        hostWorktreeAbs: wt,
        hostResolvedCwd: path.resolve(wt, '..', 'other'),
        containerMount: '/workspace',
      }),
    ).toThrow('not under worktree root');
  });
});
