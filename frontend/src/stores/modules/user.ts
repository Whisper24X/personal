import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/auth'
import { STORAGE_KEYS } from '@/types/common/storage'

export type UserProfile = {
  id: string
  name: string
  email: string
  permissions: string[]
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem(STORAGE_KEYS.authToken))
  const profile = ref<UserProfile | null>(null)

  const isLogin = computed(() => Boolean(token.value))

  const setToken = (nextToken: string | null) => {
    token.value = nextToken
  }

  const setProfile = (nextProfile: UserProfile | null) => {
    profile.value = nextProfile
  }

  const hasPermission = (permission: string) => {
    if (!profile.value) return false
    return profile.value.permissions.includes(permission)
  }

  const logout = () => {
    authApi.logout()
    setToken(null)
    setProfile(null)
  }

  return {
    token,
    profile,
    isLogin,
    setToken,
    setProfile,
    hasPermission,
    logout,
  }
})
