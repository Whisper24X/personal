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
    uploadAndUnpackInputZip: vi.fn(),
    uploadSourceDoc: vi.fn(),
    unpackInputZip: vi.fn(),
  },
  projectsApi: {
    list: vi.fn(),
    detail: vi.fn(),
    createDoc: vi.fn(),
    updateDoc: vi.fn(),
    uploadDoc: vi.fn(),
  },
  businessLinesApi: {
    detail: vi.fn(),
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
        name: '葱搭',
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
    businessLinesApi.detail.mockImplementation(async (businessLineId: string) => ({
      id: businessLineId,
      name: businessLineId === 'line-2' ? 'Shadow' : 'Retail',
      description: null,
      defaultAgentCliToolId: null,
    }))
    gitApi.branches.mockResolvedValue({
      defaultBranch: 'main',
      currentBranch: 'feature/current',
      localBranches: ['main', 'feature/current'],
      remoteBranches: ['main'],
    })
    goalsApi.uploadSourceDoc.mockResolvedValue({
      id: 'source-1',
      goalId: 'goal-1',
      projectDocPath: 'goals/goal-1/input/req.md',
      docType: 'requirement',
      sortOrder: 0,
      createdAt: '2026-04-08T00:00:00.000Z',
    })
    goalsApi.unpackInputZip.mockResolvedValue({
      extractedFileCount: 1,
      paths: ['goals/goal-1/input/unpacked/req.md'],
    })
    goalsApi.uploadAndUnpackInputZip.mockResolvedValue({
      extractedFileCount: 1,
      paths: ['goals/goal-1/input/unpacked/req.md'],
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

  it('prefers the business line default agent cli tool over the first configured tool', async () => {
    businessLinesApi.listAgentToolConfigs.mockResolvedValueOnce([
      {
        id: 'cfg-cursor',
        businessLineId: 'line-1',
        toolId: 'cursor-agent',
        name: 'Cursor Default',
        description: '',
        configJson: {},
        isDefault: true,
      },
      {
        id: 'cfg-codex',
        businessLineId: 'line-1',
        toolId: 'codex',
        name: 'Codex Default',
        description: '',
        configJson: {},
        isDefault: true,
      },
    ])
    businessLinesApi.detail.mockResolvedValueOnce({
      id: 'line-1',
      name: 'Retail',
      description: null,
      defaultAgentCliToolId: 'codex',
    })

    const wrapper = mount(GoalCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()
    await flushPromises()

    expect(wrapper.find('button[aria-label="Agent CLI"]').text()).toContain('Codex')
  })

  it('uploads selected source docs through the goal scoped upload api', async () => {
    goalsApi.create.mockResolvedValue({
      id: 'goal-1',
      projectId: 'project-1',
      title: '优化登录页',
      summary: null,
      status: 'draft',
      prdDocPath: null,
      planDocPath: null,
      agentCliId: 'codex',
      agentCliConfigId: 'cfg-1',
      gitBaseBranch: 'main',
      gitBranch: 'feature/goal-1',
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T00:00:00.000Z',
      deletedAt: null,
    })
    const wrapper = mount(GoalCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()
    await wrapper.find('input[type="text"]').setValue('优化登录页')
    const file = new File(['# Req'], 'req.md', { type: 'text/markdown' })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(goalsApi.uploadSourceDoc).toHaveBeenCalledWith('goal-1', expect.any(FormData))
    const formData = goalsApi.uploadSourceDoc.mock.calls[0]?.[1] as FormData
    expect(formData.get('projectDocPath')).toMatch(/^goals\/goal-1\/input\/.+-req\.md$/)
    expect(formData.get('docType')).toBe('requirement')
    expect(formData.get('sortOrder')).toBe('0')
    expect(formData.get('file')).toBe(file)
    expect(goalsApi.addSourceDoc).not.toHaveBeenCalled()
    expect(projectsApi.createDoc).not.toHaveBeenCalled()
    expect(projectsApi.updateDoc).not.toHaveBeenCalled()
    expect(projectsApi.uploadDoc).not.toHaveBeenCalled()
    expect(success).toHaveBeenCalledWith('已创建需求，已关联资料')
    expect(push).toHaveBeenCalledWith({ name: 'goal-detail', params: { goalId: 'goal-1' } })
  })

  it('uploads zip source docs through upload and unpack api without registering the zip', async () => {
    goalsApi.create.mockResolvedValue({
      id: 'goal-1',
      projectId: 'project-1',
      title: '优化登录页',
      summary: null,
      status: 'draft',
      prdDocPath: null,
      planDocPath: null,
      agentCliId: 'codex',
      agentCliConfigId: 'cfg-1',
      gitBaseBranch: 'main',
      gitBranch: 'feature/goal-1',
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T00:00:00.000Z',
      deletedAt: null,
    })
    const wrapper = mount(GoalCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()
    await wrapper.find('input[type="text"]').setValue('优化登录页')
    const file = new File(['zip'], 'prototype.zip', { type: 'application/zip' })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(goalsApi.uploadAndUnpackInputZip).toHaveBeenCalledWith(
      'goal-1',
      expect.any(FormData),
    )
    const formData = goalsApi.uploadAndUnpackInputZip.mock.calls[0]?.[1] as FormData
    expect(formData.get('projectDocPath')).toMatch(/^goals\/goal-1\/input\/.+-prototype\.zip$/)
    expect(formData.get('file')).toBe(file)
    expect(goalsApi.uploadSourceDoc).not.toHaveBeenCalled()
    expect(goalsApi.unpackInputZip).not.toHaveBeenCalled()
    expect(goalsApi.addSourceDoc).not.toHaveBeenCalled()
  })
})
