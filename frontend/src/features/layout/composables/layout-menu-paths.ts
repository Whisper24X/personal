import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { normalizeQueryValue } from './use-layout-types'
import type { MenuItem } from './use-layout-types'

export function resolveMenuPathFromPath(path: string, menuItems: MenuItem[]) {
  const matchedMenu = menuItems.find((item) => path === item.to || path.startsWith(`${item.to}/`))
  return matchedMenu?.to ?? ''
}

/**
 * 根据当前路由解析应对齐的侧栏菜单路径（与 useLayout 内原逻辑一致）。
 */
export function resolveMenuPathFromRoute(
  route: RouteLocationNormalizedLoaded,
  menuItems: MenuItem[],
  loadStoredSelectedMenuPath: () => string,
): string {
  if (route.name === 'task-detail') {
    const storedMenuPath = loadStoredSelectedMenuPath()
    const rememberedTaskMenuPath = menuItems.find((item) => {
      if (item.to !== storedMenuPath) {
        return false
      }

      return item.id === 'tasks' || item.id === 'kanban'
    })?.to

    if (rememberedTaskMenuPath) {
      return rememberedTaskMenuPath
    }

    const tasksMenuPath = menuItems.find((item) => item.id === 'tasks')?.to
    if (tasksMenuPath) {
      return tasksMenuPath
    }
  }

  if (route.name === 'goal-create') {
    const pid = normalizeQueryValue(route.query.projectId).trim()
    if (pid) {
      return `/projects/${pid}/goals`
    }
  }

  if (route.name === 'project-goals') {
    const raw = route.params.projectId
    const pid = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : ''
    if (pid) {
      return `/projects/${pid}/goals`
    }
  }

  if (route.name === 'goal-detail') {
    const storedMenuPath = loadStoredSelectedMenuPath()
    const rememberedGoalMenuPath = menuItems.find((item) => {
      if (item.to !== storedMenuPath) {
        return false
      }
      return item.id === 'goals' || item.id === 'tasks'
    })?.to

    if (rememberedGoalMenuPath) {
      return rememberedGoalMenuPath
    }

    const goalsMenuPath = menuItems.find((item) => item.id === 'goals')?.to
    if (goalsMenuPath) {
      return goalsMenuPath
    }
  }

  return resolveMenuPathFromPath(route.path, menuItems)
}
