import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import ExecutionPanel from '../ExecutionPanel.vue'

const baseProps = {
  title: 'Codex',
  loading: false,
  agentCliId: 'codex',
  taskStatus: 'in_progress' as const,
  taskStatusLabel: '执行中',
  taskStatusClass: 'bg-muted',
  streamConnected: true,
  formatDate: () => '',
}

function createRect(top: number): DOMRect {
  return {
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }
}

describe('ExecutionPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens runner workspace markdown links in the artifact panel', async () => {
    const messages: TaskMessage[] = [
      {
        role: 'assistant',
        content:
          '{"text":"已写入 [brainstorm.md](/workspace/docs/feature/2605121818-78a8/brainstorm.md)。"}',
        createdAt: '2026-05-12T10:18:59.187Z',
        taskNodeId: 'node-1',
      },
    ]
    const wrapper = mount(ExecutionPanel, {
      props: {
        ...baseProps,
        messages,
      },
      global: {
        stubs: {
          CliLogRenderer: {
            template:
              '<div><a href="/workspace/docs/feature/2605121818-78a8/brainstorm.md">brainstorm.md</a></div>',
          },
        },
      },
    })

    await wrapper.get('a').trigger('click')

    expect(wrapper.emitted('openArtifactFile')?.[0]).toEqual([
      {
        path: 'docs/feature/2605121818-78a8/brainstorm.md',
        taskNodeId: 'node-1',
      },
    ])
  })

  it('keeps the clicked artifact link visually anchored after layout changes', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 0
    })

    let anchorTop = 180
    const wrapper = mount(ExecutionPanel, {
      props: {
        ...baseProps,
        messages: [],
      },
      global: {
        stubs: {
          CliLogRenderer: {
            template:
              '<div><a href="/workspace/docs/feature/2605121818-78a8/brainstorm.md">brainstorm.md</a></div>',
          },
        },
      },
    })
    const scrollContainer = wrapper.find('.overflow-y-auto').element as HTMLDivElement
    const anchor = wrapper.get('a').element as HTMLAnchorElement
    Object.defineProperty(scrollContainer, 'scrollTop', {
      value: 300,
      writable: true,
      configurable: true,
    })
    scrollContainer.getBoundingClientRect = () => createRect(100)
    anchor.getBoundingClientRect = () => createRect(anchorTop)

    const triggerPromise = wrapper.get('a').trigger('click')
    anchorTop = 240
    await triggerPromise
    await nextTick()

    expect(scrollContainer.scrollTop).toBe(60)
  })

  it('leaves normal external links untouched', async () => {
    const wrapper = mount(ExecutionPanel, {
      props: {
        ...baseProps,
        messages: [],
      },
      global: {
        stubs: {
          CliLogRenderer: {
            template: '<div><a href="https://example.com/docs">external</a></div>',
          },
        },
      },
    })

    await wrapper.get('a').trigger('click')

    expect(wrapper.emitted('openArtifactFile')).toBeUndefined()
  })
})
