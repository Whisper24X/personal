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

  it('renders structured errors as collapsed cards with json details', () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          {
            role: 'error',
            content:
              '{"type":"error","message":"Reconnecting... 1/5 (stream disconnected before completion: Transport error: network error: error decoding response body)"}',
            createdAt: '2026-03-19T07:37:50.000Z',
          } as TaskMessage,
        ],
      },
    })

    const details = wrapper.get('details')

    expect(details.attributes('open')).toBeUndefined()
    expect(wrapper.text()).toContain('Error')
    expect(wrapper.text()).toContain('Reconnecting... 1/5')
    expect(wrapper.find('summary .uppercase').exists()).toBe(false)
    expect(wrapper.get('pre').text()).toContain('"type": "error"')
  })

  it('renders file change item events as readable card content instead of raw json', async () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          createMessage({
            type: 'item.completed',
            item: {
              id: 'item_4',
              type: 'file_change',
              changes: [
                {
                  path: '/Users/fuzhifei/code/go/src/gitlab.yc345.tv/frontend/ainative/tmp/19d7db85-cd7d-4af5-8e47-98abfd89bab0/projects/7363eab3-aafe-4129-936a-25df742c2dc1/worktrees/wk-20260319-150354/docs/feature/20260319-150354/brainstorm.md',
                  kind: 'add',
                },
              ],
              status: 'completed',
            },
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('文件变更')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('brainstorm.md')
    expect(wrapper.text()).not.toContain('"type":"item.completed"')

    await wrapper.get('button').trigger('click')

    expect(wrapper.text()).toContain('新增')
    expect(wrapper.text()).toContain('docs/feature/20260319-150354/brainstorm.md')
  })

  it('pairs tool results by toolUseId even when non-tool entries appear in between', async () => {
    const wrapper = mount(Renderer, {
      props: {
        messages: [
          createMessage({
            type: 'agent_message',
            text: 'Checking local Playwright availability',
          }),
          createMessage({
            type: 'item.started',
            item: {
              id: 'item_10',
              type: 'command_execution',
              command: 'find /Users/fuzhifei -path *playwright*package.json',
              aggregated_output: '',
              exit_code: null,
              status: 'in_progress',
            },
          }),
          createMessage({
            type: 'warning',
            message: 'stdout buffering delayed the completion record',
          }),
          createMessage({
            type: 'item.completed',
            item: {
              id: 'item_10',
              type: 'command_execution',
              command: 'find /Users/fuzhifei -path *playwright*package.json',
              aggregated_output: './.agents/skills/playwright-skill/package.json\n',
              exit_code: 0,
              status: 'completed',
            },
          }),
        ],
      },
    })

    await wrapper.get('.rounded-lg .flex.cursor-pointer').trigger('click')

    expect(wrapper.text()).toContain('execute')
    expect(wrapper.text()).toContain('./.agents/skills/playwright-skill/package.json')
    expect(wrapper.text()).not.toContain('completed')
  })
})
