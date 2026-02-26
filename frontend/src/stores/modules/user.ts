import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/auth'
import { STORAGE_KEYS } from '@/types/common/storage'
import type { UserInfo } from '@/types/api/auth'

export type UserProfile = {
  id: string
  name: string
  username: string
  avatar?: string | null
  permissions: string[]
  isAdmin: boolean
}

const mapUserToProfile = (user: UserInfo): UserProfile => {
  const allPermissions = [
    'home:view',
    'dashboard:view',
    'about:view',
    'kanban:view',
    'workflow:view',
    'tasks:view',
    'projects:view',
    'business-lines:view',
    'skills:view',
    'mcp:view',
    'automations:view',
    'settings:view',
    'users:view',
  ]

  const defaultPermissions = allPermissions.filter((permission) => permission !== 'users:view')

  return {
    id: user.id,
    name: user.nickname?.trim() || user.username,
    username: user.username,
    avatar: user.avatar,
    permissions: user.isAdmin ? allPermissions : defaultPermissions,
    isAdmin: user.isAdmin,
  }
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

  const loadMe = async () => {
    if (!token.value) {
      profile.value = null
      return null
    }

    const me = await authApi.me()
    const mappedProfile = mapUserToProfile(me)
    setProfile(mappedProfile)
    return mappedProfile
  }

  const logout = async () => {
    await authApi.logout()
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
    loadMe,
    logout,
    mapUserToProfile,
  }
})
