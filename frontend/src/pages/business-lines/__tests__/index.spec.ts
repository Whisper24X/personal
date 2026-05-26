import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setSessionToken } from '@app/stores/auth-session'
import BusinessLinesView from '@pages/business-lines/index.vue'

const { businessLinesApi, usersApi } = vi.hoisted(() => ({
  businessLinesApi: {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
  },
  usersApi: {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi,
}))

vi.mock('@/api/users', () => ({
  usersApi,
}))

const { authApi } = vi.hoisted(() => ({
  authApi: {
    access: vi.fn(),
  },
}))

vi.mock('@/api/auth', () => ({
  authApi,
}))

vi.mock('@shared/utils/pagination', () => ({
  fetchAllPages: vi.fn(async (fetchPage: (page: number, limit: number) => Promise<{ data: unknown[] }>) => {
    const response = await fetchPage(1, 50)
    return response.data
  }),
}))

const lines = [
  { id: 'line-1', name: 'Retail', description: 'Retail team', updatedAt: '2026-02-26T12:00:00.000Z' },
  { id: 'line-2', name: 'Growth', description: 'Growth team', updatedAt: '2026-02-26T12:05:00.000Z' },
]

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  setSessionToken('test-token')

  authApi.access.mockResolvedValue({
    user: {
      id: 'user-1',
      username: 'admin',
      nickname: 'Admin',
      avatar: null,
    },
    currentContext: {
      businessLineId: null,
      projectId: null,
      businessRole: null,
      projectRole: null,
    },
    capabilities: ['businessLine.create'],
    visibility: {
      visibleBusinessLineIds: [],
      visibleProjectIds: [],
    },
    isAdmin: true,
  })

  businessLinesApi.list.mockResolvedValue({
    data: lines,
    hasNextPage: false,
  })

  usersApi.list.mockResolvedValue({
    data: [
      {
        id: 'user-1',
        username: 'alice',
        nickname: 'Alice',
      },
    ],
    hasNextPage: false,
  })

  businessLinesApi.listMembers.mockResolvedValue([
    {
      id: 'member-1',
      businessLineId: 'line-1',
      userId: 'user-1',
      role: 'owner',
      updatedAt: '2026-02-26T12:10:00.000Z',
    },
  ])
})

describe('BusinessLinesView', () => {
  it('shows lines tab by default and opens create modal', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLinesView, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('业务线列表')
    expect(wrapper.text()).toContain('创建业务线')

    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '创建业务线')

    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    expect(wrapper.find('#business-line-form-modal-title').text()).toBe('创建业务线')
  })

  it('hides create and delete actions for non-admin users', async () => {
    authApi.access.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        username: 'member',
        nickname: 'Member',
        avatar: null,
      },
      currentContext: {
        businessLineId: null,
        projectId: null,
        businessRole: null,
        projectRole: null,
      },
      capabilities: [],
      visibility: {
        visibleBusinessLineIds: [],
        visibleProjectIds: [],
      },
      isAdmin: false,
    })

    const pinia = createPinia()
    const wrapper = mount(BusinessLinesView, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const actionLabels = wrapper.findAll('button').map((button) => button.text())
    expect(actionLabels).not.toContain('创建业务线')
    expect(actionLabels).not.toContain('删除')
  })

  it('switches to members tab and renders members area', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLinesView, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const membersTabButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '业务线成员')

    expect(membersTabButton).toBeDefined()
    await membersTabButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('当前：Retail')
    expect(wrapper.text()).toContain('添加成员')
    expect(businessLinesApi.listMembers).toHaveBeenCalledWith('line-1')
  })

  it('jumps from list row member action to members tab with selected line', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLinesView, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const memberButtons = wrapper
      .findAll('button')
      .filter((button) => button.text() === '成员')

    expect(memberButtons.length).toBeGreaterThan(1)
    await memberButtons[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('当前：Growth')
    expect(businessLinesApi.listMembers).toHaveBeenCalledWith('line-2')
  })

  it('hides create business line button when user has no permission', async () => {
    authApi.access.mockResolvedValueOnce({
      user: {
        id: 'user-2',
        username: 'tester',
        nickname: 'Tester',
        avatar: null,
      },
      currentContext: {
        businessLineId: null,
        projectId: null,
        businessRole: null,
        projectRole: null,
      },
      capabilities: [],
      visibility: {
        visibleBusinessLineIds: [],
        visibleProjectIds: [],
      },
      isAdmin: false,
    })

    const pinia = createPinia()
    const wrapper = mount(BusinessLinesView, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const createButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '创建业务线')

    expect(createButton).toBeUndefined()
  })

  it('opens edit modal with prefilled values', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLinesView, {
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const editButtons = wrapper
      .findAll('button')
      .filter((button) => button.text() === '编辑')

    expect(editButtons.length).toBeGreaterThan(0)
    await editButtons[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.find('#business-line-form-modal-title').text()).toBe('编辑业务线')
    expect((wrapper.find('input[placeholder="例如：Retail"]').element as HTMLInputElement).value).toBe('Retail')
    expect((wrapper.find('input[placeholder="例如：零售业务线"]').element as HTMLInputElement).value).toBe('Retail team')
  })
})
