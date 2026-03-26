import type {
  Goal,
  GoalDetail,
  GoalPlanItem,
  GoalPlanSubTask,
  GoalSourceDoc,
} from '@/types/api/goals'
import type { Task } from '@/types/api/tasks'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const goalsApi = {
  list(params: {
    projectId: string
    page?: number
    limit?: number
    status?: string
    title?: string
    createdBy?: string
  }) {
    return apiHttp.get<InfinityPaginationResponse<Goal>>('/goals', {
      projectId: params.projectId,
      page: params.page,
      limit: params.limit,
      status: params.status,
      title: params.title,
      createdBy: params.createdBy,
    })
  },

  get(goalId: string) {
    return apiHttp.get<GoalDetail>(`/goals/${goalId}`)
  },

  create(payload: {
    projectId: string
    title: string
    gitBaseBranch: string
    summary?: string
    defaultWorkflowTemplateId?: string
    agentCliId?: string
    agentCliConfigId?: string
  }) {
    return apiHttp.post<Goal>('/goals', payload)
  },

  update(
    goalId: string,
    payload: {
      title?: string
      summary?: string
      status?: string
      defaultWorkflowTemplateId?: string
      agentCliId?: string
      agentCliConfigId?: string
    },
  ) {
    return apiHttp.patch<Goal>(`/goals/${goalId}`, payload)
  },

  remove(goalId: string) {
    return apiHttp.post<void>(`/goals/${goalId}/remove`, {})
  },

  addSourceDoc(
    goalId: string,
    payload: {
      projectDocPath: string
      docType: string
      sortOrder?: number
    },
  ) {
    return apiHttp.post<GoalSourceDoc>(`/goals/${goalId}/source-docs`, payload)
  },

  unpackInputZip(goalId: string, payload: { projectDocPath: string }) {
    return apiHttp.post<{ extractedFileCount: number; paths: string[] }>(
      `/goals/${goalId}/unpack-input-zip`,
      payload,
    )
  },

  generatePrd(
    goalId: string,
    payload?: {
      extraNotes?: string
      overwrite?: boolean
      agentCliId?: string
      agentCliConfigId?: string
    },
  ) {
    return apiHttp.post<{ goal: Goal; markdownLength: number }>(
      `/goals/${goalId}/generate-prd`,
      payload ?? {},
    )
  },

  generatePlan(
    goalId: string,
    payload?: {
      granularity?: string
      overwrite?: boolean
      agentCliId?: string
      agentCliConfigId?: string
    },
  ) {
    return apiHttp.post<{ goal: Goal; itemCount: number; subTaskCount: number }>(
      `/goals/${goalId}/generate-plan`,
      payload ?? {},
    )
  },

  patchPlanItem(
    goalId: string,
    itemId: string,
    payload: Record<string, unknown>,
  ) {
    return apiHttp.patch<GoalPlanItem>(
      `/goals/${goalId}/plan-items/${itemId}`,
      payload,
    )
  },

  getPlanItemPrLink(goalId: string, planItemId: string) {
    return apiHttp.post<{ url: string | null }>(
      `/goals/${goalId}/plan-items/${planItemId}/pr-link`,
      {},
    )
  },

  patchPlanSubTask(
    goalId: string,
    subTaskId: string,
    payload: Record<string, unknown>,
  ) {
    return apiHttp.patch<GoalPlanSubTask>(
      `/goals/${goalId}/plan-sub-tasks/${subTaskId}`,
      payload,
    )
  },

  materializeTasks(goalId: string, planSubTaskIds: string[]) {
    return apiHttp.post<{ tasks: { planSubTaskId: string; taskId: string }[] }>(
      `/goals/${goalId}/materialize-tasks`,
      { planSubTaskIds },
    )
  },

  listTasks(goalId: string) {
    return apiHttp.get<Task[]>(`/goals/${goalId}/tasks`)
  },

  replaceTaskDependencies(
    goalId: string,
    edges: { predecessorTaskId: string; successorTaskId: string }[],
  ) {
    return apiHttp.patch<{ ok: true }>(`/goals/${goalId}/task-dependencies`, {
      edges,
    })
  },
}
