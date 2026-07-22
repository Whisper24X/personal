import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskCreatePanel from '@features/tasks/TaskCreatePanel.vue'
import { initialTitleFromPrompt } from '@shared/utils/task-title-placeholder'

const routeState = {
  query: {},
  params: {},
}

const {
  push,
  success,
  error,
  gitApi,
  tasksApi,
  projectsApi,
  workflowApi,
  businessLinesApi,
  fetchAllPages,
} = vi.hoisted(() => ({
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  gitApi: {
    branches: vi.fn(),
  },
  tasksApi: {
    create: vi.fn(),
  },
  projectsApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
  workflowApi: {
    list: vi.fn(),
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

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

vi.mock('@/api/git', () => ({
  gitApi,
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

vi.mock('@/api/workflow', () => ({
  workflowApi,
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi,
}))

vi.mock('@shared/utils/pagination', () => ({
  fetchAllPages,
}))

vi.mock('@features/layout', () => ({
  requestSidebarRecentTasksRefresh: vi.fn(),
}))

vi.mock('@shared/utils/sidebar-recent-tasks-refresh', () => ({
  refreshSidebarRecentTasks: vi.fn(),
}))

const selectOption = async (
  wrapper: ReturnType<typeof mount>,
  ariaLabel: string,
  optionLabel: string,
) => {
  await wrapper.find(`button[aria-label="${ariaLabel}"]`).trigger('click')

  const option = Array.from(document.body.querySelectorAll('button[role="option"]')).find(
    (button) => button.textContent?.includes(optionLabel),
  ) as HTMLButtonElement | undefined

  if (!option) {
    throw new Error(`Option ${optionLabel} not found`)
  }

  option.click()
  await flushPromises()
}

describe('TaskCreatePanel', () => {
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
        configJson?: Record<string, unknown> | null
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
      'project-ws': {
        id: 'project-ws',
        businessLineId: 'line-ws',
        name: 'AINative Workspace',
        gitUrl: '',
        defaultBranch: 'workspace-main',
        configJson: {
          workspaceManaged: true,
        },
      },
      'project-native': {
        id: 'project-native',
        businessLineId: 'line-native',
        name: 'Workspace Native Project',
        gitUrl: 'git@example.com:group/workspace-native.git',
        defaultBranch: 'workspace-native-main',
        configJson: {
          subtreeMode: 'workspace-native',
        },
      },
    }
    projectsApi.detail.mockImplementation(async (projectId: string) => sampleProjects[projectId])
    projectsApi.list.mockResolvedValue({
      data: Object.values(sampleProjects),
      hasNextPage: false,
    })
    workflowApi.list.mockResolvedValue({
      data: [],
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
      localBranches: ['main', 'feature/current', 'feature/existing'],
      remoteBranches: ['main', 'feature/existing', 'release/2026.03'],
    })
    tasksApi.create.mockResolvedValue({
      id: 'task-1',
    })
    fetchAllPages.mockImplementation(
      async (fetchPage: (page: number, limit: number) => Promise<{ data: unknown[] }>) => {
        const response = await fetchPage(1, 50)
        return response.data
      },
    )
  })

  it('should not render advanced params entry in create panel', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(wrapper.text()).not.toContain('高级参数')
    expect(wrapper.text()).not.toContain('收起高级参数')
    expect(wrapper.find('input[aria-label="任务分支"]').exists()).toBe(false)
  })

  it('should only load branch data once during initial mount for non-workspace projects', async () => {
    mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(gitApi.branches).toHaveBeenCalledTimes(1)
  })

  it('should hide branch selector and skip branch loading for workspace-managed projects', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-ws',
      },
    })

    await flushPromises()
    await flushPromises()

    expect(gitApi.branches).not.toHaveBeenCalled()
    expect(wrapper.find('button[aria-label="分支"]').exists()).toBe(false)
  })

  it('should hide branch selector and skip branch loading for workspace-native projects', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-native',
      },
    })

    await flushPromises()
    await flushPromises()

    expect(gitApi.branches).not.toHaveBeenCalled()
    expect(wrapper.find('button[aria-label="分支"]').exists()).toBe(false)
  })

  it('should render form while branch loading is pending', async () => {
    gitApi.branches.mockReturnValue(new Promise(() => undefined))

    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('should fallback to project list when detail request times out', async () => {
    vi.useFakeTimers()
    projectsApi.detail.mockReturnValue(new Promise(() => undefined))

    try {
      const wrapper = mount(TaskCreatePanel, {
        props: {
          projectId: 'project-1',
        },
      })

      await vi.advanceTimersByTimeAsync(5000)
      await flushPromises()

      expect(fetchAllPages).toHaveBeenCalledTimes(1)
      expect(projectsApi.list).toHaveBeenCalledTimes(1)
      expect(wrapper.find('form').exists()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('should reload agent configs after switching to a project not cached in the panel', async () => {
    const wrapper = mount(TaskCreatePanel, {
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

  it('should skip branch loading after switching from a classic project to a workspace-managed project', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()
    projectsApi.detail.mockClear()
    businessLinesApi.listAgentToolConfigs.mockClear()
    gitApi.branches.mockClear()

    await wrapper.setProps({
      projectId: 'project-ws',
    })
    await flushPromises()
    await flushPromises()

    expect(projectsApi.detail).toHaveBeenCalledWith('project-ws')
    expect(businessLinesApi.listAgentToolConfigs).toHaveBeenCalledWith('line-ws')
    expect(gitApi.branches).not.toHaveBeenCalled()
    expect(wrapper.find('button[aria-label="分支"]').exists()).toBe(false)
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

    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()
    await flushPromises()

    expect(wrapper.find('button[aria-label="Agent CLI"]').text()).toContain('Codex')
    expect(wrapper.find('button[aria-label="Agent CLI 配置"]').text()).toContain('Codex Default')
  })

  it('should create conversation task with configJson cli config fields', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    await wrapper.find('textarea').setValue('请补齐创建任务字段')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(tasksApi.create).toHaveBeenCalledTimes(1)
    const payload = tasksApi.create.mock.calls[0]![0] as Record<string, unknown>

    expect(payload.projectId).toBe('project-1')
    expect(payload.title).toBe(initialTitleFromPrompt('请补齐创建任务字段'))
    expect(payload.mode).toBe('conversation')
    expect(payload.gitBaseBranch).toBe('main')

    expect(payload.configJson).toEqual({
      agentCliId: 'codex',
      agentCliConfigId: 'cfg-1',
      attachments: [],
    })

    expect('environment' in payload).toBe(false)
    expect('gitBranch' in payload).toBe(false)
    expect('gitWorktree' in payload).toBe(false)
    expect('toolVersionsSnapshot' in payload).toBe(false)
    expect('clientInputSnapshot' in payload).toBe(false)
  })

  it('should create workspace-managed task with the default base branch', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-ws',
      },
    })

    await flushPromises()
    await flushPromises()

    await wrapper.find('textarea').setValue('请在 workspace 任务里执行')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(tasksApi.create).toHaveBeenCalledTimes(1)
    const payload = tasksApi.create.mock.calls[0]![0] as Record<string, unknown>

    expect(payload.businessLineId).toBe('line-ws')
    expect(payload.gitBaseBranch).toBe('workspace-main')
    expect('projectId' in payload).toBe(false)
  })

  it('should create workflow task with workflowTemplateId only', async () => {
    workflowApi.list.mockResolvedValue({
      data: [
        {
          id: 'wf-1',
          name: 'Analyze Project',
        },
      ],
      hasNextPage: false,
    })

    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    const workflowModeButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '工作流')

    expect(workflowModeButton).toBeTruthy()
    await workflowModeButton!.trigger('click')
    await flushPromises()

    await wrapper.find('textarea').setValue('请先分析项目结构')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(tasksApi.create).toHaveBeenCalledTimes(1)
    const payload = tasksApi.create.mock.calls[0]![0] as Record<string, unknown>

    expect(payload.title).toBe(initialTitleFromPrompt('请先分析项目结构'))
    expect(payload.mode).toBe('workflow')
    expect(payload.configJson).toEqual({
      workflowTemplateId: 'wf-1',
      attachments: [],
    })
  })

  it('should submit selected base branch only', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    await wrapper.find('textarea').setValue('请在指定分支上执行任务')
    await selectOption(wrapper, '分支', 'release/2026.03')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(tasksApi.create).toHaveBeenCalledTimes(1)
    const payload = tasksApi.create.mock.calls[0]![0] as Record<string, unknown>

    expect(payload.gitBaseBranch).toBe('release/2026.03')
    expect('gitBranch' in payload).toBe(false)
  })

  it('should still render branch selector for non-workspace projects', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(wrapper.find('button[aria-label="分支"]').exists()).toBe(true)
  })
})
