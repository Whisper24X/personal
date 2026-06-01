import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { normalizeQueryValue } from './use-layout-types'

/** `/projects/:segment/...` where `segment` is not a project id (e.g. app routes under `/projects`). */
const RESERVED_PROJECT_SCOPED_PATH_SEGMENTS = new Set(['workflows'])

/** Resolve current project id from route params, query, or `/projects/:id` path prefix. */
export function getProjectIdFromRoute(route: RouteLocationNormalizedLoaded): string {
  const routeProjectId = route.params.id
  if (typeof routeProjectId === 'string') return routeProjectId
  if (Array.isArray(routeProjectId)) return routeProjectId[0] ?? ''

  const queryProjectId = normalizeQueryValue(route.query.projectId).trim()
  if (queryProjectId) {
    return queryProjectId
  }

  const projectPathMatch = route.path.match(/^\/projects\/([^/]+)/)
  const rawSegment = projectPathMatch?.[1]
  if (rawSegment) {
    const segment = decodeURIComponent(rawSegment)
    if (!RESERVED_PROJECT_SCOPED_PATH_SEGMENTS.has(segment)) {
      return segment
    }
  }

  return ''
}
