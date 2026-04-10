import { ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/auth'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import type { UserInfo } from '@/types/api/auth'
import { sessionIsLoggedIn, sessionToken, setSessionToken, syncSessionTokenFromStorage } from '../auth-session'
import { useAccessStore } from './access'

export type UserProfile = {
  id: string
  name: string
  username: string
  avatar?: string | null
}

const mapUserToProfile = (user: UserInfo): UserProfile => {
  return {
    id: user.id,
    name: user.nickname?.trim() || user.username,
    username: user.username,
    avatar: user.avatar,
  }
}

export const useUserStore = defineStore('user', () => {
  syncSessionTokenFromStorage()

  const token = sessionToken
  const profile = ref<UserProfile | null>(null)

  const isLogin = sessionIsLoggedIn

  const setToken = (nextToken: string | null) => {
    setSessionToken(nextToken)
  }

  const setProfile = (nextProfile: UserProfile | null) => {
    profile.value = nextProfile
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
    useAccessStore().clear()
    localStorage.removeItem(STORAGE_KEYS.lastActiveBusinessLineId)
    setToken(null)
    setProfile(null)
  }

  return {
    token,
    profile,
    isLogin,
    setToken,
    setProfile,
    loadMe,
    logout,
    mapUserToProfile,
  }
})
