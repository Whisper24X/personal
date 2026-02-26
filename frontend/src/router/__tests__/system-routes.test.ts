import { describe, expect, it } from 'vitest'
import { SETTINGS_QUERY_KEY } from '@/types/common/settings'
import { systemRoutes } from '@/router/routes/system'

describe('systemRoutes compatibility redirects', () => {
  const findByPath = (path: string) => {
    return systemRoutes.find((route) => route.path === path)
  }

  it('redirects legacy settings routes to dashboard settings sections', () => {
    const aboutRoute = findByPath('/about')
    const businessLinesRoute = findByPath('/business-lines')
    const projectsRoute = findByPath('/projects')
    const usersRoute = findByPath('/users')
    const settingsRoute = findByPath('/settings')

    expect(aboutRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'about' } })
    expect(businessLinesRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'business-lines' } })
    expect(projectsRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'projects' } })
    expect(usersRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'users' } })
    expect(settingsRoute?.redirect).toEqual({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'profile' } })
  })

  it('uses dashboard as default and legacy home redirect target', () => {
    const rootRoute = findByPath('/')
    const homeRoute = findByPath('/home')

    expect(rootRoute?.redirect).toBe('/dashboard')
    expect(homeRoute?.redirect).toBe('/dashboard')
  })
})
