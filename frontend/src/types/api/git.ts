export type GitBranches = {
  defaultBranch: string
  currentBranch: string | null
  localBranches: string[]
  remoteBranches: string[]
}

export type GitStatus = {
  defaultBranch: string
  currentBranch: string | null
  isOnDefaultBranch: boolean
  hasUncommittedChanges: boolean
  changedFilesCount: number
}

export type GitCommitSummary = {
  sha: string
  shortSha: string
  message: string
  authorName: string
  committedAt: string
}

export type GitLog = {
  commits: GitCommitSummary[]
}

export type GitPullMainResult = {
  branch: string
  output: string
}

export type GitBranchActionResult = {
  success: boolean
  branch: string
  output: string
}

export type GitChangedFile = {
  path: string
  status: 'M' | 'A' | 'D' | '??'
}

export type GitChangedFiles = {
  modified: string[]
  added: string[]
  deleted: string[]
  untracked: string[]
}

export type GitPushResult = {
  success: boolean
  output: string
  pushedCommits: number
}

export type GitCommitDetail = {
  sha: string
  message: string
  authorName: string
  authorEmail: string
  committedAt: string
  changedFiles: Array<{
    path: string
    status: 'M' | 'A' | 'D'
    additions: number
    deletions: number
  }>
}

export type GitLogPaginated = {
  commits: GitCommitSummary[]
  total: number
  hasMore: boolean
}

export type GitBranchDetail = {
  name: string
  type: 'local' | 'remote' | 'both'
  isCurrent: boolean
  tracking?: string
  ahead: number
  behind: number
  lastCommit: {
    sha: string
    shortSha: string
    message: string
    author: string
    committedAt: string
  }
}

export type GitBranchesDetail = {
  branches: GitBranchDetail[]
}

export type GitCheckoutResult = {
  success: boolean
  branch: string
  output: string
}

export type GitCreateBranchResult = {
  success: boolean
  branch: string
}

export type GitDeleteBranchResult = {
  success: boolean
  branch: string
}
