import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_VIEWPORT_STORAGE_KEY } from '@features/tasks/detail/task-preview-viewports'
import TaskPreviewPanel from '@features/tasks/detail/TaskPreviewPanel.vue'

const reportPreviewDiagnostic = vi.fn()

vi.mock('@/api/tasks', () => ({
  tasksApi: {
    reportPreviewDiagnostic,
  },
}))

const readyPreview = {
  status: 'ready' as const,
  url: 'https://preview.example.com/p/task-1/',
}

describe('TaskPreviewPanel', () => {
  beforeEach(() => {
    localStorage.removeItem(PREVIEW_VIEWPORT_STORAGE_KEY)
    reportPreviewDiagnostic.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the runtime preview url from task environment', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        preview: readyPreview,
      },
    })

    expect(wrapper.find('iframe').attributes('src')).toBe('https://preview.example.com/p/task-1/')
    expect(wrapper.get('[data-testid="task-preview-active-url"]').text()).toBe(
      'https://preview.example.com/p/task-1/',
    )
    expect(wrapper.text()).toContain('导航')
  })

  it('shows provisioning state when preview url is still being assigned', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: {
          status: 'provisioning',
          url: null,
        },
      },
    })

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).toContain('容器预览生成中')
    expect(wrapper.text()).toContain('预览服务正在启动')
  })

  it('keeps iframe visible when preview url exists but runtime is still provisioning', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: {
          status: 'provisioning',
          url: 'http://localhost:39144/api/',
        },
        serviceStatuses: [
          {
            name: 'yanxue',
            port: 8000,
            phase: 'starting',
            message: 'go run ./cmd/server',
            isPrimaryPreview: true,
          },
        ],
      },
    })

    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.get('[data-testid="task-preview-active-url"]').text()).toBe(
      'http://localhost:39144/api/',
    )
    expect(wrapper.text()).toContain('yanxue:8000 启动中')
    expect(wrapper.text()).toContain('go run ./cmd/server')
  })

  it('keeps iframe visible when preview route is reachable but upstream already failed', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: {
          status: 'failed',
          url: 'http://localhost:39144/api/',
        },
        serviceStatuses: [
          {
            name: 'yanxue',
            port: 8000,
            phase: 'failed',
            message: 'Service process exited before port 8000 became ready',
            isPrimaryPreview: true,
          },
        ],
      },
    })

    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.text()).toContain('yanxue:8000 启动失败')
  })

  it('shows task logs without exposing manual config or restart controls', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
        logs: [
          {
            id: 'log-1',
            taskId: 'task-1',
            level: 'info',
            message: 'runner booted',
            createdAt: '2026-03-16T00:00:00.000Z',
          },
        ],
        formatDate: () => '2026/03/16 08:00:00',
      },
    })

    await wrapper.find('button[title="查看运行日志"]').trigger('click')

    expect(wrapper.find('button[title="配置启动命令和预览地址"]').exists()).toBe(false)
    expect(wrapper.find('button[title="重启服务"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('runner booted')
    expect(wrapper.text()).toContain('2026/03/16 08:00:00')
  })

  it('resolves path-only postMessage url against preview base so iframe src is absolute on preview origin', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    handler!(
      new MessageEvent('message', {
        data: { type: 'ainative:preview:openInTab', url: '/other/' },
        origin: 'https://preview.example.com',
      }),
    )

    await wrapper.vm.$nextTick()

    const iframes = wrapper.findAll('iframe')
    expect(iframes).toHaveLength(2)
    expect(iframes[1]!.attributes('src')).toBe('https://preview.example.com/other/')
  })

  it('opens a second preview tab when postMessage matches preview origin and hostname', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    const nextUrl = 'https://preview.example.com/p/other'
    handler!(
      new MessageEvent('message', {
        data: { type: 'ainative:preview:openInTab', url: nextUrl },
        origin: 'https://preview.example.com',
      }),
    )

    await wrapper.vm.$nextTick()

    const iframes = wrapper.findAll('iframe')
    expect(iframes).toHaveLength(2)
    expect(iframes[1]!.attributes('src')).toBe(nextUrl)
    expect(wrapper.text()).toContain('预览 2')
  })

  it('ignores postMessage with mismatched event origin', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    handler!(
      new MessageEvent('message', {
        data: { type: 'ainative:preview:openInTab', url: 'https://preview.example.com/x' },
        origin: 'https://evil.example.com',
      }),
    )

    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('iframe')).toHaveLength(1)
  })

  it('ignores postMessage when target url hostname differs from preview', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    handler!(
      new MessageEvent('message', {
        data: { type: 'ainative:preview:openInTab', url: 'https://other.example.com/x' },
        origin: 'https://preview.example.com',
      }),
    )

    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('iframe')).toHaveLength(1)
  })

  it('shows platform HMR relay diagnostic from preview iframe messages', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    handler!(
      new MessageEvent('message', {
        data: {
          type: 'ainative:preview:diagnostic',
          kind: 'platform-hmr-relay-failed',
          detail: { url: 'wss://preview.example.com/_ainative/vite-hmr/trip-miniprogram' },
        },
        origin: 'https://preview.example.com',
      }),
    )

    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="task-preview-diagnostic"]').text()).toContain(
      '平台 HMR relay 建联失败',
    )
    expect(reportPreviewDiagnostic).toHaveBeenCalledWith('task-1', {
      kind: 'platform-hmr-relay-failed',
      message: 'Preview HMR relay failure',
      summary: '平台 HMR relay 建联失败',
      dedupeKey: expect.any(String),
      detail: {
        url: 'wss://preview.example.com/_ainative/vite-hmr/trip-miniprogram',
      },
    })
  })

  it('shows workspace runtime diagnostic from preview iframe messages', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    handler!(
      new MessageEvent('message', {
        data: {
          type: 'ainative:preview:diagnostic',
          kind: 'workspace-runtime-error',
          detail: {
            message: 'TypeError: bootstrap failed',
            summary: 'TypeError: bootstrap failed',
            source: 'unhandledrejection',
            stack: 'TypeError: bootstrap failed\n at bootstrap.ts:1:1',
          },
        },
        origin: 'https://preview.example.com',
      }),
    )

    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="task-preview-diagnostic"]').text()).toContain(
      '子仓运行时发生异常：TypeError: bootstrap failed',
    )
    expect(reportPreviewDiagnostic).toHaveBeenCalledWith('task-1', {
      kind: 'workspace-runtime-error',
      message: 'Preview runtime error',
      summary: 'TypeError: bootstrap failed',
      dedupeKey: expect.any(String),
      detail: {
        source: 'unhandledrejection',
        message: 'TypeError: bootstrap failed',
        summary: 'TypeError: bootstrap failed',
        stack: 'TypeError: bootstrap failed\n at bootstrap.ts:1:1',
      },
    })
  })

  it('deduplicates repeated runtime diagnostics within the same iframe session', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    const event = new MessageEvent('message', {
      data: {
        type: 'ainative:preview:diagnostic',
        kind: 'workspace-runtime-error',
        detail: {
          message: 'TypeError: bootstrap failed',
          summary: 'TypeError: bootstrap failed',
          source: 'unhandledrejection',
          stack: 'TypeError: bootstrap failed\n at bootstrap.ts:1:1',
        },
      },
      origin: 'https://preview.example.com',
    })

    handler!(event)
    handler!(event)
    await wrapper.vm.$nextTick()

    expect(reportPreviewDiagnostic).toHaveBeenCalledTimes(1)
  })

  it('falls back to a weak generic hint when runtime diagnostic has no readable summary', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    const handler = addListener.mock.calls.find(([ev]) => ev === 'message')?.[1] as
      | ((e: MessageEvent) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    handler!(
      new MessageEvent('message', {
        data: {
          type: 'ainative:preview:diagnostic',
          kind: 'workspace-runtime-error',
          detail: {},
        },
        origin: 'https://preview.example.com',
      }),
    )

    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="task-preview-diagnostic"]').text()).toContain(
      '子仓运行时发生未处理异常，请查看任务日志',
    )
  })

  it('uses full-width preview surface by default (no valid viewport in localStorage)', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })
    expect(wrapper.find('[data-testid="task-preview-iframe-surface--full"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="task-preview-iframe-surface--preset"]').exists()).toBe(false)
  })

  it('restores fixed viewport and frame size from localStorage (portrait)', () => {
    localStorage.setItem(
      PREVIEW_VIEWPORT_STORAGE_KEY,
      JSON.stringify({ viewportId: 'ios-14', landscape: false }),
    )
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })
    expect(wrapper.find('[data-testid="task-preview-iframe-surface--preset"]').exists()).toBe(true)
    const el = wrapper.get('[data-testid="task-preview-viewport-frame"]').element as HTMLElement
    expect(el.style.width).toBe('390px')
    expect(el.style.height).toBe('844px')
  })

  it('restores landscape from localStorage (swaps width and height)', () => {
    localStorage.setItem(
      PREVIEW_VIEWPORT_STORAGE_KEY,
      JSON.stringify({ viewportId: 'ios-14', landscape: true }),
    )
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })
    const el = wrapper.get('[data-testid="task-preview-viewport-frame"]').element as HTMLElement
    expect(el.style.width).toBe('844px')
    expect(el.style.height).toBe('390px')
  })

  it('toggles landscape and persists to localStorage', async () => {
    localStorage.setItem(
      PREVIEW_VIEWPORT_STORAGE_KEY,
      JSON.stringify({ viewportId: 'ios-14', landscape: false }),
    )
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })
    const el = wrapper.get('[data-testid="task-preview-viewport-frame"]').element as HTMLElement
    expect(el.style.width).toBe('390px')
    expect(el.style.height).toBe('844px')

    await wrapper.find('button[aria-label="横竖屏切换，交换预览宽高"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(el.style.width).toBe('844px')
    expect(el.style.height).toBe('390px')
    const stored = JSON.parse(localStorage.getItem(PREVIEW_VIEWPORT_STORAGE_KEY)!) as { landscape: boolean }
    expect(stored.landscape).toBe(true)
  })

  it('falls back to full layout when localStorage has unknown preset id', () => {
    localStorage.setItem(
      PREVIEW_VIEWPORT_STORAGE_KEY,
      JSON.stringify({ viewportId: 'not-a-preset', landscape: true }),
    )
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })
    expect(wrapper.find('[data-testid="task-preview-iframe-surface--full"]').exists()).toBe(true)
  })

})
