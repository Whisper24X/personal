import { ref } from 'vue'
import { authApi } from '@/api/auth'
import { useUserStore } from '@/stores/modules/user'
import type { LoginRequest } from '@/types/api/auth'

export const useAuth = () => {
  const userStore = useUserStore()
  const loading = ref(false)
  const error = ref<string | null>(null)

  const login = async (payload: LoginRequest) => {
    loading.value = true
    error.value = null

    try {
      const result = await authApi.login(payload)
      userStore.setToken(result.accessToken)
      userStore.setProfile(result.user)
      return result
    } catch (exception) {
      error.value = exception instanceof Error ? exception.message : '登录失败'
      throw exception
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    userStore.logout()
  }

  return {
    loading,
    error,
    login,
    logout,
  }
}
