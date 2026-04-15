import { describe, expect, it } from 'vitest'
import { buildClaudeTaskGroupItems, groupClaudeEntries, type ClaudeTaskGroup } from './groupEntries'
import type { NormalizedEntry } from '../types'

function createEntry(
  overrides: Partial<NormalizedEntry> & Pick<NormalizedEntry, 'id' | 'type' | 'timestamp' | 'content'>,
): NormalizedEntry {
  return {
    metadata: undefined,
    ...overrides,
  }
}

describe('groupClaudeEntries', () => {
  it('merges leading thinking-only into the assistant task group', () => {
    const groups = groupClaudeEntries([
      createEntry({
        id: 'think-1',
        type: 'thinking',
        timestamp: 1,
        content: 'Need to read the file first.',
      }),
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 2,
        content: 'I will read AGENTS.md.',
      }),
      createEntry({
        id: 'tool-1',
        type: 'file_read',
        timestamp: 3,
        content: '/tmp/AGENTS.md',
        metadata: { toolName: 'Read', toolUseId: 'toolu_1' },
      }),
    ])

    expect(groups).toHaveLength(1)
    const task = groups[0] as ClaudeTaskGroup
    expect(task.type).toBe('task')
    expect(task.description).toBe('I will read AGENTS.md.')
    expect(task.tools).toHaveLength(2)
    expect(task.tools[0]?.type).toBe('thinking')
    expect(task.tools[0]?.content).toBe('Need to read the file first.')
    expect(task.tools[1]?.type).toBe('file_read')
  })

  it('does not merge when current group mixes thinking with tools before assistant', () => {
    const groups = groupClaudeEntries([
      createEntry({
        id: 'think-1',
        type: 'thinking',
        timestamp: 1,
        content: 'Plan',
      }),
      createEntry({
        id: 'tool-1',
        type: 'file_read',
        timestamp: 2,
        content: '/x',
        metadata: { toolName: 'Read' },
      }),
      createEntry({
        id: 'assistant-1',
        type: 'assistant_message',
        timestamp: 3,
        content: 'Done reading.',
      }),
    ])

    expect(groups).toHaveLength(2)
    const first = groups[0] as ClaudeTaskGroup
    const second = groups[1] as ClaudeTaskGroup
    expect(first.tools.some((e) => e.type === 'thinking')).toBe(true)
    expect(first.tools.some((e) => e.type === 'file_read')).toBe(true)
    expect(second.description).toBe('Done reading.')
    expect(second.tools).toHaveLength(0)
  })
})

describe('buildClaudeTaskGroupItems', () => {
  it('matches tool results by toolUseId instead of adjacency', () => {
    const group: ClaudeTaskGroup = {
      type: 'task',
      title: 'Inspect files',
      description: 'Inspect files',
      tools: [
        createEntry({
          id: 'tool-1',
          type: 'file_read',
          timestamp: 1,
          content: '/tmp/AGENTS.md',
          metadata: {
            toolUseId: 'toolu_1',
            toolName: 'Read',
          },
        }),
        createEntry({
          id: 'thinking-1',
          type: 'thinking',
          timestamp: 2,
          content: 'Need more context',
        }),
        createEntry({
          id: 'result-1',
          type: 'tool_result',
          timestamp: 3,
          content: '# AGENTS',
          metadata: {
            toolUseId: 'toolu_1',
            status: 'success',
          },
        }),
      ],
    }

    const items = buildClaudeTaskGroupItems(group)

    expect(items).toHaveLength(2)
    expect(items[0]?.kind).toBe('tool')
    expect(items[1]?.kind).toBe('thinking')
    if (items[0]?.kind !== 'tool') {
      throw new Error('Expected first item to be a tool')
    }
    expect(items[0].result?.id).toBe('result-1')
  })

  it('keeps grouped system messages visible inside claude task cards', () => {
    const group: ClaudeTaskGroup = {
      type: 'task',
      title: 'Inspect files',
      description: 'Inspect files',
      tools: [
        createEntry({
          id: 'tool-1',
          type: 'command_run',
          timestamp: 1,
          content: '$ ls -la',
        }),
        createEntry({
          id: 'system-1',
          type: 'system_message',
          timestamp: 2,
          content: 'Permission mode switched to default',
        }),
      ],
    }

    const items = buildClaudeTaskGroupItems(group)

    expect(items.some((item) => item.kind === 'system')).toBe(true)
  })
})
