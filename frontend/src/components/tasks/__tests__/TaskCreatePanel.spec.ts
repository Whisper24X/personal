import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskCreatePanel from '@/components/tasks/TaskCreatePanel.vue'

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
  },
  workflowApi: {
    list: vi.fn(),
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

vi.mock('@/hooks', () => ({
  useMessage: () => ({
    success,
    error,
  }),
}))

vi.mock('@/stores/modules/access', () => ({
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

vi.mock('@/utils/pagination', () => ({
  fetchAllPages,
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

    projectsApi.list.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          businessLineId: 'line-1',
          name: 'AINative',
          gitUrl: 'git@example.com:group/ainative.git',
          defaultBranch: 'main',
        },
      ],
      hasNextPage: false,
    })
    workflowApi.list.mockResolvedValue({
      data: [],
      hasNextPage: false,
    })
    businessLinesApi.listAgentToolConfigs.mockResolvedValue([
      {
        id: 'cfg-1',
        businessLineId: 'line-1',
        toolId: 'codex',
        name: 'Codex Default',
        configJson: {},
        isDefault: true,
      },
    ])
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

  it('should create conversation task with configJson cli config fields', async () => {
    const wrapper = mount(TaskCreatePanel, {
      props: {
        projectId: 'project-1',
      },
    })

    await flushPromises()

    await wrapper.find('input[placeholder="标题"]').setValue('实现任务字段补齐')
    await wrapper.find('textarea[placeholder="提示词"]').setValue('请补齐创建任务字段')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(tasksApi.create).toHaveBeenCalledTimes(1)
    const payload = tasksApi.create.mock.calls[0]![0] as Record<string, unknown>

    expect(payload.projectId).toBe('project-1')
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
      .find((button) => button.text() === '工作流模式')

    expect(workflowModeButton).toBeTruthy()
    await workflowModeButton!.trigger('click')
    await flushPromises()

    await wrapper.find('input[placeholder="标题"]').setValue('分析项目')
    await wrapper.find('textarea[placeholder="提示词"]').setValue('请先分析项目结构')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(tasksApi.create).toHaveBeenCalledTimes(1)
    const payload = tasksApi.create.mock.calls[0]![0] as Record<string, unknown>

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

    await wrapper.find('input[placeholder="标题"]').setValue('修复任务分支选择')
    await wrapper.find('textarea[placeholder="提示词"]').setValue('请在指定分支上执行任务')
    await selectOption(wrapper, '分支', 'release/2026.03')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(tasksApi.create).toHaveBeenCalledTimes(1)
    const payload = tasksApi.create.mock.calls[0]![0] as Record<string, unknown>

    expect(payload.gitBaseBranch).toBe('release/2026.03')
    expect('gitBranch' in payload).toBe(false)
  })
})
