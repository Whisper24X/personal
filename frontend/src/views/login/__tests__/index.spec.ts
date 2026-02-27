import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/login/index.vue'
import { useMessageStore } from '@/stores/modules/message'

const { loginMock, pushMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
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
      loading: ref(false),
    }),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  loginMock.mockRejectedValue(new Error('登录失败-测试'))
})

describe('LoginView toasts', () => {
  it('shows error toast when login fails', async () => {
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
})
