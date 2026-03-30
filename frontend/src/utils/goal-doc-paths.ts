/** 与 backend/src/goals/goal-doc-paths.ts 中 goalInputDirRelativePath 保持一致（相对项目 docs/） */
export function goalInputDirRelativePath(goalId: string): string {
  return `goals/${goalId}/input`
}
