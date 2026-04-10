import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskTerminalPanel from '../TaskTerminalPanel.vue'

const prompt = 'root@4881f128410e:/workspace# '

type MockTerminalInstance = {
  cols: number
  rows: number
  content: string
  loadAddon: ReturnType<typeof vi.fn>
  open: ReturnType<typeof vi.fn>
  onData: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

type MockWsInstance = {
  isOpen: boolean
  connect: ReturnType<typeof vi.fn>
  attach: ReturnType<typeof vi.fn>
  detach: ReturnType<typeof vi.fn>
  input: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

const { tasksApi, terminalInstances, wsInstances } = vi.hoisted(() => {
  return {
    tasksApi: {
      listTerminalSessions: vi.fn(),
      createTerminalSession: vi.fn(),
      terminalRemove: vi.fn(),
    },
    terminalInstances: [] as MockTerminalInstance[],
    wsInstances: [] as MockWsInstance[],
  }
})

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn()
  },
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {},
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80
    rows = 24
    content = ''
    loadAddon = vi.fn()
    open = vi.fn()
    onData = vi.fn()
    write = vi.fn((data: string) => {
      this.content += data
    })
    clear = vi.fn(() => {
      const lines = this.content.split(/\r?\n/)
      const lastLine = lines[lines.length - 1] ?? ''
      this.content = lastLine
    })
    reset = vi.fn(() => {
      this.content = ''
    })
    dispose = vi.fn()

    constructor() {
      terminalInstances.push(this)
    }
  },
}))

vi.mock('@shared/utils/ws/terminal-ws', () => ({
  TerminalWsConnection: class {
    isOpen = false
    connect = vi.fn(() => {
      this.isOpen = true
      this.callbacks.onOpen?.()
    })
    attach = vi.fn(() => {
      this.callbacks.onMessage({
        type: 'output',
        data: prompt,
      })
    })
    detach = vi.fn()
    input = vi.fn()
    resize = vi.fn()
    dispose = vi.fn(() => {
      this.isOpen = false
    })

    constructor(private readonly callbacks: {
      onMessage: (message: { type: 'output'; data: string }) => void
      onOpen?: () => void
      onClose?: () => void
      onError?: () => void
    }) {
      wsInstances.push(this)
    }
  },
}))

describe('TaskTerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    terminalInstances.length = 0
    wsInstances.length = 0
    sessionStorage.clear()

    class ResizeObserverMock {
      observe = vi.fn()
      disconnect = vi.fn()
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    tasksApi.listTerminalSessions.mockResolvedValue({
      sessions: [
        {
          id: 'session-1',
          taskId: 'task-1',
          cwd: '/workspace',
          shell: '/bin/bash',
          status: 'running',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:00.000Z',
        },
      ],
    })
    tasksApi.createTerminalSession
      .mockResolvedValueOnce({
        id: 'session-2',
        taskId: 'task-1',
        cwd: '/workspace',
        shell: '/bin/bash',
        status: 'running',
        createdAt: '2026-04-08T00:00:01.000Z',
        updatedAt: '2026-04-08T00:00:01.000Z',
      })
      .mockResolvedValueOnce({
        id: 'session-3',
        taskId: 'task-1',
        cwd: '/workspace',
        shell: '/bin/bash',
        status: 'running',
        createdAt: '2026-04-08T00:00:02.000Z',
        updatedAt: '2026-04-08T00:00:02.000Z',
      })
  })

  it('resets terminal output before attaching a newly created session', async () => {
    const wrapper = mount(TaskTerminalPanel, {
      props: {
        taskId: 'task-1',
      },
    })

    await flushPromises()

    const terminal = terminalInstances[0]
    expect(terminal).toBeDefined()
    if (!terminal) {
      throw new Error('Expected terminal instance to be created')
    }

    expect(terminal.content).toBe(prompt)

    const createButton = wrapper
      .findAll('button')
      .find((node) => node.text().trim() === '新建会话')

    expect(createButton).toBeDefined()
    if (!createButton) {
      throw new Error('Expected create session button to be rendered')
    }

    await createButton.trigger('click')
    await flushPromises()

    expect(terminal.content).toBe(prompt)

    await createButton.trigger('click')
    await flushPromises()

    expect(terminal.content).toBe(prompt)
    expect(terminal.reset).toHaveBeenCalledTimes(3)
    expect(terminal.clear).not.toHaveBeenCalled()
    expect(wsInstances[0]?.attach).toHaveBeenCalledTimes(3)
  })
})
