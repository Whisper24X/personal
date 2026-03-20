import type { RouteLocationNormalized } from 'vue-router'
import { projectsApi } from '@/api/projects'
import { appSettings } from '@/config/setting'

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

const hasAvailableProject = async () => {
  const response = await projectsApi.list({ page: 1, limit: 1 })
  return response.data.length > 0
}

export const resolveAuthenticatedRedirectPath = async (redirectPath?: unknown) => {
  const normalizedRedirectPath = normalizeRedirectPath(redirectPath)

  try {
    const hasProject = await hasAvailableProject()
    if (!hasProject) {
      return HOME_ROUTE_PATH
    }
  } catch (error) {
    void error
  }

  return normalizedRedirectPath || appSettings.defaultRoute
}

