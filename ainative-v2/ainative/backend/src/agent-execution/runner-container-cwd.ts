import path from 'path';

/**
 * Maps host worktree root + resolved host cwd to the in-container working directory
 * for `docker exec -w` (bind: host worktree -> `containerMount`, default `/workspace`).
 */
export function computeRunnerContainerCwd(params: {
  hostWorktreeAbs: string;
  hostResolvedCwd: string;
  containerMount: string;
}): string {
  const wt = path.resolve(params.hostWorktreeAbs);
  const cw = path.resolve(params.hostResolvedCwd);
  const rel = path.relative(wt, cw);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Host cwd ${cw} is not under worktree root ${wt}`);
  }
  const root = params.containerMount.replace(/\/+$/, '') || '/workspace';
  const posixRel = rel.split(path.sep).join('/');
  return posixRel ? `${root}/${posixRel}` : root;
}
