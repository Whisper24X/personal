import { describe, expect, it } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import { parseOpencodeMessages } from './parser'

function createMessage(content: Record<string, unknown>, createdAt = '2026-03-12T10:23:24.583Z'): TaskMessage {
  return {
    role: 'system',
    content: JSON.stringify(content),
    createdAt,
  }
}

describe('parseOpencodeMessages', () => {
  it('parses step, tool, result, and final text events from opencode logs', () => {
    const messages: TaskMessage[] = [
      createMessage({
        type: 'step_start',
        timestamp: 1773311004583,
        part: {
          snapshot: 'snap-1',
        },
      }),
      createMessage({
        type: 'tool_use',
        timestamp: 1773311012599,
        part: {
          callID: 'call-read-1',
          tool: 'read',
          state: {
            status: 'error',
            input: {
              filePath: '/tmp/demo/README.md',
              offset: 1,
            },
            error: 'Error: File not found: /tmp/demo/README.md',
          },
        },
      }),
      createMessage({
        type: 'step_finish',
        timestamp: 1773311012789,
        part: {
          reason: 'tool-calls',
          tokens: {
            total: 12637,
            output: 381,
          },
        },
      }),
      createMessage({
        type: 'tool_use',
        timestamp: 1773311025274,
        part: {
          callID: 'call-read-2',
          tool: 'read',
          state: {
            status: 'completed',
            input: {
              filePath: '/tmp/demo/AGENTS.md',
            },
            output: '<content># AINative Workspace</content>',
            metadata: {
              preview: '# AINative Workspace\n\nMonorepo 全栈应用。',
            },
          },
        },
      }),
      createMessage({
        type: 'text',
        timestamp: 1773311047457,
        part: {
          text: '这个项目的主名称是 AINative Workspace。',
        },
      }),
    ]

    const entries = parseOpencodeMessages(messages)

    expect(entries[0]).toMatchObject({
      type: 'system_message',
      metadata: {
        opencodeEventType: 'step_start',
      },
    })

    expect(entries[1]).toMatchObject({
      type: 'file_read',
      content: '/tmp/demo/README.md',
      metadata: {
        toolUseId: 'call-read-1',
        toolName: 'Read',
        status: 'failed',
      },
    })

    expect(entries[2]).toMatchObject({
      type: 'tool_result',
      content: 'Error: File not found: /tmp/demo/README.md',
      metadata: {
        toolUseId: 'call-read-1',
        status: 'failed',
      },
    })

    expect(entries[3]).toMatchObject({
      type: 'system_message',
      metadata: {
        opencodeEventType: 'step_finish',
        stepReason: 'tool-calls',
        totalTokens: 12637,
      },
    })

    expect(entries[4]).toMatchObject({
      type: 'file_read',
      metadata: {
        toolUseId: 'call-read-2',
        status: 'success',
      },
    })

    expect(entries[5]).toMatchObject({
      type: 'tool_result',
      metadata: {
        toolUseId: 'call-read-2',
        status: 'success',
      },
    })
    expect(entries[5]?.content).toContain('AINative Workspace')
    expect(entries[5]?.metadata?.toolOutput).toContain('<content># AINative Workspace</content>')

    expect(entries[6]).toMatchObject({
      type: 'assistant_message',
      content: '这个项目的主名称是 AINative Workspace。',
    })
  })
})
