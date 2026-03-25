import type { Task } from '@/types/api/tasks'
import type { TaskStatus } from '@/types/api/tasks'

export type GoalStatus =
  | 'draft'
  | 'prd_generated'
  | 'prd_confirmed'
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'archived'

export type Goal = {
  id: string
  projectId: string
  title: string
  summary?: string | null
  status: GoalStatus
  prdDocPath?: string | null
  planDocPath?: string | null
  defaultWorkflowTemplateId?: string | null
  /** 生成 PRD/拆解计划时默认使用的 Agent CLI */
  agentCliId?: string | null
  agentCliConfigId?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type GoalSourceDocType = 'prototype' | 'requirement' | 'reference'

export type GoalSourceDoc = {
  id: string
  goalId: string
  projectDocPath: string
  docType: GoalSourceDocType
  sortOrder: number
  createdAt: string
}

export type GoalPlanItemStatus = 'draft' | 'approved' | 'task_created' | 'cancelled'

export type GoalPlanItem = {
  id: string
  goalId: string
  title: string
  summary?: string | null
  acceptanceCriteria?: string | null
  suggestedPrompt?: string | null
  dependsOnItemIds: string[]
  itemOrder: number
  taskId?: string | null
  /** 物化该计划项时使用的项目工作流模板 ID */
  workflowTemplateId?: string | null
  /** 物化任务时使用的 Git 基准分支；未设置则与新建任务一致使用项目默认 */
  gitBaseBranch?: string | null
  status: GoalPlanItemStatus
  createdAt: string
  updatedAt: string
}

export type TaskDependencyEdge = {
  id: string
  predecessorTaskId: string
  successorTaskId: string
  relationType: 'blocks'
  createdAt: string
}

export type GoalProgress = {
  totalTasks: number
  doneTasks: number
  percent: number
  statusCounts: Record<TaskStatus, number>
}

export type GoalDetail = {
  goal: Goal
  sourceDocs: GoalSourceDoc[]
  planItems: GoalPlanItem[]
  tasks: Task[]
  taskDependencies: TaskDependencyEdge[]
  progress: GoalProgress
}
