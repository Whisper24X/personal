import type {
  CreateWorkflowTemplatePayload,
  ReorderWorkflowTemplateNodesPayload,
  UpdateWorkflowTemplatePayload,
  WorkflowTemplateScope,
  WorkflowTemplate,
} from '@/types/api/workflow'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const workflowApi = {
  list(params?: {
    page?: number
    limit?: number
    keyword?: string
    isActive?: boolean
    scope?: WorkflowTemplateScope
    businessLineId?: string
    projectId?: string
  }) {
    return apiHttp.get<InfinityPaginationResponse<WorkflowTemplate>>('/workflow-templates', {
      page: params?.page,
      limit: params?.limit,
      keyword: params?.keyword,
      isActive: params?.isActive,
      scope: params?.scope,
      businessLineId: params?.businessLineId,
      projectId: params?.projectId,
    })
  },

  detail(templateId: string) {
    return apiHttp.get<WorkflowTemplate>(`/workflow-templates/${templateId}`)
  },

  create(payload: CreateWorkflowTemplatePayload) {
    return apiHttp.post<WorkflowTemplate>('/workflow-templates', payload)
  },

  update(templateId: string, payload: UpdateWorkflowTemplatePayload) {
    return apiHttp.patch<WorkflowTemplate>(`/workflow-templates/${templateId}`, payload)
  },

  reorderNodes(templateId: string, payload: ReorderWorkflowTemplateNodesPayload) {
    return apiHttp.put<WorkflowTemplate>(`/workflow-templates/${templateId}/nodes/reorder`, payload)
  },

  remove(templateId: string) {
    return apiHttp.delete<void>(`/workflow-templates/${templateId}`)
  },
}
