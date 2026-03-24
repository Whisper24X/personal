import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from '@/views/settings/index.vue'

const { routerPush, routerReplace, routeState } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routeState: {
    query: {} as Record<string, unknown>,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
}))

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeState.query = {}
  })

  it('renders the full-page settings layout and closes back to home', async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          PersonalSettingsPanel: {
            template: '<div>PersonalSettingsPanel</div>',
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
})
