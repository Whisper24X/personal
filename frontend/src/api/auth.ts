import type {
  LoginRequest,
  LoginResponse,
  UserInfo,
} from '@/types/api/auth'
import { STORAGE_KEYS } from '@/types/common/storage'
import { storage } from '@/utils/storage'
import { apiHttp } from './http'

export const authApi = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const response = await apiHttp.post<LoginResponse>('/auth/login', payload)

    storage.set(STORAGE_KEYS.authToken, response.token)
    storage.set(STORAGE_KEYS.refreshToken, response.refreshToken)

    return response
  },

  async me(): Promise<UserInfo> {
    return apiHttp.get<UserInfo>('/auth/me')
  },

  async logout(): Promise<void> {
    try {
      await apiHttp.post<void>('/auth/logout')
    } finally {
      storage.remove(STORAGE_KEYS.authToken)
      storage.remove(STORAGE_KEYS.refreshToken)
    }
  },
}
