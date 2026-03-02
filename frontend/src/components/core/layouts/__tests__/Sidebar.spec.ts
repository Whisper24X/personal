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

    expect(wrapper.text()).toContain('项目导航')
    expect(wrapper.text()).toContain('仪表盘')
    expect(wrapper.text()).toContain('任务')
    expect(wrapper.text()).not.toContain('用户')
    expect(wrapper.text()).not.toContain('关于')

    const settingsButton = wrapper.findAll('button').find((button) => button.text() === '设置')
    expect(settingsButton).toBeDefined()
    await settingsButton!.trigger('click')
    expect(openSettings).toHaveBeenCalledTimes(1)
  })
})
