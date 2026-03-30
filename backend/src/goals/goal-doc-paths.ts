/** 项目 docs 下与需求（Goal）相关的固定相对路径（不含 docs/ 前缀） */
export function goalPrdRelativePath(goalId: string): string {
  return `goals/${goalId}/PRD.md`;
}

export function goalTaskPlanRelativePath(goalId: string): string {
  return `goals/${goalId}/task-plan.md`;
}

export function goalInputDirRelativePath(goalId: string): string {
  return `goals/${goalId}/input`;
}
