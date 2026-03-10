import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import TaskDetailView from '@/views/tasks/detail.vue'
import { useMessageStore } from '@/stores/modules/message'

const { tasksApi, artifactsApi, authApi, openSseStream } = vi.hoisted(() => ({
  tasksApi: {
    detailWithNodes: vi.fn(),
    logs: vi.fn(),
    messages: vi.fn(),
    artifacts: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    execute: vi.fn(),
    reply: vi.fn(),
    cancel: vi.fn(),
    cleanupWorktree: vi.fn(),
    retry: vi.fn(),
    approve: vi.fn(),
    createArtifact: vi.fn(),
  },
  artifactsApi: {
    download: vi.fn(),
    preview: vi.fn(),
  },
  authApi: {
    access: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
  openSseStream: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    template: '<a><slot /></a>',
  },
  useRoute: () => ({
    params: {
      id: 'task-1',
    },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

vi.mock('@/api/artifacts', () => ({
  artifactsApi,
}))

vi.mock('@/api/auth', () => ({
  authApi,
}))

vi.mock('@/api/http', () => ({
  openSseStream,
}))

beforeEach(() => {
  vi.clearAllMocks()

  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key: string) {
        return storage.get(key) ?? null
      },
      setItem(key: string, value: string) {
        storage.set(key, String(value))
      },
      removeItem(key: string) {
        storage.delete(key)
      },
      clear() {
        storage.clear()
      },
    },
  })
  localStorage.setItem('ainative-auth-token', 'token')

  tasksApi.detailWithNodes.mockResolvedValue({
    task: {
      id: 'task-1',
      projectId: 'project-1',
      mode: 'conversation',
      title: 'Demo task',
      status: 'todo',
      configJson: {
        agentCliId: 'codex',
      },
      createdAt: '2026-02-27T10:00:00.000Z',
      updatedAt: '2026-02-27T10:00:00.000Z',
    },
    nodes: [],
  })

  tasksApi.logs.mockResolvedValue([])
  tasksApi.messages.mockResolvedValue([])
  tasksApi.artifacts.mockResolvedValue([])
  tasksApi.execute.mockRejectedValue(new Error('执行异常'))
  authApi.access.mockResolvedValue({
    capabilities: ['project.task.read', 'project.task.execute', 'project.task.create', 'project.task.cancel'],
    currentContext: {
      businessLineId: 'business-line-1',
      businessRole: 'owner',
      projectId: 'project-1',
      projectRole: 'owner',
    },
  })
  openSseStream.mockResolvedValue(undefined)
})

describe('TaskDetailView toasts', () => {
  it('shows error toast when execute API fails', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    const executeButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '执行')

    expect(executeButton).toBeDefined()
    await executeButton!.trigger('click')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('error')
    expect(messageStore.items[0]?.text).toBe('执行异常')
    expect(wrapper.text()).not.toContain('执行异常')
  })

  it('renders agent cli chunk text from SSE payload', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    openSseStream.mockImplementation(async (_url, _query, options) => {
      options?.onEvent?.({
        data: JSON.stringify({
          id: 'log-1',
          taskId: 'task-1',
          taskNodeId: null,
          level: 'info',
          message: 'Agent CLI stdout chunk',
          payload: {
            stream: 'stdout',
            text: 'real agent output',
          },
          createdAt: '2026-02-27T10:00:01.000Z',
        }),
      })
    })

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('real agent output')
    expect(wrapper.text()).not.toContain('Agent CLI stdout chunk')
  })

  it('uses cli name as execution panel title', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Codex')
    expect(wrapper.text()).not.toContain('Execution')
  })

  it('keeps reply box but hides header actions', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.text()).toContain('回复')
    expect(wrapper.text()).not.toContain('Reply')
    expect(wrapper.text()).not.toContain('停止执行')
  })

  it('renders a streamlined task card with high-value fields only', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Demo task')
    expect(wrapper.text()).toContain('待执行')
    expect(wrapper.text()).toContain('模式 对话')
    expect(wrapper.text()).not.toContain('分支')
    expect(wrapper.text()).not.toContain('项目 project-1')
    expect(wrapper.text()).not.toContain('CLI 工具')
    expect(wrapper.text()).not.toContain('CLI 配置')
    expect(wrapper.text()).not.toContain('创建：')
    expect(wrapper.text()).not.toContain('更新：')
    expect(wrapper.text()).not.toContain('停止')
    expect(wrapper.text()).not.toContain('清理工作区')
    expect(wrapper.text()).not.toContain('编辑')
    expect(wrapper.text()).not.toContain('任务列表')
    expect(wrapper.text()).not.toContain('项目详情')
  })
})
