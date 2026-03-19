import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import Renderer from './Renderer.vue'
import TaskGroupCard from './TaskGroupCard.vue'

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

  it('renders json transport errors as structured error cards', () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          createMessage({
            type: 'error',
            message: 'Reconnecting... 1/5 (stream disconnected before completion: Transport error: network error: error decoding response body)',
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('连接异常')
    expect(wrapper.text()).toContain('Reconnecting... 1/5')
    expect(wrapper.text()).toContain('error')
  })

  it('toggles codex task group copy between summary and full content', async () => {
    const wrapper = mount(TaskGroupCard, {
      props: {
        group: {
          type: 'task',
          title: '诊断摘要预览',
          description: '完整诊断说明\n\n- 第一步\n- 第二步',
          tools: [
            {
              id: 'tool-1',
              type: 'command_run',
              timestamp: 1,
              content: 'pwd',
              metadata: {
                toolName: 'execute',
                command: 'pwd',
                status: 'success',
              },
            },
            {
              id: 'tool-1-result',
              type: 'tool_result',
              timestamp: 2,
              content: '/tmp/project',
              metadata: {
                status: 'success',
              },
            },
          ],
        },
      },
    })

    const button = wrapper.get('button')
    const chevron = button.get('svg')

    expect(wrapper.text()).toContain('完整诊断说明')
    expect(wrapper.text()).toContain('第一步')
    expect(chevron.classes()).toContain('rotate-90')

    await button.trigger('click')

    expect(wrapper.text()).toContain('诊断摘要预览')
    expect(wrapper.text()).not.toContain('第一步')
    expect(chevron.classes()).not.toContain('rotate-90')
  })

  it('keeps completed codex task groups expanded by default', () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          createMessage({
            type: 'assistant_message',
            message: 'Run diagnostics with details',
          }),
          createMessage({
            type: 'exec_command_begin',
            call_id: 'call_1',
            command: ['pwd'],
          }),
          createMessage({
            type: 'exec_command_end',
            call_id: 'call_1',
            exit_code: 0,
            stdout: '/tmp/project',
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('Run diagnostics with details')
    expect(wrapper.text()).toContain('pwd')
    expect(wrapper.get('button svg').classes()).toContain('rotate-90')
  })
})
