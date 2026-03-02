import type { CreateMcpPayload, Mcp, UpdateMcpPayload } from '@/types/api/mcps'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const mcpsApi = {
  list(params?: { page?: number; limit?: number; keyword?: string; enabled?: boolean; projectId?: string }) {
    return apiHttp.get<InfinityPaginationResponse<Mcp>>('/mcps', {
      page: params?.page,
      limit: params?.limit,
      keyword: params?.keyword,
      enabled: params?.enabled,
      projectId: params?.projectId,
    })
  },

  detail(mcpId: string) {
    return apiHttp.get<Mcp>(`/mcps/${mcpId}`)
  },

  create(payload: CreateMcpPayload) {
    return apiHttp.post<Mcp>('/mcps', payload)
  },

  update(mcpId: string, payload: UpdateMcpPayload) {
    return apiHttp.patch<Mcp>(`/mcps/${mcpId}`, payload)
  },

  remove(mcpId: string) {
    return apiHttp.delete<void>(`/mcps/${mcpId}`)
  },
}
