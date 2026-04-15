/** `git diff --name-status` 首列 token（含重命名如 R100） */
export function gitBranchFileStatusLabel(status: string): string {
  const token = status.trim()
  const letter = token.charAt(0).toUpperCase()
  const map: Record<string, string> = {
    M: '修改',
    A: '新增',
    D: '删除',
    R: '重命名',
    C: '复制',
    U: '冲突',
    T: '类型变更',
  }
  return map[letter] || token
}

export function gitBranchFileStatusBadgeClass(status: string): string {
  const letter = status.trim().charAt(0).toUpperCase()
  switch (letter) {
    case 'A':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
    case 'D':
      return 'bg-red-500/15 text-red-700 dark:text-red-400'
    case 'R':
    case 'C':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-400'
    case 'M':
    default:
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  }
}

/** `git status --porcelain` 两列状态，与 TaskGitPanel 一致 */
export function gitWorkspaceStatusLabel(status: string): string {
  const s = status.trim()
  const map: Record<string, string> = {
    M: '修改',
    A: '新增',
    D: '删除',
    R: '重命名',
    C: '复制',
    U: '冲突',
    '??': '未跟踪',
    '!!': '忽略',
  }
  return map[s] || s
}

export function gitWorkspaceStatusBadgeClass(status: string): string {
  const raw = status
  if (raw === '??' || raw === '!!' || raw.includes('?')) {
    return 'bg-sky-500/15 text-sky-800 dark:text-sky-300'
  }
  const t = raw.trim()
  if (t.includes('D')) {
    return 'bg-red-500/15 text-red-700 dark:text-red-400'
  }
  if (t === 'A' || t.startsWith('A')) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  }
  return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
}
