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
