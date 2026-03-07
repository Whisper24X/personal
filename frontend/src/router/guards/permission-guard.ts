import type { NavigationGuardWithThis } from 'vue-router'
import { useAccessStore } from '@/stores/modules/access'
import { STORAGE_KEYS } from '@/types/common/storage'

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
    await accessStore.loadContext({
      ...(projectId ? { projectId } : {}),
    })
  } catch (error) {
    void error
    accessStore.clear()
  }

  const canAccess = requiredCapabilities.some((capability) => accessStore.hasCapability(capability))
  if (!canAccess) {
    if (projectId && accessStore.hasCapability('project.read')) {
      return {
        path: '/dashboard',
        query: { projectId },
      }
    }

    return '/home'
  }

  return true
}
