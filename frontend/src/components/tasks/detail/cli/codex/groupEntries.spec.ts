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
})
