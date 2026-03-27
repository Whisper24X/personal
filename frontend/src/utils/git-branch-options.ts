/**
 * 合并本地/远程/优先分支为去重后的下拉选项顺序（与任务创建页一致）。
 */
export function buildBranchOptions({
  localBranches,
  remoteBranches,
  preferredBranches,
}: {
  localBranches: string[]
  remoteBranches: string[]
  preferredBranches: string[]
}): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const branch of [...preferredBranches, ...localBranches, ...remoteBranches]) {
    const normalizedBranch = branch.trim()

    if (!normalizedBranch || seen.has(normalizedBranch)) {
      continue
    }

    seen.add(normalizedBranch)
    result.push(normalizedBranch)
  }

  return result
}
