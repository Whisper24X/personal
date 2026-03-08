import type { NavigationGuardWithThis } from 'vue-router'
import { useAccessStore } from '@/stores/modules/access'
import { STORAGE_KEYS } from '@/types/common/storage'
import { ROUTE_ACCESS_CONFIG, hasSomeAccess } from '@/constants/access-control'

const normalizeRouteValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim()
  }

  return ''
}

const resolveProjectId = (to: Parameters<NavigationGuardWithThis<undefined>>[0]) => {
  return (
    normalizeRouteValue(to.query.projectId) ||
    normalizeRouteValue(to.params.id) ||
    localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId)?.trim() ||
    ''
  )
}

export const permissionGuard: NavigationGuardWithThis<undefined> = async (to) => {
  const requiredCapabilities = (to.meta.capabilities as string[] | undefined) ?? []
  if (requiredCapabilities.length === 0) return true

  const accessStore = useAccessStore()
  const projectId = resolveProjectId(to)

  try {
    await accessStore.loadContext((projectId ? { projectId } : {}))
  } catch (error) {
    void error
    accessStore.clear()
  }

  const canAccess = hasSomeAccess(requiredCapabilities, (capability) => accessStore.hasCapability(capability))
  if (!canAccess) {
    if (
      projectId &&
      hasSomeAccess(ROUTE_ACCESS_CONFIG.dashboard.capabilities, (capability) => accessStore.hasCapability(capability))
    ) {
      return {
        path: '/dashboard',
        query: { projectId },
      }
    }

    return '/home'
  }

  return true
}
