export type GitBranches = {
  defaultBranch: string
  currentBranch: string | null
  localBranches: string[]
  remoteBranches: string[]
}

export type GitPullMainResult = {
  branch: string
  output: string
}
