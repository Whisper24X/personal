import { computed, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from 'vue-router'
import { useAccessStore } from '@app/stores/modules/access'
import {
  BUTTON_ACCESS_CONFIG,
  PROJECT_MENU_ACCESS_CONFIG,
  hasSomeAccess,
  type ProjectMenuId,
} from '@shared/constants/access-control'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { resolveMenuPathFromRoute as resolveMenuPathForRouteImpl } from './layout-menu-paths'
import { LAYOUT_MENU_ICON_PATHS } from './layout-menu-icons'
import { getProjectIdFromRoute } from './layout-project-route'
import type { BusinessLine, MenuItem } from './use-layout-types'
import { loadStoredSelectedMenuPath } from './use-layout-types'

type AccessStore = ReturnType<typeof useAccessStore>

export function useLayoutSidebarNav(options: {
  route: RouteLocationNormalizedLoaded
  router: Router
  accessStore: AccessStore
  businessLines: Ref<BusinessLine[]>
  activeBusinessLineId: Ref<string>
  selectedProjectId: Ref<string>
}) {
  const { route, router, accessStore, businessLines, activeBusinessLineId, selectedProjectId } = options

  const baseMenuItems: MenuItem[] = PROJECT_MENU_ACCESS_CONFIG.map((item) => ({
    id: item.id,
    label: item.label,
    to: item.to,
    capabilities: [...item.capabilities],
  }))

  const menuItems = computed<MenuItem[]>(() => {
    const pid = selectedProjectId.value.trim()
    const goalsListTo = pid ? `/projects/${pid}/goals` : '/dashboard'

    return baseMenuItems
      .filter((item) => {
        return hasSomeAccess(item.capabilities, (capability) => accessStore.hasCapability(capability))
      })
      .map((item) => {
        if (item.id === 'goals') {
          return {
            ...item,
            to: goalsListTo,
          }
        }
        return item
      })
  })

  const resolveMenuPathFromRoute = () =>
    resolveMenuPathForRouteImpl(route, menuItems.value, loadStoredSelectedMenuPath)

  const setSelectedMenuPath = (menuPath: string) => {
    if (menuPath) {
      localStorage.setItem(STORAGE_KEYS.lastSelectedMenuPath, menuPath)
      return
    }

    localStorage.removeItem(STORAGE_KEYS.lastSelectedMenuPath)
  }

  const syncSelectedMenuPath = () => {
    const menuPath = resolveMenuPathFromRoute()
    if (!menuPath) {
      return
    }

    setSelectedMenuPath(menuPath)
  }

  const resolveProjectMenuPath = () => {
    const routeMenuPath = resolveMenuPathFromRoute()
    if (routeMenuPath) {
      return routeMenuPath
    }

    const storedMenuPath = loadStoredSelectedMenuPath()
    if (storedMenuPath && menuItems.value.some((item) => item.to === storedMenuPath)) {
      return storedMenuPath
    }

    return menuItems.value[0]?.to ?? '/home'
  }

  const PROJECT_GOALS_LIST_PATH = /^\/projects\/[^/]+\/goals$/

  const buildProjectNavigationTarget = (projectId: string, menuPath: string): RouteLocationRaw => {
    if (PROJECT_GOALS_LIST_PATH.test(menuPath)) {
      return {
        name: 'project-goals',
        params: { projectId },
      }
    }

    return {
      path: menuPath,
      query: {
        projectId,
      },
    }
  }

  const projectNavigationTo = (projectId: string): RouteLocationRaw => {
    return buildProjectNavigationTarget(projectId, resolveProjectMenuPath())
  }

  const hasAnyBusinessLine = computed(() => businessLines.value.length > 0)

  const ensureAccessibleRoute = async (projectId?: string) => {
    const requiredCapabilities = (route.meta.capabilities as string[] | undefined) ?? []
    if (requiredCapabilities.length === 0) {
      return
    }

    const canAccessRoute = requiredCapabilities.some((capability) => accessStore.hasCapability(capability))
    if (canAccessRoute) {
      return
    }

    const normalizedProjectId = projectId?.trim() || ''
    const fallbackMenuPath = menuItems.value[0]?.to ?? '/home'

    if (fallbackMenuPath === '/home' || !normalizedProjectId) {
      const canDashboard = accessStore.hasCapability('project.dashboard.read')
      const targetPath = hasAnyBusinessLine.value && canDashboard ? '/dashboard' : '/home'
      if (route.path !== targetPath) {
        await router.replace(targetPath)
      }
      return
    }

    if (PROJECT_GOALS_LIST_PATH.test(fallbackMenuPath)) {
      const currentProjectId = getProjectIdFromRoute(route)
      if (route.name === 'project-goals' && currentProjectId === normalizedProjectId) {
        return
      }

      await router.replace(buildProjectNavigationTarget(normalizedProjectId, fallbackMenuPath))
      return
    }

    const currentProjectId = route.query.projectId
    const normalizedQueryProjectId =
      typeof currentProjectId === 'string'
        ? currentProjectId
        : Array.isArray(currentProjectId)
          ? currentProjectId[0] ?? ''
          : ''

    if (route.path === fallbackMenuPath && normalizedQueryProjectId === normalizedProjectId) {
      return
    }

    await router.replace(buildProjectNavigationTarget(normalizedProjectId, fallbackMenuPath))
  }

  const isRouteActive = (to: string) => {
    const routeMenuPath = resolveMenuPathFromRoute()
    if (routeMenuPath) {
      return routeMenuPath === to
    }

    return route.path === to || route.path.startsWith(`${to}/`)
  }

  const isNavActive = (to: string) => {
    return isRouteActive(to)
  }

  const workbenchNavTo = computed((): RouteLocationRaw => {
    const pid = selectedProjectId.value.trim()
    if (pid) {
      return { path: '/dashboard', query: { projectId: pid } }
    }

    if (hasAnyBusinessLine.value && !activeBusinessLineId.value.trim()) {
      return { path: '/home' }
    }

    if (hasAnyBusinessLine.value) {
      return { path: '/dashboard' }
    }

    return { path: '/home' }
  })

  const isWorkbenchNavActive = () => {
    const pid = selectedProjectId.value.trim()
    if (pid) {
      return route.name === 'dashboard'
    }

    if (hasAnyBusinessLine.value && !activeBusinessLineId.value.trim()) {
      return route.name === 'home' || route.path === '/home'
    }

    if (hasAnyBusinessLine.value) {
      return route.name === 'dashboard'
    }

    return route.name === 'home' || route.path === '/home'
  }

  const HEADER_TOOL_MENU_ORDER: readonly ProjectMenuId[] = ['workflow', 'skills', 'automations', 'mcp', 'git']

  const headerToolMenuItems = computed(() => {
    const byId = new Map(menuItems.value.map((item) => [item.id, item]))
    return HEADER_TOOL_MENU_ORDER.map((id) => byId.get(id)).filter((item): item is MenuItem => Boolean(item))
  })

  const sidebarCoreTasksKnowledge = computed(() => {
    return {
      goals: menuItems.value.find((item) => item.id === 'goals'),
      tasks: menuItems.value.find((item) => item.id === 'tasks'),
      knowledge: menuItems.value.find((item) => item.id === 'knowledge'),
    }
  })

  const menuItemClass = (to: string) => {
    if (isRouteActive(to)) {
      return 'bg-primary/10 font-semibold text-foreground dark:bg-primary/18'
    }

    return 'text-sidebar-foreground/75 hover:bg-primary/[0.06] hover:text-sidebar-foreground dark:hover:bg-primary/12'
  }

  const menuIconFor = (menuId: MenuItem['id']) => LAYOUT_MENU_ICON_PATHS[menuId]

  const canCreateBusinessLine = computed(() => {
    return accessStore.isPlatformAdmin
  })

  const canCreateProject = computed(() => {
    return hasSomeAccess(
      BUTTON_ACCESS_CONFIG.createProjectItem.capabilities,
      (capability) => accessStore.hasCapability(capability),
    )
  })

  return {
    menuItems,
    resolveMenuPathFromRoute,
    setSelectedMenuPath,
    syncSelectedMenuPath,
    resolveProjectMenuPath,
    buildProjectNavigationTarget,
    projectNavigationTo,
    ensureAccessibleRoute,
    isRouteActive,
    isNavActive,
    workbenchNavTo,
    isWorkbenchNavActive,
    headerToolMenuItems,
    sidebarCoreTasksKnowledge,
    menuItemClass,
    menuIconFor,
    canCreateBusinessLine,
    canCreateProject,
  }
}
