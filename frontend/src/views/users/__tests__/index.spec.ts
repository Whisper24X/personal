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
    isAdmin: false,
  })
})

describe('UsersView toasts', () => {
  const mountUsersView = () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    return mount(UsersView, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })
  }

  const openCreateUserModal = async (wrapper: ReturnType<typeof mount>) => {
    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('新增用户'))

    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()
  }

  it('keeps local validation inline and does not push toast', async () => {
    const wrapper = mountUsersView()

    await flushPromises()
    await openCreateUserModal(wrapper)
    await wrapper.get('section[role="dialog"] form').trigger('submit.prevent')

    const messageStore = useMessageStore()
    expect(wrapper.text()).toContain('用户名不能为空')
    expect(messageStore.items).toHaveLength(0)
  })

  it('shows error toast when saving user fails', async () => {
    usersApi.create.mockRejectedValueOnce(new Error('保存失败'))

    const wrapper = mountUsersView()

    await flushPromises()
    await openCreateUserModal(wrapper)

    await wrapper.get('input[placeholder="例如：john.doe"]').setValue('alice')
    await wrapper.get('input[placeholder="至少 6 位"]').setValue('123456')
    await wrapper.get('section[role="dialog"] form').trigger('submit.prevent')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('error')
    expect(messageStore.items[0]?.text).toBe('保存失败')
  })

  it('shows success toast when creating user succeeds', async () => {
    const wrapper = mountUsersView()

    await flushPromises()
    await openCreateUserModal(wrapper)

    await wrapper.get('input[placeholder="例如：john.doe"]').setValue('alice')
    await wrapper.get('input[placeholder="至少 6 位"]').setValue('123456')
    await wrapper.get('section[role="dialog"] form').trigger('submit.prevent')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items.some((item) => item.type === 'success' && item.text === '创建用户成功')).toBe(true)
  })
})
