import type { NavigationGuardWithThis } from 'vue-router'
import { useUserStore } from '@/stores/modules/user'

const AUTH_PAGE_PATH = '/login'

export const authGuard: NavigationGuardWithThis<undefined> = (to) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.isLogin) {
    return {
      path: AUTH_PAGE_PATH,
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.path === AUTH_PAGE_PATH && userStore.isLogin) {
    return '/dashboard'
  }

  return true
}
