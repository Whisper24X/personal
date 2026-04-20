import path from 'path';

/**
 * Parses `Project.configJson.runnerWorkingSubdirectory`: a relative path (POSIX or OS)
 * under the task worktree root. Empty/absent means the worktree root.
 */
export function parseRunnerWorkingSubdirectory(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const t = value.trim();
  if (path.isAbsolute(t)) {
    throw new Error('runnerWorkingSubdirectory must be a relative path');
  }
  // Check raw segments before path.normalize (which collapses `a/../b` → `b`).
  const rawSegments = t.split(/[/\\]+/).filter(Boolean);
  if (rawSegments.some((s) => s === '..' || s === '.')) {
    throw new Error(
      'runnerWorkingSubdirectory must not contain . or .. path segments',
    );
  }
  const norm = path.normalize(t);
  const segments = norm.split(/[/\\]+/).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  return path.join(...segments);
}

export function parseRunnerWorkingSubdirectoryFromConfigJson(
  configJson: Record<string, unknown> | null | undefined,
): string | null {
  if (!configJson || typeof configJson !== 'object') {
    return null;
  }
  return parseRunnerWorkingSubdirectory(
    configJson['runnerWorkingSubdirectory'],
  );
}
