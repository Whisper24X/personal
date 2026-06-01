/**
 * 根据远程仓库 URL 与 base/head 分支名生成托管平台「新建 PR」页面 URL（GitHub / GitLab / Bitbucket）。
 * 与任务 worktree 无关，可供 Project.gitUrl + 需求分支/功能组分支等场景复用。
 */

function parseRemoteUrl(
  remoteUrl: string,
): { host: string; path: string; protocol: string } | null {
  const trimmed = remoteUrl.trim().replace(/\.git$/i, '');
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('ssh://')
  ) {
    try {
      const parsedUrl = new URL(trimmed);

      return {
        host: parsedUrl.host,
        path: parsedUrl.pathname.replace(/^\/+/, ''),
        protocol: parsedUrl.protocol.replace(':', '') || 'https',
      };
    } catch {
      return null;
    }
  }

  const scpMatch = trimmed.match(/^(?:[^@]+@)?([^:]+):(.+)$/);
  if (scpMatch) {
    return {
      host: scpMatch[1],
      path: scpMatch[2],
      protocol: 'https',
    };
  }

  return null;
}

function buildRepositoryUrl(remoteUrl: string): string | null {
  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) {
    return null;
  }

  const protocol = parsed.protocol === 'http' ? 'http' : 'https';

  return `${protocol}://${parsed.host}/${parsed.path}`;
}

export function buildPullRequestUrl(
  remoteUrl: string,
  baseBranch: string,
  headBranch: string,
): string | null {
  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) {
    return null;
  }

  const repositoryUrl = buildRepositoryUrl(remoteUrl);
  if (!repositoryUrl) {
    return null;
  }

  const encodedBaseBranch = encodeURIComponent(baseBranch);
  const encodedHeadBranch = encodeURIComponent(headBranch);
  const host = parsed.host.toLowerCase();

  if (host.includes('github.com')) {
    return `${repositoryUrl}/compare/${encodedBaseBranch}...${encodedHeadBranch}?expand=1`;
  }

  if (host.includes('gitlab')) {
    return `${repositoryUrl}/-/merge_requests/new?merge_request[source_branch]=${encodedHeadBranch}&merge_request[target_branch]=${encodedBaseBranch}`;
  }

  if (host.includes('bitbucket')) {
    return `${repositoryUrl}/pull-requests/new?source=${encodedHeadBranch}&dest=${encodedBaseBranch}`;
  }

  return null;
}
