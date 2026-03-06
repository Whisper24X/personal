import { projectsApi } from '@/api/projects'
import { appSettings } from '@/config/setting'

export const HOME_ROUTE_PATH = '/home'

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

