import { apiHttp, type InfinityPaginationResponse } from './http'

export type BusinessLine = {
  id: string
  name: string
  description?: string | null
}

export const businessLinesApi = {
  list(params?: { page?: number; limit?: number }) {
    return apiHttp.get<InfinityPaginationResponse<BusinessLine>>('/business-lines', {
      page: params?.page,
      limit: params?.limit,
    })
  },
}
