import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import UsersView from '@/views/users/index.vue'
import { useMessageStore } from '@/stores/modules/message'

const { usersApi } = vi.hoisted(() => ({
  usersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('@/api/users', () => ({
  usersApi,
}))

beforeEach(() => {
  vi.clearAllMocks()

  usersApi.list.mockResolvedValue({
    data: [],
    hasNextPage: false,
  })

  usersApi.create.mockResolvedValue({
    id: 'user-1',
    username: 'alice',
    status: 1,
    isAdmin: false,
  })
})

describe('UsersView toasts', () => {
  it('keeps local validation inline and does not push toast', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(UsersView, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')

    const messageStore = useMessageStore()
    expect(wrapper.text()).toContain('用户名不能为空')
    expect(messageStore.items).toHaveLength(0)
  })

  it('shows error toast when saving user fails', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    usersApi.create.mockRejectedValueOnce(new Error('保存失败'))

    const wrapper = mount(UsersView, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    await wrapper.find('input[placeholder="例如：john.doe"]').setValue('alice')
    await wrapper.find('input[placeholder="至少 6 位"]').setValue('123456')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('error')
    expect(messageStore.items[0]?.text).toBe('保存失败')
  })

  it('shows success toast when creating user succeeds', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(UsersView, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    await wrapper.find('input[placeholder="例如：john.doe"]').setValue('alice')
    await wrapper.find('input[placeholder="至少 6 位"]').setValue('123456')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items.some((item) => item.type === 'success' && item.text === '创建用户成功')).toBe(true)
  })
})
