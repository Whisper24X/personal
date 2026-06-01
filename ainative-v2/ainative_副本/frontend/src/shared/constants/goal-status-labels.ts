import type { GoalStatus } from '@/types/api/goals'

export const goalStatusLabel: Record<GoalStatus, string> = {
  draft: '草稿',
  prd_generated: 'PRD 已生成',
  prd_confirmed: 'PRD 已确认',
  planned: '计划已生成',
  in_progress: '执行中',
  done: '完成',
  archived: '归档',
}
