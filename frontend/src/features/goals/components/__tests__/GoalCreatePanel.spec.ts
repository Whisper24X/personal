import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoalCreatePanel from '@features/goals/components/GoalCreatePanel.vue'

const routeState = {
  query: {},
  params: {},
}

const {
  push,
  success,
  warning,
  error,
  gitApi,
  goalsApi,
  projectsApi,
  businessLinesApi,
  fetchAllPages,
} = vi.hoisted(() => ({
  push: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  gitApi: {
    branches: vi.fn(),
  },
  goalsApi: {
    create: vi.fn(),
    addSourceDoc: vi.fn(),
    unpackInputZip: vi.fn(),
  },
  projectsApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
  businessLinesApi: {
    listAgentToolConfigs: vi.fn(),
  },
  fetchAllPages: vi.fn(),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')

  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({
      push,
    }),
  }
})

vi.mock('@app/composables/useMessage', () => ({
  useMessage: () => ({
    success,
    warning,
    error,
  }),
}))

vi.mock('@app/stores/modules/access', () => ({
  useAccessStore: () => ({
    hasCapability: () => true,
    loadContext: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  }),
}))

vi.mock('@/api/git', () => ({
  gitApi,
}))

vi.mock('@/api/goals', () => ({
  goalsApi,
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi,
}))

vi.mock('@shared/utils/pagination', () => ({
  fetchAllPages,
}))

describe('GoalCreatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeState.query = {}
    routeState.params = {}

    const sampleProjects: Record<
      string,
      {
        id: string
        businessLineId: string
        name: string
        gitUrl: string
        defaultBranch: string
      }
    > = {
      'project-1': {
        id: 'project-1',
        businessLineId: 'line-1',
        name: 'AINative',
        gitUrl: 'git@example.com:group/ainative.git',
        defaultBranch: 'main',
      },
      'project-2': {
        id: 'project-2',
        businessLineId: 'line-2',
        name: 'Shadow',
        gitUrl: 'git@example.com:group/shadow.git',
        defaultBranch: 'develop',
      },
    }

    projectsApi.detail.mockImplementation(async (projectId: string) => sampleProjects[projectId])
    projectsApi.list.mockResolvedValue({
      data: Object.values(sampleProjects),
      hasNextPage: false,
    })
    businessLinesApi.listAgentToolConfigs.mockImplementation(async (businessLineId: string) => [
      {
        id: businessLineId === 'line-2' ? 'cfg-2' : 'cfg-1',
        businessLineId,
        toolId: 'codex',
        name: businessLineId === 'line-2' ? 'Codex Shadow' : 'Codex Default',
        configJson: {},
        isDefault: true,
      },
    ])
    gitApi.branches.mockResolvedValue({
      defaultBranch: 'main',
      currentBranch: 'feature/current',
      localBranches: ['main', 'feature/current'],
      remoteBranches: ['main'],
    })
    fetchAllPages.mockImplementation(
      async (fetchPage: (page: number, limit: number) => Promise<{ data: unknown[] }>) => {
        const response = await fetchPage(1, 50)
        return response.data
      },
    )
  })

  it('should reload agent configs after switching to a project not cached in the panel', async () => {
    const wrapper = mount(GoalCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()
    projectsApi.detail.mockClear()
    businessLinesApi.listAgentToolConfigs.mockClear()
    gitApi.branches.mockClear()

    await wrapper.setProps({
      projectId: 'project-2',
    })
    await flushPromises()
    await flushPromises()

    expect(projectsApi.detail).toHaveBeenCalledWith('project-2')
    expect(businessLinesApi.listAgentToolConfigs).toHaveBeenCalledWith('line-2')
    expect(gitApi.branches).toHaveBeenCalledWith('project-2')
  })
})
