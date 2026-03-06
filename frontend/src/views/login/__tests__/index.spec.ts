import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/login/index.vue'
import { useMessageStore } from '@/stores/modules/message'

const { loginMock, registerMock, pushMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn(),
  pushMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
  }),
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()

  return {
    ...actual,
    useAuth: () => ({
      login: loginMock,
      register: registerMock,
      loading: ref(false),
    }),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginView toasts', () => {
  it('shows error toast when login fails', async () => {
    loginMock.mockRejectedValue(new Error('登录失败-测试'))

    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.find('input[autocomplete="username"]').setValue('alice')
    await wrapper.find('input[autocomplete="current-password"]').setValue('secret')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('error')
    expect(messageStore.items[0]?.text).toBe('登录失败-测试')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('registers then auto logs in when register mode is submitted', async () => {
    registerMock.mockResolvedValue(undefined)
    loginMock.mockResolvedValue({
      token: 'token',
      refreshToken: 'refresh',
      tokenExpires: Date.now() + 10000,
      user: {
        id: '1',
        username: 'alice',
        nickname: 'Alice',
      },
    })

    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.find('[data-testid="switch-to-register"]').trigger('click')
    await wrapper.find('input[autocomplete="username"]').setValue('alice')
    await wrapper.find('input[autocomplete="nickname"]').setValue('Alice')

    const registerPasswordInputs = wrapper.findAll('input[autocomplete="new-password"]')
    expect(registerPasswordInputs).toHaveLength(2)
    await registerPasswordInputs[0]!.setValue('secret123')
    await registerPasswordInputs[1]!.setValue('secret123')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(registerMock).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret123',
      nickname: 'Alice',
    })
    expect(loginMock).toHaveBeenCalledWith({
      username: 'alice',
      password: 'secret123',
    })
    expect(pushMock).toHaveBeenCalledWith('/dashboard')

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('success')
    expect(messageStore.items[0]?.text).toBe('注册成功，已自动登录')
  })
})
