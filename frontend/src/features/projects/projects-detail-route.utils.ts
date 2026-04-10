export type ProjectsDetailTabKey =
  | 'overview'
  | 'context'
  | 'members'
  | 'workflow'
  | 'config'

export function normalizeRouteParam(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

export function resolveProjectsDetailRouteTab(value: unknown): ProjectsDetailTabKey | '' {
  const rawValue = normalizeRouteParam(value)
  if (
    rawValue === 'overview' ||
    rawValue === 'context' ||
    rawValue === 'members' ||
    rawValue === 'workflow' ||
    rawValue === 'config'
  ) {
    return rawValue
  }

  return ''
}

export function resolveProjectsDetailInitialTab(options: {
  path: string
  queryTab: unknown
}): ProjectsDetailTabKey {
  const workflowOnly =
    options.path === '/projects/workflows' || options.path.endsWith('/workflows')
  if (workflowOnly) {
    return 'workflow'
  }

  const routeTab = resolveProjectsDetailRouteTab(options.queryTab)
  if (routeTab) {
    return routeTab
  }

  return 'overview'
}
