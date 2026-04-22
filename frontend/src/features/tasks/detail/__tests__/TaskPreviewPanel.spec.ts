import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TaskPreviewPanel from '@features/tasks/detail/TaskPreviewPanel.vue'

const readyPreview = {
  status: 'ready' as const,
  url: 'https://preview.example.com/p/task-1/',
}

describe('TaskPreviewPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the runtime preview url from task environment', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    expect(wrapper.find('iframe').attributes('src')).toBe('https://preview.example.com/p/task-1/')
    expect(wrapper.text()).toContain('/p/task-1/')
    expect(wrapper.text()).toContain('预览 1')
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
    expect(wrapper.text()).toContain('系统正在为当前任务分配预览地址')
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

  it('adds a tab when clicking 新建标签', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: readyPreview,
      },
    })

    expect(wrapper.findAll('iframe')).toHaveLength(1)

    await wrapper.find('button[title="使用当前地址新建预览标签"]').trigger('click')
    await wrapper.vm.$nextTick()

    const iframes = wrapper.findAll('iframe')
    expect(iframes).toHaveLength(2)
    expect(iframes[0]!.attributes('src')).toBe(readyPreview.url)
    expect(iframes[1]!.attributes('src')).toBe(readyPreview.url)
    expect(wrapper.text()).toMatch(/预览 1/)
    expect(wrapper.text()).toMatch(/预览 2/)
  })
})
