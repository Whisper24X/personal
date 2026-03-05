import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskCreatePanel from '@/components/tasks/TaskCreatePanel.vue'

const routeState = {
  query: {},
  params: {},
}

const { push, success, error, tasksApi, projectsApi, workflowApi, businessLinesApi, fetchAllPages } = vi.hoisted(() => ({
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
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

vi.mock('@/api/tasks', () => ({
  tasksApi,
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
  })

  it('should create conversation task with top-level cli config fields', async () => {
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
    expect(payload.gitBranch).toBe('main')
    expect(payload.gitBaseBranch).toBe('main')
    expect(payload.cliToolId).toBe('codex')
    expect(payload.agentToolConfigId).toBe('cfg-1')

    const clientInputSnapshot = payload.clientInputSnapshot as Record<string, unknown>
    expect(clientInputSnapshot).toEqual(
      expect.objectContaining({
        mode: 'conversation',
        cliToolId: 'codex',
        agentToolConfigId: 'cfg-1',
      }),
    )

    expect('environment' in payload).toBe(false)
    expect('gitWorktree' in payload).toBe(false)
    expect('toolVersionsSnapshot' in payload).toBe(false)
  })
})
