import { describe, expect, it } from 'vitest'
import { SETTINGS_QUERY_KEY } from '@/types/common/settings'
import { systemRoutes } from '@/router/routes/system'

describe('systemRoutes compatibility redirects', () => {
  const findByPath = (path: string) => {
    return systemRoutes.find((route) => route.path === path)
  }

  it('redirects legacy settings routes to dashboard settings sections', () => {
    const businessLinesRoute = findByPath('/business-lines')
    const projectsRoute = findByPath('/projects')
    const usersRoute = findByPath('/users')
    const settingsRoute = findByPath('/settings')

    expect(businessLinesRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'business-lines' } })
    expect(projectsRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'projects' } })
    expect(usersRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'users' } })
    expect(settingsRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'account' } })
  })

  it('uses dashboard as default and legacy home redirect target', () => {
    const rootRoute = findByPath('/')
    const homeRoute = findByPath('/home')

    expect(rootRoute?.redirect).toBe('/dashboard')
    expect(homeRoute?.redirect).toBe('/dashboard')
  })

  it('redirects legacy project detail routes to dashboard with project context', () => {
    const projectDetailRoute = findByPath('/projects/:id')
    expect(typeof projectDetailRoute?.redirect).toBe('function')

    if (typeof projectDetailRoute?.redirect !== 'function') {
      throw new Error('project detail redirect should be a function')
    }

    const redirect = projectDetailRoute.redirect as (to: unknown, from: unknown) => unknown
    const target = redirect({ params: { id: 'project-123' } }, {})
    expect(target).toEqual({
      path: '/dashboard',
      query: { projectId: 'project-123' },
    })
  })
})
