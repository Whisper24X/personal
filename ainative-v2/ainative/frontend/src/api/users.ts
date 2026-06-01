import type { CreateUserPayload, UpdateUserPayload, User } from '@/types/api/users'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const usersApi = {
  list(params?: { page?: number; limit?: number }) {
    return apiHttp.get<InfinityPaginationResponse<User>>('/users', {
      page: params?.page,
      limit: params?.limit,
    })
  },

  detail(userId: string) {
    return apiHttp.get<User>(`/users/${userId}`)
  },

  create(payload: CreateUserPayload) {
    return apiHttp.post<User>('/users', payload)
  },

  update(userId: string, payload: UpdateUserPayload) {
    return apiHttp.patch<User>(`/users/${userId}`, payload)
  },

  remove(userId: string) {
    return apiHttp.delete<void>(`/users/${userId}`)
  },
}
