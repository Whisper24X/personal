import type {
  Automation,
  AutomationStatus,
  CreateAutomationPayload,
  UpdateAutomationPayload,
} from '@/types/api/automations'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const automationsApi = {
  list(params: {
    projectId: string
    page?: number
    limit?: number
    keyword?: string
    status?: AutomationStatus
  }) {
    return apiHttp.get<InfinityPaginationResponse<Automation>>('/automations', {
      projectId: params.projectId,
      page: params.page,
      limit: params.limit,
      keyword: params.keyword,
      status: params.status,
    })
  },

  detail(automationId: string) {
    return apiHttp.get<Automation>(`/automations/${automationId}`)
  },

  create(payload: CreateAutomationPayload) {
    return apiHttp.post<Automation>('/automations', payload)
  },

  update(automationId: string, payload: UpdateAutomationPayload) {
    return apiHttp.patch<Automation>(`/automations/${automationId}`, payload)
  },

  remove(automationId: string) {
    return apiHttp.delete<void>(`/automations/${automationId}`)
  },
}
