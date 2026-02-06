import type { NavigationGuardWithThis } from 'vue-router'
import { useUserStore } from '@/stores/modules/user'

export const permissionGuard: NavigationGuardWithThis<undefined> = (to) => {
  const requiredPermissions = (to.meta.permissions as string[] | undefined) ?? []
  if (requiredPermissions.length === 0) return true

  const userStore = useUserStore()
  const canAccess = requiredPermissions.some((permission) => userStore.hasPermission(permission))
  if (!canAccess) return '/dashboard'

  return true
}
