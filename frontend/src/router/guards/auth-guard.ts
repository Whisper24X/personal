import type { NavigationGuardWithThis } from 'vue-router'
import { useUserStore } from '@/stores/modules/user'
import { STORAGE_KEYS } from '@/types/common/storage'
import { resolveAuthenticatedRedirectPath } from '@/utils/router/post-auth'

const AUTH_PAGE_PATH = '/login'

let restoringSessionPromise: Promise<void> | null = null

const clearAuthState = (userStore: ReturnType<typeof useUserStore>) => {
  userStore.setToken(null)
  userStore.setProfile(null)
  localStorage.removeItem(STORAGE_KEYS.authToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
}

const ensureProfileLoaded = async (userStore: ReturnType<typeof useUserStore>) => {
  if (!userStore.token || userStore.profile) {
    return
  }

  if (!restoringSessionPromise) {
    restoringSessionPromise = userStore
      .loadMe()
      .then(() => undefined)
      .catch(() => {
        clearAuthState(userStore)
      })
      .finally(() => {
        restoringSessionPromise = null
      })
  }

  await restoringSessionPromise
}

export const authGuard: NavigationGuardWithThis<undefined> = async (to) => {
  const userStore = useUserStore()

  await ensureProfileLoaded(userStore)

  if (to.meta.requiresAuth && !userStore.isLogin) {
    return {
      path: AUTH_PAGE_PATH,
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.path === AUTH_PAGE_PATH && userStore.isLogin) {
    return resolveAuthenticatedRedirectPath(to.query.redirect)
  }

  return true
}
