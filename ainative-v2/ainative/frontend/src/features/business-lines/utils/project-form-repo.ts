type RepoUrlEntry = {
  url: string
}

export function normalizeRepoUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\.git$/, '')
}

export function getDuplicateRepoUrlError(
  repos: RepoUrlEntry[],
  index: number,
): string {
  const url = repos[index]?.url.trim()
  if (!url) return ''

  const normalized = normalizeRepoUrl(url)
  const duplicateIndex = repos.findIndex(
    (repo, repoIndex) =>
      repoIndex !== index && repo.url.trim() && normalizeRepoUrl(repo.url) === normalized,
  )
  if (duplicateIndex === -1) return ''

  return `仓库地址与第 ${duplicateIndex + 1} 个仓库重复`
}

export function findDuplicateRepoUrlMessage(repos: RepoUrlEntry[]): string {
  const seen = new Map<string, string>()
  for (const repo of repos) {
    const trimmed = repo.url.trim()
    if (!trimmed) continue

    const normalized = normalizeRepoUrl(trimmed)
    const existing = seen.get(normalized)
    if (existing) {
      return `仓库地址不能重复：${trimmed}`
    }
    seen.set(normalized, trimmed)
  }
  return ''
}
