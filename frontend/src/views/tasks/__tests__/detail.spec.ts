import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import TaskDetailView from '@/views/tasks/detail.vue'
import { useMessageStore } from '@/stores/modules/message'
import { STORAGE_KEYS } from '@/types/common/storage'
import type { TaskDetail } from '@/types/api/tasks'

const { tasksApi, authApi, openSseStream } = vi.hoisted(() => ({
  tasksApi: {
    detailWithNodes: vi.fn(),
    logs: vi.fn(),
    messages: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    execute: vi.fn(),
    reply: vi.fn(),
    cancel: vi.fn(),
    cleanupWorktree: vi.fn(),
    retry: vi.fn(),
    approve: vi.fn(),
    stepSummaries: vi.fn().mockResolvedValue({ items: [] }),
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
      get length() {
        return storage.size
      },
      key(i: number) {
        return [...storage.keys()][i] ?? null
      },
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
  tasksApi.execute.mockRejectedValue(new Error('执行异常'))
  authApi.access.mockResolvedValue({
    capabilities: ['project.task.read'],
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
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes detail when SSE reports pending approval', async () => {
    vi.useFakeTimers()

    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes
      .mockResolvedValueOnce({
        task: {
          id: 'task-1',
          projectId: 'project-1',
          mode: 'workflow',
          title: 'Workflow task',
          status: 'in_progress',
          configJson: {
            agentCliId: 'codex',
          },
          createdAt: '2026-02-27T10:00:00.000Z',
          updatedAt: '2026-02-27T10:00:00.000Z',
        },
        nodes: [
          {
            id: 'node-1',
            taskId: 'task-1',
            nodeOrder: 1,
            name: 'Review node',
            status: 'in_progress',
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
          },
        ],
      })
      .mockResolvedValueOnce({
        task: {
          id: 'task-1',
          projectId: 'project-1',
          mode: 'workflow',
          title: 'Workflow task',
          status: 'in_review',
          configJson: {
            agentCliId: 'codex',
          },
          createdAt: '2026-02-27T10:00:00.000Z',
          updatedAt: '2026-02-27T10:00:01.000Z',
        },
        nodes: [
          {
            id: 'node-1',
            taskId: 'task-1',
            nodeOrder: 1,
            name: 'Review node',
            status: 'in_review',
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
          },
        ],
      })

    openSseStream.mockImplementation(async (_url, _query, options) => {
      options?.onEvent?.({
        data: JSON.stringify({
          id: 'log-1',
          taskId: 'task-1',
          taskNodeId: 'node-1',
          level: 'info',
          message: 'Agent node completed; pending approval',
          payload: {
            pendingApproval: true,
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
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(tasksApi.detailWithNodes).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('节点待审批')
    expect(wrapper.findComponent({ name: 'TaskDetailReviewCard' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'TaskDetailWorkflowCard' }).text()).not.toContain('节点待审批')

    vi.useRealTimers()
  })

  it('refreshes the right panel when SSE reports a node status change', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    openSseStream.mockImplementation(async (_url, _query, options) => {
      options?.onEvent?.({
        data: JSON.stringify({
          id: 'log-1',
          taskId: 'task-1',
          taskNodeId: 'node-1',
          level: 'info',
          message: 'Node execution started',
          payload: {},
          createdAt: '2026-02-27T10:00:01.000Z',
        }),
      })
    })

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            props: ['refreshToken'],
            template: '<div data-testid="right-panel" :data-refresh-token="String(refreshToken)" />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-testid="right-panel"]').attributes('data-refresh-token')).toBe('1')
  })

  it('keeps existing content visible while SSE-triggered detail refresh is pending', async () => {
    vi.useFakeTimers()

    const pinia = createPinia()
    setActivePinia(pinia)

    let resolveRefresh: ((value: TaskDetail) => void) | null = null

    tasksApi.detailWithNodes
      .mockResolvedValueOnce({
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
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve
          }),
      )

    openSseStream.mockImplementation(async (_url, _query, options) => {
      options?.onEvent?.({
        data: JSON.stringify({
          id: 'log-1',
          taskId: 'task-1',
          taskNodeId: null,
          level: 'info',
          message: 'Task completed; worktree preserved',
          payload: {},
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
    expect(wrapper.text()).toMatch(/待执行/)
    expect(wrapper.text()).toContain('Codex')

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(tasksApi.detailWithNodes).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toMatch(/待执行/)
    expect(wrapper.text()).toContain('Codex')
    expect(wrapper.text()).not.toContain('加载中...')

    expect(resolveRefresh).not.toBeNull()

    resolveRefresh!({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
        mode: 'conversation',
        title: 'Demo task refreshed',
        status: 'in_progress',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:01.000Z',
      },
      nodes: [],
    })

    await flushPromises()

    expect(wrapper.text()).toContain('执行中')

    vi.useRealTimers()
  })

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

  it('hides execute button after first successful execution', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.execute.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'conversation',
        title: 'Demo task',
        status: 'in_progress',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:02.000Z',
      },
      nodes: [],
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

    const executeButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '执行')

    expect(executeButton).toBeDefined()
    await executeButton!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '执行')).toBe(false)
  })

  it('does not render execute button after task has already been executed', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'conversation',
        title: 'Demo task',
        status: 'in_review',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:00.000Z',
      },
      nodes: [],
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

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '执行')).toBe(false)
  })

  it('renders agent cli chunk text from SSE payload', async () => {
    vi.useFakeTimers()

    const pinia = createPinia()
    setActivePinia(pinia)
    tasksApi.messages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          role: 'assistant',
          content: 'real agent output',
          createdAt: '2026-02-27T10:00:01.000Z',
          taskNodeId: null,
          level: 'info',
        },
      ])

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
    await vi.advanceTimersByTimeAsync(150)
    await flushPromises()

    expect(wrapper.text()).toContain('real agent output')
    expect(wrapper.text()).not.toContain('Agent CLI stdout chunk')

    vi.useRealTimers()
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
    expect(wrapper.find('textarea').attributes('placeholder')).toBe('补充指令或继续提问...')
    expect(wrapper.find('button[aria-label="请输入回复后发送"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Reply')
    expect(wrapper.text()).not.toContain('停止执行')
  })

  it('switches reply action to interrupt while cli is running', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'conversation',
        title: 'Demo task',
        status: 'in_progress',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:00.000Z',
      },
      nodes: [],
    })

    tasksApi.cancel.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'conversation',
        title: 'Demo task',
        status: 'in_review',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:01.000Z',
      },
      nodes: [],
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

    const interruptButton = wrapper.find('button[aria-label="停止当前执行"]')
    expect(interruptButton.exists()).toBe(true)
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()

    await interruptButton.trigger('click')
    await flushPromises()

    expect(tasksApi.cancel).toHaveBeenCalledWith('task-1')
    expect(wrapper.find('button[aria-label="请输入回复后发送"]').exists()).toBe(true)
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

    expect(wrapper.text()).toContain('待执行')
    expect(wrapper.text()).toContain('对话')
    expect(wrapper.text()).toMatch(/Codex/)
    expect(wrapper.text()).toContain('执行')
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

  it('does not render workflow card for conversation tasks even when nodes exist', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'conversation',
        title: 'Demo task',
        status: 'in_progress',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:00.000Z',
      },
      nodes: [
        {
          id: 'node-1',
          taskId: 'task-1',
          nodeOrder: 1,
          name: 'Conversation node',
          status: 'in_progress',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
      ],
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

    expect(wrapper.findComponent({ name: 'TaskDetailWorkflowCard' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Codex')
  })

  it('restores the stored right panel visibility preference', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    localStorage.setItem(STORAGE_KEYS.taskDetailRightPanelVisible, 'false')

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div data-testid="right-panel-section" />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="right-panel-section"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="展开右侧面板"]').exists()).toBe(true)
  })

  it('persists right panel visibility when the user toggles it', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div data-testid="right-panel-section" />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    await wrapper.find('button[aria-label="收起右侧面板"]').trigger('click')
    await flushPromises()

    expect(localStorage.getItem(STORAGE_KEYS.taskDetailRightPanelVisible)).toBe('false')
    expect(wrapper.find('[data-testid="right-panel-section"]').exists()).toBe(false)

    await wrapper.find('button[aria-label="展开右侧面板"]').trigger('click')
    await flushPromises()

    expect(localStorage.getItem(STORAGE_KEYS.taskDetailRightPanelVisible)).toBe('true')
    expect(wrapper.find('[data-testid="right-panel-section"]').exists()).toBe(true)
  })

  it('auto-selects the first in-progress workflow node by node order', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'workflow',
        title: 'Workflow task',
        status: 'in_progress',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:00.000Z',
      },
      nodes: [
        {
          id: 'node-3',
          taskId: 'task-1',
          nodeOrder: 3,
          name: 'Third node',
          status: 'todo',
          agentCliId: 'gemini-cli',
          agentCliConfigId: 'cfg-3',
        },
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          name: 'Second node',
          status: 'in_progress',
          agentCliId: 'cursor-agent',
          agentCliConfigId: 'cfg-2',
        },
        {
          id: 'node-1',
          taskId: 'task-1',
          nodeOrder: 1,
          name: 'First node',
          status: 'done',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
      ],
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

    const selectedButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Second node'))

    expect(selectedButton?.classes()).toContain('ring-2')
    expect(wrapper.text()).toContain('Cursor Agent')
  })

  it('auto-selects the first in-review workflow node when no node is running', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'workflow',
        title: 'Workflow task',
        status: 'in_review',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:00.000Z',
      },
      nodes: [
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          name: 'Second review',
          status: 'in_review',
          agentCliId: 'cursor-agent',
          agentCliConfigId: 'cfg-2',
        },
        {
          id: 'node-1',
          taskId: 'task-1',
          nodeOrder: 1,
          name: 'First review',
          status: 'in_review',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
        {
          id: 'node-3',
          taskId: 'task-1',
          nodeOrder: 3,
          name: 'Third node',
          status: 'todo',
          agentCliId: 'gemini-cli',
          agentCliConfigId: 'cfg-3',
        },
      ],
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

    const selectedButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('First review'))

    expect(selectedButton?.classes()).toContain('ring-2')
    expect(wrapper.text()).toContain('Codex')
  })

  it('shows only one 重新执行 button when workflow node is pending approval', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'workflow',
        title: 'Workflow task',
        status: 'in_review',
        configJson: {
          agentCliId: 'codex',
        },
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:00.000Z',
      },
      nodes: [
        {
          id: 'node-1',
          taskId: 'task-1',
          nodeOrder: 1,
          name: 'Review node',
          status: 'in_review',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
      ],
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

    const reExecButtons = wrapper
      .findAll('button')
      .filter((button) => button.text().trim() === '重新执行')
    expect(reExecButtons.length).toBe(1)
  })
})
