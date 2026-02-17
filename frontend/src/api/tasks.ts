import type {
  ApproveTaskPayload,
  CreateTaskArtifactPayload,
  CreateTaskPayload,
  RetryTaskPayload,
  Task,
  TaskArtifact,
  TaskDetail,
  TaskLog,
} from '@/types/api/tasks'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const tasksApi = {
  list(params?: {
    page?: number
    limit?: number
    projectId?: string
    status?: string
  }) {
    return apiHttp.get<InfinityPaginationResponse<Task>>('/tasks', {
      page: params?.page,
      limit: params?.limit,
      projectId: params?.projectId,
      status: params?.status,
    })
  },

  detail(taskId: string) {
    return apiHttp.get<Task>(`/tasks/${taskId}`)
  },

  detailWithNodes(taskId: string) {
    return apiHttp.get<TaskDetail>(`/tasks/${taskId}/detail`)
  },

  create(payload: CreateTaskPayload) {
    return apiHttp.post<Task>('/tasks', payload)
  },

  execute(taskId: string) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/execute`)
  },

  retry(taskId: string, payload: RetryTaskPayload) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/retry`, payload)
  },

  cancel(taskId: string) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/cancel`)
  },

  approve(taskId: string, payload: ApproveTaskPayload) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/approve`, payload)
  },

  cleanupWorktree(taskId: string) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/cleanup-worktree`)
  },

  logs(taskId: string, params?: { since?: string; afterId?: string; limit?: number }) {
    return apiHttp.get<TaskLog[]>(`/tasks/${taskId}/logs`, {
      since: params?.since,
      afterId: params?.afterId,
      limit: params?.limit,
    })
  },

  artifacts(taskId: string) {
    return apiHttp.get<TaskArtifact[]>(`/tasks/${taskId}/artifacts`)
  },

  createArtifact(taskId: string, payload: CreateTaskArtifactPayload) {
    return apiHttp.post<TaskArtifact>(`/tasks/${taskId}/artifacts`, payload)
  },
}
