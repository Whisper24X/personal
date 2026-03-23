import { describe, expect, it } from 'vitest'
import { appSettings } from '@/config/setting'
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

    expect(businessLinesRoute?.name).toBe('business-lines-manage')
    expect(typeof businessLinesRoute?.component).toBe('function')
    expect(projectsRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'projects' } })
    expect(usersRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'users' } })
    expect(settingsRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'account' } })
  })

  it('uses configured default route and registers home page', () => {
    const rootRoute = findByPath('/')
    const homeRoute = findByPath('/home')

    expect(rootRoute?.redirect).toBe(appSettings.defaultRoute)
    expect(homeRoute?.name).toBe('home')
    expect(typeof homeRoute?.component).toBe('function')
  })

  it('registers git route for project-level git operations', () => {
    const gitRoute = findByPath('/git')
    expect(gitRoute?.name).toBe('git')
    expect(gitRoute?.meta?.requiresAuth).toBe(true)
  })

  it('renders project detail page at /projects/:id', () => {
    const projectDetailRoute = findByPath('/projects/:id')
    expect(projectDetailRoute?.name).toBe('project-detail')
    expect(projectDetailRoute?.component).toBeDefined()
  })
})
