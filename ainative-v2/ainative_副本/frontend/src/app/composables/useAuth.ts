import { ref } from 'vue'
import { authApi } from '@/api/auth'
import { useUserStore } from '@app/stores/modules/user'
import type { LoginRequest, RegisterRequest } from '@/types/api/auth'

export const useAuth = () => {
  const userStore = useUserStore()
  const loading = ref(false)
  const error = ref<string | null>(null)

  const login = async (payload: LoginRequest) => {
    loading.value = true
    error.value = null

    try {
      const result = await authApi.login(payload)
      const { useAccessStore } = await import('@app/stores/modules/access')
      useAccessStore().clear()
      userStore.setToken(result.token)
      userStore.setProfile(userStore.mapUserToProfile(result.user))
      return result
    } catch (exception) {
      error.value = exception instanceof Error ? exception.message : '登录失败'
      throw exception
    } finally {
      loading.value = false
    }
  }

  const register = async (payload: RegisterRequest) => {
    loading.value = true
    error.value = null

    try {
      await authApi.register(payload)
    } catch (exception) {
      error.value = exception instanceof Error ? exception.message : '注册失败'
      throw exception
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    await userStore.logout()
  }

  return {
    loading,
    error,
    login,
    register,
    logout,
  }
}
