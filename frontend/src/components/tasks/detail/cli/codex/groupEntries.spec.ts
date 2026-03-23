import { describe, expect, it } from 'vitest'
import type { NormalizedEntry } from '../types'
import { groupCodexEntries } from './groupEntries'

function createEntry(partial: Partial<NormalizedEntry> & Pick<NormalizedEntry, 'id' | 'type' | 'timestamp' | 'content'>): NormalizedEntry {
  return {
    metadata: undefined,
    ...partial,
  }
}

describe('groupCodexEntries', () => {
  it('keeps codex lifecycle events standalone after a task group starts', () => {
    const groups = groupCodexEntries([
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 1,
        content: 'Planning work',
      }),
      createEntry({
        id: 'turn-start-1',
        type: 'system_message',
        timestamp: 2,
        content: 'Turn started',
        metadata: {
          codexEventType: 'turn_started',
        },
      }),
      createEntry({
        id: 'tool-1',
        type: 'command_run',
        timestamp: 3,
        content: 'pwd',
        metadata: {
          status: 'running',
        },
      }),
      createEntry({
        id: 'turn-end-1',
        type: 'system_message',
        timestamp: 4,
        content: 'Turn completed',
        metadata: {
          codexEventType: 'turn_completed',
        },
      }),
    ])

    expect(groups).toHaveLength(4)
    expect(groups[0]).toMatchObject({
      type: 'task',
      description: 'Planning work',
      tools: [],
    })
    expect(groups[1]).toMatchObject({
      type: 'other',
      entry: {
        id: 'turn-start-1',
      },
    })
    expect(groups[2]).toMatchObject({
      type: 'task',
      tools: [
        expect.objectContaining({
          id: 'tool-1',
        }),
      ],
    })
    expect(groups[3]).toMatchObject({
      type: 'other',
      entry: {
        id: 'turn-end-1',
      },
    })
  })

  it('does not swallow lifecycle events after tool output', () => {
    const groups = groupCodexEntries([
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 1,
        content: 'Running command',
      }),
      createEntry({
        id: 'tool-1',
        type: 'command_run',
        timestamp: 2,
        content: 'ls',
        metadata: {
          status: 'success',
        },
      }),
      createEntry({
        id: 'turn-start-1',
        type: 'system_message',
        timestamp: 3,
        content: 'Turn started',
        metadata: {
          codexEventType: 'turn_started',
        },
      }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      type: 'task',
      tools: [
        expect.objectContaining({
          id: 'tool-1',
        }),
      ],
    })
    expect(groups[1]).toMatchObject({
      type: 'other',
      entry: {
        id: 'turn-start-1',
        content: 'Turn started',
      },
    })
  })

  it('keeps todo list cards standalone instead of merging them into task tools', () => {
    const groups = groupCodexEntries([
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 1,
        content: '整理执行计划',
      }),
      createEntry({
        id: 'tool-1',
        type: 'command_run',
        timestamp: 2,
        content: 'pwd',
        metadata: {
          status: 'running',
        },
      }),
      createEntry({
        id: 'todo-1',
        type: 'system_message',
        timestamp: 3,
        content: 'Todo list completed (2/2)',
        metadata: {
          codexCardType: 'todo_list',
          todoItems: [
            { text: '步骤一', completed: true },
            { text: '步骤二', completed: true },
          ],
        },
      }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      type: 'task',
      tools: [
        expect.objectContaining({
          id: 'tool-1',
        }),
      ],
    })
    expect(groups[1]).toMatchObject({
      type: 'other',
      entry: {
        id: 'todo-1',
      },
    })
  })

  it('keeps file change cards standalone instead of merging them into task tools', () => {
    const groups = groupCodexEntries([
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 1,
        content: '整理执行计划',
      }),
      createEntry({
        id: 'tool-1',
        type: 'command_run',
        timestamp: 2,
        content: 'pwd',
        metadata: {
          status: 'running',
        },
      }),
      createEntry({
        id: 'file-change-1',
        type: 'system_message',
        timestamp: 3,
        content: '文件变更 · 新增 `docs/feature/20260319-150354/brainstorm.md`',
        metadata: {
          codexCardType: 'file_change',
        },
      }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      type: 'task',
      tools: [
        expect.objectContaining({
          id: 'tool-1',
        }),
      ],
    })
    expect(groups[1]).toMatchObject({
      type: 'other',
      entry: {
        id: 'file-change-1',
      },
    })
  })

  it('merges leading thinking-only into the assistant task group', () => {
    const groups = groupCodexEntries([
      createEntry({
        id: 'think-1',
        type: 'thinking',
        timestamp: 1,
        content: 'Reasoning before reply.',
      }),
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 2,
        content: 'Running pwd next.',
      }),
      createEntry({
        id: 'tool-1',
        type: 'command_run',
        timestamp: 3,
        content: 'pwd',
        metadata: { status: 'running' },
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      type: 'task',
      description: 'Running pwd next.',
    })
    const task = groups[0] as { type: 'task'; tools: NormalizedEntry[] }
    expect(task.tools[0]?.type).toBe('thinking')
    expect(task.tools[0]?.content).toBe('Reasoning before reply.')
    expect(task.tools[1]?.type).toBe('command_run')
  })

  it('drops task groups that only contain orphaned tool results', () => {
    const groups = groupCodexEntries([
      createEntry({
        id: 'tool-result-1',
        type: 'tool_result',
        timestamp: 1,
        content: '',
        metadata: {
          toolUseId: 'item_11',
          status: 'success',
        },
      }),
      createEntry({
        id: 'turn-end-1',
        type: 'system_message',
        timestamp: 2,
        content: 'Turn completed',
        metadata: {
          codexEventType: 'turn_completed',
        },
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      type: 'other',
      entry: {
        id: 'turn-end-1',
      },
    })
  })
})
