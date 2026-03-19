import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import Renderer from './Renderer.vue'

function createMessage(content: Record<string, unknown>, createdAt = '2026-03-19T02:00:00.000Z'): TaskMessage {
  return {
    role: 'system',
    content: JSON.stringify(content),
    createdAt,
  }
}

describe('CliCodexRenderer', () => {
  it('renders injected user prompt records as user messages', () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          createMessage({
            type: 'user_message',
            message: 'Please continue from the previous result',
            created_at: '2026-03-19T02:00:00.000Z',
            source: 'ainative_injected_prompt',
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('Please continue from the previous result')
  })

  it('renders todo list events as a dedicated card', async () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          createMessage({
            type: 'item.completed',
            item: {
              id: 'item_11',
              type: 'todo_list',
              items: [
                { text: '梳理后台登录页现状与可确认的需求背景', completed: true },
                { text: '归纳问题框架、需求项、边界与待确认问题', completed: true },
                { text: '写入 docs/feature/20260319-140717/brainstorm.md', completed: true },
              ],
            },
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('待办清单')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('3/3')
    expect(wrapper.text()).toContain('展开')
    expect(wrapper.text()).not.toContain('写入 docs/feature/20260319-140717/brainstorm.md')

    await wrapper.get('button').trigger('click')

    expect(wrapper.text()).toContain('写入 docs/feature/20260319-140717/brainstorm.md')
  })

  it('renders started todo list events as in-progress cards', async () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          createMessage({
            type: 'item.started',
            item: {
              id: 'item_11',
              type: 'todo_list',
              items: [
                { text: '梳理后台登录页现状与可确认的需求背景', completed: true },
                { text: '归纳问题框架、需求项、边界与待确认问题', completed: false },
                { text: '写入 docs/feature/20260319-140717/brainstorm.md', completed: false },
              ],
            },
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('待办清单')
    expect(wrapper.text()).toContain('进行中')
    expect(wrapper.text()).toContain('1/3')
    expect(wrapper.text()).not.toContain('归纳问题框架、需求项、边界与待确认问题')

    await wrapper.get('button').trigger('click')

    expect(wrapper.text()).toContain('归纳问题框架、需求项、边界与待确认问题')
  })
})
