import type { RouteLocationNormalized } from 'vue-router'
import { businessLinesApi } from '@/api/business-lines'
import { appSettings } from '@app/config/setting'

export const HOME_ROUTE_PATH = '/home'

/**
 * 若地址被写成 `/login?redirect=/task-detail/uuid?projectId=xxx`（第二个 `?` 不合法），
 * 路由器会把 `projectId` 解析成顶层 query，导致 `redirect` 里丢参。登录成功后合并回去。
 */
export const parseLoginRedirectQuery = (
  route: Pick<RouteLocationNormalized, 'query'>,
): string | undefined => {
  const rawRedirect = route.query.redirect
  const redirect =
    typeof rawRedirect === 'string'
      ? rawRedirect
      : Array.isArray(rawRedirect)
        ? rawRedirect[0]
        : undefined

  if (typeof redirect !== 'string' || !redirect.trim()) {
    return undefined
  }

  const rawProjectId = route.query.projectId
  const projectId =
    typeof rawProjectId === 'string'
      ? rawProjectId
      : Array.isArray(rawProjectId)
        ? rawProjectId[0]
        : undefined

  if (projectId && !redirect.includes('projectId=')) {
    const sep = redirect.includes('?') ? '&' : '?'
    return `${redirect}${sep}projectId=${encodeURIComponent(projectId)}`
  }

  return redirect
}

const normalizeRedirectPath = (candidate: unknown) => {
  if (typeof candidate !== 'string') {
    return ''
  }

  const normalizedPath = candidate.trim()
  if (!normalizedPath.startsWith('/') || normalizedPath === '/login') {
    return ''
  }

  return normalizedPath
}

/** 至少存在一条业务线（欢迎页仅在没有业务线时展示） */
export const hasAvailableBusinessLine = async () => {
  const response = await businessLinesApi.list({ page: 1, limit: 1 })
  return response.data.length > 0
}

/**
 * 无路由权限时的回退。
 * 不可再跳转到 `defaultRoute`（通常为 /dashboard），否则与 permissionGuard 形成无限重定向。
 */
export const resolveNoPermissionFallbackRoute = async (): Promise<string> => {
  return HOME_ROUTE_PATH
}

export const resolveAuthenticatedRedirectPath = async (redirectPath?: unknown) => {
  const normalizedRedirectPath = normalizeRedirectPath(redirectPath)

  try {
    const hasBl = await hasAvailableBusinessLine()
    if (!hasBl) {
      return HOME_ROUTE_PATH
    }
  } catch (error) {
    void error
  }

  if (normalizedRedirectPath) {
    return normalizedRedirectPath
  }

  const { useAccessStore } = await import('@app/stores/modules/access')
  const accessStore = useAccessStore()
  try {
    await accessStore.loadContext({})
  } catch {
    accessStore.clear()
  }

  if (accessStore.hasCapability('project.dashboard.read')) {
    return appSettings.defaultRoute
  }

  return HOME_ROUTE_PATH
}

