import { STORAGE_KEYS } from '@/types/common/storage'
import { storage } from '@/utils/storage'
import type { LoginRequest, LoginResponse } from '@/types/api/auth'

const mockDelay = (duration = 400) => new Promise((resolve) => setTimeout(resolve, duration))

export const authApi = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    await mockDelay()

    const response: LoginResponse = {
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      user: {
        id: 'u-demo',
        name: 'Demo User',
        email: payload.email,
        permissions: ['dashboard:view', 'projects:view', 'tasks:view', 'settings:view'],
      },
    }

    storage.set(STORAGE_KEYS.authToken, response.accessToken)
    storage.set(STORAGE_KEYS.refreshToken, response.refreshToken ?? '')

    return response
  },

  logout() {
    storage.remove(STORAGE_KEYS.authToken)
    storage.remove(STORAGE_KEYS.refreshToken)
  },
}
