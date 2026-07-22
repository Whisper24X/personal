import { createHash } from 'crypto';
import path from 'path';

export interface SubRepoConfig {
  url: string;
  prefix: string;
  branch: string;
}

/**
 * @deprecated snapshot-sync 模式下不再创建独立子仓 worktree。
 * Wave 2 物理删除旧代码时移除。
 */
export interface ResolvedSubRepo extends SubRepoConfig {
  worktreePath: string;
}

/**
 * @deprecated snapshot-sync 模式下不使用 GitSnapshot，
 * 改用 DeployStatus 追踪部署状态。Wave 2 移除。
 */
export interface GitSnapshotRepo {
  prefix: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  remote: string;
}

/**
 * @deprecated snapshot-sync 模式下不使用 GitSnapshot。Wave 2 移除。
 */
export interface GitSnapshot {
  updatedAt: string;
  repos: GitSnapshotRepo[];
}

export function resolveSubRepoConfigs(
  configJson: Record<string, unknown> | null | undefined,
): SubRepoConfig[] {
  const config = (configJson ?? {}) as Record<string, unknown>;
  const subRepos = config.subRepos;
  if (!Array.isArray(subRepos)) return [];

  const seen = new Set<string>();

  return subRepos.filter((r): r is SubRepoConfig => {
    if (
      r == null ||
      typeof r !== 'object' ||
      typeof (r as Record<string, unknown>).url !== 'string' ||
      typeof (r as Record<string, unknown>).prefix !== 'string' ||
      typeof (r as Record<string, unknown>).branch !== 'string'
    ) {
      return false;
    }

    const raw = (r as SubRepoConfig).prefix.trim().replace(/\/+$/, '');
    if (
      raw.length === 0 ||
      raw.includes('..') ||
      raw.startsWith('/') ||
      raw.includes('\\')
    ) {
      return false;
    }

    if (seen.has(raw)) return false;
    seen.add(raw);

    (r as SubRepoConfig).prefix = raw;
    return true;
  });
}

/**
 * Strict version: throws on invalid or duplicate entries instead of silently filtering.
 * Use at business-line configuration save time to surface errors to the user.
 */
export function validateSubRepoConfigs(
  configJson: Record<string, unknown> | null | undefined,
): SubRepoConfig[] {
  const config = (configJson ?? {}) as Record<string, unknown>;
  const subRepos = config.subRepos;
  if (!Array.isArray(subRepos)) return [];

  const seen = new Set<string>();
  const validated: SubRepoConfig[] = [];

  for (let i = 0; i < subRepos.length; i++) {
    const r = subRepos[i];
    if (r == null || typeof r !== 'object') {
      throw new Error(`subRepos[${i}]: invalid entry`);
    }
    const entry = r as Record<string, unknown>;
    if (typeof entry.url !== 'string' || !entry.url.trim()) {
      throw new Error(`subRepos[${i}]: url is required`);
    }
    if (typeof entry.prefix !== 'string' || !entry.prefix.trim()) {
      throw new Error(`subRepos[${i}]: prefix is required`);
    }
    if (typeof entry.branch !== 'string' || !entry.branch.trim()) {
      throw new Error(`subRepos[${i}]: branch is required`);
    }

    const raw = entry.prefix.trim().replace(/\/+$/, '');
    if (raw.includes('..') || raw.startsWith('/') || raw.includes('\\')) {
      throw new Error(
        `subRepos[${i}]: prefix '${raw}' contains invalid characters`,
      );
    }
    if (seen.has(raw)) {
      throw new Error(`subRepos[${i}]: duplicate prefix '${raw}'`);
    }
    seen.add(raw);

    validated.push({
      url: entry.url.trim(),
      prefix: raw,
      branch: entry.branch.trim(),
    });
  }

  return validated;
}

export function computeSubRepoFingerprint(
  subRepos: Pick<SubRepoConfig, 'url' | 'prefix' | 'branch'>[],
): string {
  const parts = [...subRepos]
    .map((repo) => ({
      prefix: repo.prefix.trim().replace(/\/+$/, ''),
      branch: repo.branch.trim(),
      url: normalizeSubRepoUrl(repo.url),
    }))
    .sort((left, right) => left.prefix.localeCompare(right.prefix))
    .map((repo) => `${repo.prefix}|${repo.url}|${repo.branch}`);

  return createHash('sha256')
    .update(parts.join('\n'))
    .digest('hex')
    .slice(0, 16);
}

export function normalizeSubRepoUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/^https?:\/\/[^@]+@/, 'https://')
    .toLowerCase();
}

/**
 * @deprecated snapshot-sync 模式下返回空数组。Wave 2 移除。
 */
export function resolveSubReposForWorktree(
  worktreePath: string,
  configJson: Record<string, unknown> | null | undefined,
): ResolvedSubRepo[] {
  const configs = resolveSubRepoConfigs(configJson);
  return configs.map((c) => ({
    ...c,
    worktreePath: path.posix.join(worktreePath, c.prefix),
  }));
}

/**
 * @deprecated snapshot-sync 模式下子仓目录作为主仓一部分，不需要 exclude。Wave 2 移除。
 */
export function buildSubRepoExcludePathspecs(
  subRepos: Pick<SubRepoConfig, 'prefix'>[],
): string[] {
  if (subRepos.length === 0) return [];
  return ['--', '.', ...subRepos.map((s) => `:(exclude)${s.prefix}`)];
}

/**
 * @deprecated snapshot-sync 模式下所有路径统一在主仓处理。Wave 2 移除。
 */
export function resolveSubRepoForPath(
  subRepos: ResolvedSubRepo[],
  filePath: string,
): { subRepo: ResolvedSubRepo; relativePath: string } | null {
  const sorted = [...subRepos].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
  for (const sub of sorted) {
    if (filePath.startsWith(sub.prefix + '/')) {
      return {
        subRepo: sub,
        relativePath: filePath.slice(sub.prefix.length + 1),
      };
    }
    if (filePath === sub.prefix) {
      return { subRepo: sub, relativePath: '.' };
    }
  }
  return null;
}
