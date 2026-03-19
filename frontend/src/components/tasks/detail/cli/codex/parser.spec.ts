import { describe, expect, it } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCodexMessages } from './parser'

function createMessage(content: Record<string, unknown>, createdAt = '2026-03-19T02:00:00.000Z'): TaskMessage {
  return {
    role: 'system',
    content: JSON.stringify(content),
    createdAt,
  }
}

describe('parseCodexMessages', () => {
  it('parses thread and turn lifecycle events with explicit metadata', () => {
    const entries = parseCodexMessages([
      createMessage({
        type: 'thread.started',
        thread_id: '019d03cc-e251-7430-89c0-d3d662e676a9',
      }),
      createMessage({
        type: 'turn.started',
      }),
    ])

    expect(entries).toEqual([
      expect.objectContaining({
        type: 'system_message',
        content: 'Thread started: 019d03cc-e251-7430-89c0-d3d662e676a9',
        metadata: expect.objectContaining({
          codexEventType: 'thread_started',
          threadId: '019d03cc-e251-7430-89c0-d3d662e676a9',
        }),
      }),
      expect.objectContaining({
        type: 'system_message',
        content: 'Turn started',
        metadata: expect.objectContaining({
          codexEventType: 'turn_started',
        }),
      }),
    ])
  })

  it('parses todo_list item completion events into card metadata', () => {
    const entries = parseCodexMessages([
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
    ])

    expect(entries).toEqual([
      expect.objectContaining({
        type: 'system_message',
        content: 'Todo list completed (3/3)',
        metadata: expect.objectContaining({
          codexCardType: 'todo_list',
          codexItemId: 'item_11',
          codexItemType: 'todo_list',
          todoCompletedCount: 3,
          todoTotalCount: 3,
          status: 'success',
          todoItems: [
            { text: '梳理后台登录页现状与可确认的需求背景', completed: true },
            { text: '归纳问题框架、需求项、边界与待确认问题', completed: true },
            { text: '写入 docs/feature/20260319-140717/brainstorm.md', completed: true },
          ],
        }),
      }),
    ])
  })

  it('parses todo_list item started events as in-progress cards', () => {
    const entries = parseCodexMessages([
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
    ])

    expect(entries).toEqual([
      expect.objectContaining({
        type: 'system_message',
        content: 'Todo list updated (1/3)',
        metadata: expect.objectContaining({
          codexCardType: 'todo_list',
          codexItemId: 'item_11',
          codexItemType: 'todo_list',
          todoCompletedCount: 1,
          todoTotalCount: 3,
          status: 'running',
          todoItems: [
            { text: '梳理后台登录页现状与可确认的需求背景', completed: true },
            { text: '归纳问题框架、需求项、边界与待确认问题', completed: false },
            { text: '写入 docs/feature/20260319-140717/brainstorm.md', completed: false },
          ],
        }),
      }),
    ])
  })
})
