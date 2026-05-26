import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from '@pages/settings/index.vue'

const { routerPush, routerReplace, routeState } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routeState: {
    query: {} as Record<string, unknown>,
  },
}))

const { accessState } = vi.hoisted(() => ({
  accessState: {
    isPlatformAdmin: false,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
}))

vi.mock('@app/stores/modules/access', () => ({
  useAccessStore: () => accessState,
}))

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeState.query = {}
    accessState.isPlatformAdmin = false
  })

  it('renders the full-page settings layout and closes back to home', async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          PersonalSettingsPanel: {
            template: '<div>PersonalSettingsPanel</div>',
          },
          PlatformWorkflowTemplatesPanel: {
            template: '<div>PlatformWorkflowTemplatesPanel</div>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('设置')
    expect(wrapper.text()).toContain('账号')
    expect(wrapper.find('button[aria-label="返回主页面"]').exists()).toBe(true)

    await wrapper.find('button[aria-label="返回主页面"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('switches section by updating the query', async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          PersonalSettingsPanel: {
            template: '<div>PersonalSettingsPanel</div>',
          },
          PlatformWorkflowTemplatesPanel: {
            template: '<div>PlatformWorkflowTemplatesPanel</div>',
          },
        },
      },
    })

    const notificationsButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '通知')

    expect(notificationsButton).toBeDefined()
    await notificationsButton!.trigger('click')

    expect(routerReplace).toHaveBeenCalledWith({
      path: '/settings',
      query: {
        settings: 'notifications',
      },
    })
  })

  it('shows workflow template settings only for platform admins', async () => {
    accessState.isPlatformAdmin = true
    routeState.query = { settings: 'platformWorkflowTemplates' }

    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          PersonalSettingsPanel: {
            template: '<div>PersonalSettingsPanel</div>',
          },
          PlatformWorkflowTemplatesPanel: {
            template: '<div>PlatformWorkflowTemplatesPanel</div>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('平台工作流')
    expect(wrapper.text()).toContain('PlatformWorkflowTemplatesPanel')
  })

  it('falls back when non-admin users request workflow template settings', async () => {
    routeState.query = { settings: 'platformWorkflowTemplates' }

    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          PersonalSettingsPanel: {
            template: '<div>PersonalSettingsPanel</div>',
          },
          PlatformWorkflowTemplatesPanel: {
            template: '<div>PlatformWorkflowTemplatesPanel</div>',
          },
        },
      },
    })

    expect(wrapper.text()).not.toContain('平台工作流')
    expect(wrapper.text()).toContain('账号')
    expect(wrapper.text()).toContain('PersonalSettingsPanel')
  })
})
