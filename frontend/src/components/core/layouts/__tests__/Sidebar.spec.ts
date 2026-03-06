import { describe, expect, it, vi } from 'vitest'
import { RouterLinkStub, mount } from '@vue/test-utils'
import Sidebar from '@/components/core/layouts/Sidebar.vue'

describe('Sidebar menu scope', () => {
  it('renders project-scoped menu items and triggers settings open', async () => {
    const openSettings = vi.fn()

    const wrapper = mount(Sidebar, {
      props: {
        mobileNavOpen: true,
        sidebarCollapsed: false,
        currentBusinessLineName: 'Retail',
        projectItems: [],
        menuItems: [
          { id: 'dashboard', label: '仪表盘', to: '/dashboard' },
          { id: 'tasks', label: '任务', to: '/tasks' },
        ],
        showProjectMenuColumn: true,
        projectNavigationTo: (projectId: string) => ({ path: '/dashboard', query: { projectId } }),
        projectItemClass: () => '',
        menuItemClass: () => '',
        projectShortLabel: (short: string) => short,
        menuIconFor: () => [],
        setMobileNavOpen: () => undefined,
        toggleMenuCollapsed: () => undefined,
        showProjectTooltip: () => undefined,
        showMenuTooltip: () => undefined,
        hideProjectTooltip: () => undefined,
        openBusinessLineModal: () => undefined,
        openSettings,
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Retail')
    expect(wrapper.text()).toContain('AINATIVE')
    expect(wrapper.text()).toContain('仪表盘')
    expect(wrapper.text()).toContain('任务')
    expect(wrapper.text()).not.toContain('用户')
    expect(wrapper.text()).not.toContain('关于')
    expect(wrapper.findAllComponents(RouterLinkStub)[0]?.props('to')).toBe('/home')

    const settingsButton = wrapper.findAll('button').find((button) => button.text() === '设置')
    expect(settingsButton).toBeDefined()
    await settingsButton!.trigger('click')
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('hides second menu column until a project is selected', () => {
    const wrapper = mount(Sidebar, {
      props: {
        mobileNavOpen: true,
        sidebarCollapsed: false,
        currentBusinessLineName: 'Retail',
        projectItems: [],
        menuItems: [
          { id: 'dashboard', label: '仪表盘', to: '/dashboard' },
          { id: 'tasks', label: '任务', to: '/tasks' },
        ],
        showProjectMenuColumn: false,
        projectNavigationTo: (projectId: string) => ({ path: '/dashboard', query: { projectId } }),
        projectItemClass: () => '',
        menuItemClass: () => '',
        projectShortLabel: (short: string) => short,
        menuIconFor: () => [],
        setMobileNavOpen: () => undefined,
        toggleMenuCollapsed: () => undefined,
        showProjectTooltip: () => undefined,
        showMenuTooltip: () => undefined,
        hideProjectTooltip: () => undefined,
        openBusinessLineModal: () => undefined,
        openSettings: () => undefined,
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Retail')
    expect(wrapper.text()).not.toContain('仪表盘')
    expect(wrapper.text()).not.toContain('任务')
  })
})
