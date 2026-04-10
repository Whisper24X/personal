import { describe, expect, it } from 'vitest'
import { appSettings } from '@app/config/setting'
import { SETTINGS_QUERY_KEY } from '@shared/types/common/settings'
import { systemRoutes } from '@app/router/routes/system'

describe('systemRoutes compatibility redirects', () => {
  const findByPath = (path: string) => {
    return systemRoutes.find((route) => route.path === path)
  }

  it('redirects legacy settings routes to dashboard settings sections', () => {
    const businessLinesRoute = findByPath('/business-lines')
    const usersRoute = findByPath('/users')
    const settingsRoute = findByPath('/settings')

    expect(businessLinesRoute?.name).toBe('business-lines-manage')
    expect(typeof businessLinesRoute?.component).toBe('function')
    expect(businessLinesRoute?.meta?.layout).toBe('workspace-page')
    expect(businessLinesRoute?.meta?.contentMode).toBe('full')
    expect(usersRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'users' } })
    expect(settingsRoute?.name).toBe('settings')
    expect(typeof settingsRoute?.component).toBe('function')
    expect(settingsRoute?.meta?.layout).toBe('workspace-page')
    expect(settingsRoute?.meta?.contentMode).toBe('full')
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

  it('redirects /projects/:id to dashboard with projectId', () => {
    const projectDetailRoute = findByPath('/projects/:id')
    expect(projectDetailRoute?.name).toBe('project-detail')
    expect(typeof projectDetailRoute?.redirect).toBe('function')

    const redirect = projectDetailRoute?.redirect as ((to: { params: { id: string } }) => unknown) | undefined
    expect(redirect).toBeTypeOf('function')

    const redirectResult = redirect!({
      params: { id: 'project-1' },
    })

    expect(redirectResult).toEqual({
      path: '/dashboard',
      query: { projectId: 'project-1' },
    })
  })
})
