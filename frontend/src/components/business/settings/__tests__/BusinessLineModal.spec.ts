import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import BusinessLineModal from '@/components/business/settings/BusinessLineModal.vue'

const {
  businessLinesApi,
  projectsApi,
  usersApi,
  fetchAllPages,
} = vi.hoisted(() => ({
  businessLinesApi: {
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    createInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
  },
  projectsApi: {
    list: vi.fn(),
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
  },
  fetchAllPages: vi.fn(),
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi,
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

vi.mock('@/api/users', () => ({
  usersApi,
}))

vi.mock('@/utils/pagination', () => ({
  fetchAllPages,
}))

const buildProps = (canCreateBusinessLine = true, open = true) => ({
  open,
  canCreateBusinessLine,
  activeBusinessLineId: 'line-1',
  lines: [
    {
      id: 'line-1',
      name: 'Retail',
      description: 'Retail team',
      owner: '-',
      projectCount: 1,
    },
  ],
  projects: [],
})

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())

  businessLinesApi.detail.mockResolvedValue({
    id: 'line-1',
    name: 'Retail',
    description: 'Retail team',
  })

  businessLinesApi.listMembers.mockResolvedValue([])

  projectsApi.list.mockResolvedValue({
    data: [
      {
        id: 'project-1',
        businessLineId: 'line-1',
        name: 'Guard Backend',
        description: 'Main service',
        gitUrl: 'git@gitlab.example.com:group/guard-backend.git',
        defaultBranch: 'main',
      },
    ],
    hasNextPage: false,
  })

  projectsApi.create.mockResolvedValue({
    id: 'project-2',
    businessLineId: 'line-1',
    name: 'Guard Console',
    description: 'Console',
    gitUrl: 'git@gitlab.example.com:group/guard-console.git',
    defaultBranch: 'main',
  })

  usersApi.list.mockResolvedValue({
    data: [],
    hasNextPage: false,
  })

  fetchAllPages.mockImplementation(
    async (fetchPage: (page: number, limit: number) => Promise<{ data: unknown[] }>) => {
      const response = await fetchPage(1, 50)
      return response.data
    },
  )
})

describe('BusinessLineModal', () => {
  it('renders left-right layout with 3 tabs by default', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineModal, {
      props: buildProps(true),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('业务线')
    expect(wrapper.text()).toContain('项目')
    expect(wrapper.text()).toContain('成员/权限')
    expect(wrapper.text()).toContain('设置')
    expect(wrapper.text()).toContain('创建业务线')
  })

  it('disables create business line button when user has no permission', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineModal, {
      props: buildProps(false),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await flushPromises()

    const createLineButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '创建业务线')

    expect(createLineButton).toBeDefined()
    expect((createLineButton!.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('仅管理员可创建业务线')
  })

  it('opens create project modal and submits project payload', async () => {
    const pinia = createPinia()
    const wrapper = mount(BusinessLineModal, {
      props: buildProps(true, false),
      global: {
        plugins: [pinia],
        stubs: {
          teleport: true,
        },
      },
    })

    await wrapper.setProps({ open: true })
    await flushPromises()

    const newProjectButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '新建项目')

    expect(newProjectButton).toBeDefined()
    await newProjectButton!.trigger('click')
    await flushPromises()

    const projectFormModal = wrapper.findComponent({ name: 'ProjectFormModal' })
    projectFormModal.vm.$emit('submit', {
      name: 'Guard Console',
      description: 'Console app',
      gitUrl: 'git@gitlab.example.com:group/guard-console.git',
      defaultBranch: 'main',
    })
    await flushPromises()

    expect(projectsApi.create).toHaveBeenCalledWith({
      businessLineId: 'line-1',
      name: 'Guard Console',
      description: 'Console app',
      gitUrl: 'git@gitlab.example.com:group/guard-console.git',
      defaultBranch: 'main',
    })
    expect(wrapper.emitted('request-refresh')).toBeTruthy()
  })
})
