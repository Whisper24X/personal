import { describe, expect, it } from 'vitest'
import { buildClaudeTaskGroupItems, type ClaudeTaskGroup } from './groupEntries'
import type { NormalizedEntry } from '../types'

function createEntry(
  overrides: Partial<NormalizedEntry> & Pick<NormalizedEntry, 'id' | 'type' | 'timestamp' | 'content'>,
): NormalizedEntry {
  return {
    metadata: undefined,
    ...overrides,
  }
}

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
