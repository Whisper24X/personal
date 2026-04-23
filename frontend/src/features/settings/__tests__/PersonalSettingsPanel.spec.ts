import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PersonalSettingsPanel from '@features/settings/PersonalSettingsPanel.vue'
import { authApi } from '@/api/auth'
import { notificationsApi } from '@/api/notifications'
import { useMessageStore } from '@app/stores/modules/message'

const {
  logoutMock,
  pushMock,
  notificationConstructor,
  requestPermissionMock,
  NotificationMock,
} = vi.hoisted(() => {
  const notificationConstructor = vi.fn()
  const requestPermissionMock = vi.fn()

  class NotificationMock {
    static permission: NotificationPermission = 'default'
    static requestPermission = requestPermissionMock
    onclick: (() => void) | null = null
    close = vi.fn()

    constructor(title: string, options?: NotificationOptions) {
      notificationConstructor(title, options)
    }
  }

  return {
    logoutMock: vi.fn(),
    pushMock: vi.fn(),
    notificationConstructor,
    requestPermissionMock,
    NotificationMock,
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('@app/composables/useAuth', () => ({
  useAuth: () => ({
    logout: logoutMock,
  }),
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    me: vi.fn(),
    updateMe: vi.fn(),
  },
}))

vi.mock('@/api/notifications', () => ({
  notificationsApi: {
    setting: vi.fn(),
    updateSetting: vi.fn(),
  },
}))

const profileResponse = {
  id: 'user-1',
  username: 'tester',
  nickname: 'Tester',
  avatar: '',
}

const baseNotificationSetting = {
  id: 'setting-1',
  userId: 'user-1',
  webhookEnabled: false,
  webhookUrl: null,
  webhookSecret: null,
  browserEnabled: false,
}

const mountPanel = () => {
  const pinia = createPinia()
  setActivePinia(pinia)

  return mount(PersonalSettingsPanel, {
    props: {
      externalTab: 'notifications',
    },
    global: {
      plugins: [pinia],
      stubs: {
        teleport: true,
      },
    },
  })
}

describe('PersonalSettingsPanel browser notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(authApi.me).mockResolvedValue(profileResponse)
    vi.mocked(notificationsApi.setting).mockResolvedValue(baseNotificationSetting)
    vi.mocked(notificationsApi.updateSetting).mockImplementation(async (payload) => ({
      ...baseNotificationSetting,
      ...payload,
    }))

    NotificationMock.permission = 'default'
    requestPermissionMock.mockResolvedValue('granted')

    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: NotificationMock,
    })
  })

  it('requests permission before enabling browser notifications', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.get('input[aria-label="切换浏览器通知"]').setValue(true)
    await flushPromises()

    expect(requestPermissionMock).toHaveBeenCalledTimes(1)
    expect(notificationsApi.updateSetting).toHaveBeenCalledWith({
      webhookEnabled: false,
      webhookUrl: null,
      webhookSecret: null,
      browserEnabled: true,
    })
  })

  it('sends a local test notification when permission is already granted', async () => {
    NotificationMock.permission = 'granted'

    const wrapper = mountPanel()
    await flushPromises()

    const testButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '发送测试通知')

    expect(testButton).toBeDefined()
    await testButton!.trigger('click')
    await flushPromises()

    expect(notificationConstructor).toHaveBeenCalledWith(
      '葱搭 测试通知',
      expect.objectContaining({
        body: '如果你看到了这条消息，说明当前浏览器通知链路已就绪。',
        icon: '/logo.png',
      }),
    )
  })

  it('checks browser permission directly without opening an extra dialog', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const checkButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '检查授权')

    expect(checkButton).toBeDefined()
    await checkButton!.trigger('click')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(requestPermissionMock).toHaveBeenCalledTimes(1)
    expect(messageStore.items[0]?.text).toBe('浏览器通知已授权')
    expect(wrapper.text()).not.toContain('浏览器通知设置')
  })

  it('does not open an extra dialog when browser permission is denied', async () => {
    NotificationMock.permission = 'denied'

    const wrapper = mountPanel()
    await flushPromises()

    const testButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '发送测试通知')

    expect(testButton).toBeDefined()
    await testButton!.trigger('click')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(requestPermissionMock).not.toHaveBeenCalled()
    expect(messageStore.items[0]?.text).toBe('浏览器通知权限已被拒绝，请在浏览器站点设置中手动开启。')
    expect(wrapper.text()).not.toContain('浏览器通知设置')
  })
})
