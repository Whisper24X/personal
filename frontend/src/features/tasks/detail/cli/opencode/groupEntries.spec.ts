import { describe, expect, it } from 'vitest'
import {
  buildOpencodeTaskGroupItems,
  groupOpencodeEntries,
  type OpencodeTaskGroup,
} from './groupEntries'
import type { NormalizedEntry } from '../types'

function createEntry(
  overrides: Partial<NormalizedEntry> & Pick<NormalizedEntry, 'id' | 'type' | 'timestamp' | 'content'>,
): NormalizedEntry {
  return {
    metadata: undefined,
    ...overrides,
  }
}

describe('groupOpencodeEntries', () => {
  it('groups step-based tool activity into separate task cards', () => {
    const groups = groupOpencodeEntries([
      createEntry({
        id: 'step-start-1',
        type: 'system_message',
        timestamp: 1,
        content: 'Step started',
        metadata: {
          opencodeEventType: 'step_start',
        },
      }),
      createEntry({
        id: 'tool-1',
        type: 'file_read',
        timestamp: 2,
        content: '/tmp/demo/README.md',
        metadata: {
          toolUseId: 'call-1',
          status: 'failed',
        },
      }),
      createEntry({
        id: 'result-1',
        type: 'tool_result',
        timestamp: 3,
        content: 'Error: File not found',
        metadata: {
          toolUseId: 'call-1',
          status: 'failed',
        },
      }),
      createEntry({
        id: 'step-finish-1',
        type: 'system_message',
        timestamp: 4,
        content: '工具调用完成 · 12,637 tokens',
        metadata: {
          opencodeEventType: 'step_finish',
        },
      }),
      createEntry({
        id: 'answer-1',
        type: 'assistant_message',
        timestamp: 5,
        content: '最终结论',
      }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      type: 'task',
      status: 'failed',
      summary: '工具调用完成 · 12,637 tokens · 1 个操作 · 1 个结果 · 1 个失败',
    })
    expect(groups[1]).toMatchObject({
      type: 'other',
      entry: {
        type: 'assistant_message',
        content: '最终结论',
      },
    })
  })
})

describe('buildOpencodeTaskGroupItems', () => {
  it('matches tool results by toolUseId instead of adjacency', () => {
    const group: OpencodeTaskGroup = {
      type: 'task',
      title: '步骤 1',
      description: '',
      status: 'success',
      summary: '1 个操作 · 1 个结果',
      stepIndex: 1,
      tools: [
        createEntry({
          id: 'tool-1',
          type: 'file_read',
          timestamp: 1,
          content: '/tmp/demo/AGENTS.md',
          metadata: {
            toolUseId: 'call-1',
            toolName: 'Read',
          },
        }),
        createEntry({
          id: 'system-1',
          type: 'system_message',
          timestamp: 2,
          content: '工具调用完成 · 12,637 tokens',
        }),
        createEntry({
          id: 'result-1',
          type: 'tool_result',
          timestamp: 3,
          content: '# AINative Workspace',
          metadata: {
            toolUseId: 'call-1',
            status: 'success',
          },
        }),
      ],
    }

    const items = buildOpencodeTaskGroupItems(group)

    expect(items).toHaveLength(2)
    expect(items[0]?.kind).toBe('tool')
    expect(items[1]?.kind).toBe('system')
    if (items[0]?.kind !== 'tool') {
      throw new Error('Expected first item to be a tool')
    }
    expect(items[0].result?.id).toBe('result-1')
  })
})
