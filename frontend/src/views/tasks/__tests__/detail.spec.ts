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
    resetNode: vi.fn(),
    approve: vi.fn(),
    complete: vi.fn(),
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
  Element.prototype.scrollIntoView = vi.fn()

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
    await vi.advanceTimersByTimeAsync(16)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(tasksApi.detailWithNodes).toHaveBeenCalledTimes(2)
    expect(tasksApi.messages).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('节点待审批')
    expect(wrapper.findComponent({ name: 'TaskDetailReviewCard' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'TaskDetailWorkflowCard' }).text()).not.toContain('节点待审批')

    vi.useRealTimers()
  })

  it('hides review card for conversation tasks even when task is in review', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'conversation',
        title: 'Conversation task',
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
          name: 'conversation-node',
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

    expect(wrapper.text()).not.toContain('节点待审批')
    expect(wrapper.findComponent({ name: 'TaskDetailReviewCard' }).exists()).toBe(false)
  })

  it('refreshes the right panel when SSE reports a node status change', async () => {
    vi.useFakeTimers()

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
    await vi.advanceTimersByTimeAsync(16)

    expect(wrapper.get('[data-testid="right-panel"]').attributes('data-refresh-token')).toBe('1')

    vi.useRealTimers()
  })

  it('refreshes the right panel when SSE reports workspace changes', async () => {
    vi.useFakeTimers()

    const pinia = createPinia()
    setActivePinia(pinia)

    openSseStream.mockImplementation(async (_url, _query, options) => {
      options?.onEvent?.({
        event: 'task-workspace-change',
        data: JSON.stringify({
          id: 'workspace-1',
          taskId: 'task-1',
          changedAt: '2026-03-27T10:00:01.000Z',
          changes: [{ path: 'src/app.ts', kind: 'change' }],
          truncated: false,
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

    expect(wrapper.get('[data-testid="right-panel"]').attributes('data-refresh-token')).toBe('0')

    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(wrapper.get('[data-testid="right-panel"]').attributes('data-refresh-token')).toBe('1')

    vi.useRealTimers()
  })

  it('fetches incremental logs over HTTP before reconnecting the realtime stream', async () => {
    vi.useFakeTimers()

    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.logs
      .mockResolvedValueOnce([
        {
          id: 'log-1',
          taskId: 'task-1',
          taskNodeId: null,
          level: 'info',
          message: 'initial log',
          createdAt: '2026-02-27T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'log-2',
          taskId: 'task-1',
          taskNodeId: null,
          level: 'info',
          message: 'missed log',
          createdAt: '2026-02-27T10:00:01.000Z',
        },
      ])
      .mockResolvedValueOnce([])

    openSseStream
      .mockImplementationOnce(async (_url, _query, options) => {
        await options?.onOpen?.()
        options?.onError?.(new Error('disconnect'))
      })
      .mockImplementationOnce(async (_url, _query, options) => {
        await options?.onOpen?.()
      })

    mount(TaskDetailView, {
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

    expect(openSseStream).toHaveBeenNthCalledWith(
      1,
      '/tasks/task-1/stream',
      undefined,
      expect.any(Object),
    )

    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()

    expect(openSseStream).toHaveBeenNthCalledWith(
      2,
      '/tasks/task-1/stream',
      undefined,
      expect.any(Object),
    )

    expect(
      tasksApi.logs.mock.calls.some(
        ([taskId, params]) =>
          taskId === 'task-1' &&
          params?.since === '2026-02-27T10:00:00.000Z' &&
          params?.afterId === 'log-1' &&
          params?.limit === 300,
      ),
    ).toBe(true)

    vi.useRealTimers()
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

    await vi.advanceTimersByTimeAsync(16)
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

    expect(wrapper.text()).toContain('处理中')

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
      .find((button) => button.text().trim() === '开始')

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
      .find((button) => button.text().trim() === '开始')

    expect(executeButton).toBeDefined()
    await executeButton!.trigger('click')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items).toHaveLength(0)
    expect(wrapper.findAll('button').some((button) => button.text().trim() === '开始')).toBe(false)
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

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '开始')).toBe(false)
  })

  it('renders execute button when task is in progress but still has runnable todo nodes', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'workflow',
        title: 'Workflow task',
        configJson: {
          agentCliId: 'codex',
        },
        status: 'in_progress',
        createdAt: '2026-02-27T10:00:00.000Z',
        updatedAt: '2026-02-27T10:00:00.000Z',
      },
      nodes: [
        {
          id: 'node-1',
          taskId: 'task-1',
          nodeOrder: 1,
          name: 'Completed node',
          status: 'done',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          name: 'Todo node',
          status: 'todo',
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

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '开始')).toBe(true)
    expect(wrapper.findAll('button').some((button) => button.text().trim() === '完成')).toBe(false)
  })

  it('hides complete button when reviewed task still has unfinished nodes', async () => {
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
      nodes: [
        {
          id: 'node-1',
          taskId: 'task-1',
          nodeOrder: 1,
          name: 'Conversation node',
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

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '完成')).toBe(false)
    expect(tasksApi.complete).not.toHaveBeenCalled()
  })

  it('completes a reviewed task via complete API', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const reviewDetail: TaskDetail = {
      task: {
        id: 'task-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
        mode: 'conversation',
        title: 'Demo task',
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
          name: 'Conversation node',
          status: 'done',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
      ],
    }

    tasksApi.detailWithNodes.mockResolvedValueOnce(reviewDetail)
    tasksApi.complete.mockResolvedValueOnce({
      ...reviewDetail,
      task: {
        ...reviewDetail.task,
        status: 'done',
        updatedAt: '2026-02-27T10:00:01.000Z',
      },
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

    const completeButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '完成')

    expect(completeButton).toBeTruthy()
    await completeButton?.trigger('click')
    await flushPromises()

    expect(tasksApi.complete).toHaveBeenCalledWith('task-1')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.findAll('button').some((button) => button.text().trim() === '完成')).toBe(false)
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

  it('disables reply box after task is completed', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'conversation',
        title: 'Demo task',
        status: 'done',
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

    expect(wrapper.find('textarea').attributes('placeholder')).toBe('任务已完成，无法继续回复...')
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
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

    const messageStore = useMessageStore()
    expect(messageStore.items).toHaveLength(0)
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
    expect(wrapper.text()).toContain('开始')
    expect(wrapper.text()).not.toContain('分支')
    expect(wrapper.text()).not.toContain('项目 project-1')
    expect(wrapper.text()).not.toContain('CLI 工具')
    expect(wrapper.text()).not.toContain('CLI 配置')
    expect(wrapper.text()).not.toContain('创建：')
    expect(wrapper.text()).not.toContain('更新：')
    expect(wrapper.text()).not.toContain('停止')
    expect(wrapper.text()).not.toContain('清理工作区')
    expect(wrapper.text()).not.toContain('编辑')
    expect(wrapper.text()).not.toContain('任务计划')
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

  it('shows 重置 only in the more actions menu when workflow node is pending approval', async () => {
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

    const resetButtons = wrapper
      .findAll('button')
      .filter((button) => button.text().trim() === '重置')
    expect(resetButtons.length).toBe(0)
    expect(wrapper.findComponent({ name: 'TaskDetailReviewCard' }).text()).not.toContain('重置')
    const executionContextBar = wrapper.findComponent({ name: 'TaskExecutionContextBar' })
    expect(executionContextBar.text()).not.toContain('重置')
    await executionContextBar.get('button[aria-label="更多操作"]').trigger('click')
    await flushPromises()
    expect(
      executionContextBar
        .findAll('button')
        .map((button) => button.text().trim())
        .filter((text) => text === '重置' || text === '删除'),
    ).toEqual(['重置', '删除'])
    expect(wrapper.findComponent({ name: 'TaskDetailWorkflowCard' }).text()).not.toContain('已选中节点')
  })

  it('hides 重置 in the more actions menu after task is completed', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    tasksApi.detailWithNodes.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'workflow',
        title: 'Workflow task',
        status: 'done',
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
          name: 'Completed node',
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

    const executionContextBar = wrapper.findComponent({ name: 'TaskExecutionContextBar' })
    expect(executionContextBar.text()).not.toContain('重置')
    await executionContextBar.get('button[aria-label="更多操作"]').trigger('click')
    await flushPromises()
    expect(
      executionContextBar
        .findAll('button')
        .map((button) => button.text().trim())
        .filter((text) => text === '重置' || text === '删除'),
    ).toEqual(['删除'])
  })

  it('resets the selected workflow node via reset-node API', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const detailResponse: TaskDetail = {
      task: {
        id: 'task-1',
        projectId: 'project-1',
        businessLineId: 'business-line-1',
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
          name: 'First node',
          status: 'done',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          name: 'Second node',
          status: 'done',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-2',
        },
      ],
    }

    tasksApi.detailWithNodes.mockResolvedValueOnce(detailResponse)
    tasksApi.resetNode.mockResolvedValueOnce(detailResponse)

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

    const secondNodeButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Second node'))
    expect(secondNodeButton).toBeTruthy()
    await secondNodeButton?.trigger('click')
    await flushPromises()

    await wrapper.get('button[aria-label="更多操作"]').trigger('click')
    await flushPromises()

    const resetButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '重置')
    expect(resetButton).toBeTruthy()
    await resetButton?.trigger('click')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items).toHaveLength(0)
    expect(tasksApi.resetNode).toHaveBeenCalledWith('task-1', {
      nodeId: 'node-2',
    })
  })

  it('retries workflow tasks without a stale selected node id when no review node is present in detail', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const retryDetail = {
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'workflow' as const,
        title: 'Workflow task',
        status: 'in_review' as const,
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
          name: 'Completed node',
          status: 'done' as const,
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
      ],
    }

    tasksApi.detailWithNodes.mockResolvedValueOnce(retryDetail)
    tasksApi.retry.mockResolvedValueOnce(retryDetail)

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

    const reExecuteButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '重新执行')

    expect(reExecuteButton).toBeDefined()

    await reExecuteButton!.trigger('click')
    await flushPromises()

    expect(tasksApi.retry).toHaveBeenCalledWith('task-1', {})
  })

  it('keeps a manually selected workflow node when detail refresh does not change node statuses', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const initialDetail = {
      task: {
        id: 'task-1',
        projectId: 'project-1',
        mode: 'workflow' as const,
        title: 'Workflow task',
        status: 'in_review' as const,
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
          name: 'Current review',
          status: 'in_review' as const,
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        },
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          name: 'Second node',
          status: 'todo' as const,
          agentCliId: 'cursor-agent',
          agentCliConfigId: 'cfg-2',
        },
      ],
    }

    tasksApi.detailWithNodes.mockResolvedValueOnce(initialDetail)
    tasksApi.reply.mockResolvedValueOnce({
      ...initialDetail,
      task: {
        ...initialDetail.task,
        updatedAt: '2026-02-27T10:00:01.000Z',
      },
      nodes: initialDetail.nodes.map((node) => ({ ...node })),
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

    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    const secondNodeButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Second node'))

    expect(secondNodeButton).toBeDefined()
    await secondNodeButton!.trigger('click')
    await flushPromises()

    await wrapper.get('textarea[aria-label="回复内容"]').setValue('keep selection')
    await wrapper.get('textarea[aria-label="回复内容"]').trigger('keydown', {
      key: 'Enter',
      shiftKey: false,
      isComposing: false,
      preventDefault: () => undefined,
    })
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items).toHaveLength(0)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(secondNodeButton?.classes()).toContain('ring-2')
  })

  it('reselects and scrolls to the current workflow node when node statuses change', async () => {
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
            name: 'First node',
            status: 'in_progress',
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
          },
          {
            id: 'node-2',
            taskId: 'task-1',
            nodeOrder: 2,
            name: 'Second node',
            status: 'todo',
            agentCliId: 'cursor-agent',
            agentCliConfigId: 'cfg-2',
          },
        ],
      })
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
          updatedAt: '2026-02-27T10:00:01.000Z',
        },
        nodes: [
          {
            id: 'node-1',
            taskId: 'task-1',
            nodeOrder: 1,
            name: 'First node',
            status: 'done',
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
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
        ],
      })

    openSseStream.mockImplementation(async (_url, _query, options) => {
      options?.onEvent?.({
        data: JSON.stringify({
          id: 'log-1',
          taskId: 'task-1',
          taskNodeId: 'node-2',
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
            template: '<div />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(16)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(scrollIntoView).toHaveBeenCalledTimes(2)

    const selectedButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Second node'))

    expect(selectedButton?.classes()).toContain('ring-2')

    vi.useRealTimers()
  })
})
