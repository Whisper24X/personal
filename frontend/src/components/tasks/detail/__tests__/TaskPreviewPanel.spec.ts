import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskPreviewPanel from '@/components/tasks/detail/TaskPreviewPanel.vue'

const { projectsApi, tasksApi } = vi.hoisted(() => ({
  projectsApi: {
    detail: vi.fn(),
    update: vi.fn(),
  },
  tasksApi: {
    createTerminalSession: vi.fn(),
    terminalStop: vi.fn(),
    terminalRemove: vi.fn(),
  },
}))

const terminalMock = vi.hoisted(() => {
  type TerminalMessage =
    | { type: 'output'; data: string }
    | { type: 'exit'; code: number | null; signal: string | null }
    | { type: 'error'; message: string }
    | { type: 'attached'; sessionId: string }

  type TerminalCallbacks = {
    onMessage: (message: TerminalMessage) => void
    onOpen?: () => void
    onClose?: () => void
  }

  class MockTerminalWsConnection {
    public isOpen = false
    public readonly attach = vi.fn((taskId: string, sessionId: string) => {
      this.lastAttached = { taskId, sessionId }
      this.callbacks.onMessage({ type: 'attached', sessionId })
    })
    public readonly detach = vi.fn()
    public readonly input = vi.fn()
    public readonly dispose = vi.fn(() => {
      this.isOpen = false
      this.callbacks.onClose?.()
    })
    public lastAttached: { taskId: string; sessionId: string } | null = null

    constructor(private readonly callbacks: TerminalCallbacks) {
      terminalMock.instances.push(this)
    }

    connect() {
      this.isOpen = true
      this.callbacks.onOpen?.()
    }
  }

  return {
    instances: [] as MockTerminalWsConnection[],
    MockTerminalWsConnection,
  }
})

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

vi.mock('@/utils/ws/terminal-ws', () => ({
  TerminalWsConnection: terminalMock.MockTerminalWsConnection,
}))

describe('TaskPreviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    terminalMock.instances.length = 0

    projectsApi.detail.mockResolvedValue({
      id: 'project-1',
      configJson: {
        keep: 'value',
        preview: {
          command: 'npm run dev',
          url: 'manual.local:3000',
          runtimeUrl: 'runtime.local:38080',
        },
      },
    })
    projectsApi.update.mockResolvedValue(undefined)
    tasksApi.createTerminalSession.mockResolvedValue({
      id: 'session-1',
      taskId: 'task-1',
      cwd: '/tmp',
      shell: '/bin/sh',
      status: 'running',
      createdAt: '2026-03-16T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z',
    })
    tasksApi.terminalStop.mockResolvedValue(undefined)
    tasksApi.terminalRemove.mockResolvedValue(undefined)
  })

  it('prefers runtime preview url from project settings', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(projectsApi.detail).toHaveBeenCalledWith('project-1')
    expect(wrapper.text()).toContain('http://runtime.local:38080')
    expect(wrapper.find('iframe').attributes('src')).toBe(
      'http://runtime.local:38080',
    )
  })

  it('renders runtime preview url even when manual preview url is absent', async () => {
    projectsApi.detail.mockResolvedValueOnce({
      id: 'project-1',
      configJson: {
        preview: {
          command: 'npm run dev',
          runtimeUrl: 'runtime.local:39090',
        },
      },
    })

    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('http://runtime.local:39090')
    expect(wrapper.find('iframe').attributes('src')).toBe(
      'http://runtime.local:39090',
    )
  })

  it('restarts preview service with the configured command', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
      },
    })

    await flushPromises()
    await wrapper.find('button[title="重启服务"]').trigger('click')
    await flushPromises()

    const wsInstance = terminalMock.instances[0]

    expect(wsInstance).toBeDefined()
    if (!wsInstance) {
      throw new Error('Expected websocket connection to be created')
    }

    expect(tasksApi.createTerminalSession).toHaveBeenCalledWith('task-1', {
      cols: 120,
      rows: 30,
      shell: '/bin/sh',
    })
    expect(wsInstance.attach).toHaveBeenCalledWith('task-1', 'session-1')
    expect(wsInstance.input).toHaveBeenCalledWith('exec npm run dev\n')
  })

  it('reloads preview config when refreshToken changes', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
        refreshToken: 0,
      },
    })

    await flushPromises()
    expect(projectsApi.detail).toHaveBeenCalledTimes(1)

    projectsApi.detail.mockResolvedValueOnce({
      id: 'project-1',
      configJson: {
        preview: {
          command: 'npm run dev',
          url: 'manual.local:4000',
          runtimeUrl: 'runtime.local:48080',
        },
      },
    })

    await wrapper.setProps({
      refreshToken: 1,
    })
    await flushPromises()

    expect(projectsApi.detail).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('http://runtime.local:48080')
  })
})
