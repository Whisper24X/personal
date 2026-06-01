import { describe, expect, it } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import { parseGeminiMessages } from './parser'

function createMessage(content: Record<string, unknown>, createdAt = '2026-03-12T08:46:43.144Z'): TaskMessage {
  return {
    role: 'system',
    content: JSON.stringify(content),
    createdAt,
  }
}

describe('parseGeminiMessages', () => {
  it('parses tool events and preserves tool ids', () => {
    const messages: TaskMessage[] = [
      createMessage({
        type: 'message',
        timestamp: '2026-03-12T08:46:43.144Z',
        role: 'user',
        content: 'Analyze the project name',
      }),
      createMessage({
        type: 'tool_use',
        timestamp: '2026-03-12T08:46:50.763Z',
        tool_name: 'read_file',
        tool_id: 'read_file_1',
        parameters: {
          file_path: 'opencode.json',
        },
      }),
      createMessage({
        type: 'tool_result',
        timestamp: '2026-03-12T08:46:50.849Z',
        tool_id: 'read_file_1',
        status: 'success',
        output: '',
      }),
      createMessage({
        type: 'tool_use',
        timestamp: '2026-03-12T08:47:30.745Z',
        tool_name: 'generalist',
        tool_id: 'generalist_1',
        parameters: {
          request: 'Summarize the repo.',
        },
      }),
      createMessage({
        type: 'tool_result',
        timestamp: '2026-03-12T08:47:48.095Z',
        tool_id: 'generalist_1',
        status: 'success',
        output: 'Result: summary',
      }),
    ]

    const entries = parseGeminiMessages(messages)

    expect(entries[0]).toMatchObject({
      type: 'user_message',
      content: 'Analyze the project name',
    })

    expect(entries[1]).toMatchObject({
      type: 'file_read',
      metadata: {
        toolName: 'Read File',
        toolUseId: 'read_file_1',
        status: 'running',
      },
    })

    expect(entries[2]).toMatchObject({
      type: 'tool_result',
      metadata: {
        toolUseId: 'read_file_1',
        status: 'success',
      },
    })

    expect(entries[3]).toMatchObject({
      type: 'tool_use',
      metadata: {
        toolName: 'Generalist',
        toolUseId: 'generalist_1',
      },
    })

    expect(entries[4]).toMatchObject({
      type: 'tool_result',
      content: 'Result: summary',
      metadata: {
        toolUseId: 'generalist_1',
        status: 'success',
      },
    })
  })

  it('uses json timestamp strings from gemini events', () => {
    const entries = parseGeminiMessages([
      createMessage({
        type: 'tool_use',
        timestamp: '2026-03-12T08:46:50.763Z',
        tool_name: 'read_file',
        tool_id: 'read_file_1',
        parameters: {
          file_path: 'opencode.json',
        },
      }),
    ])

    expect(entries[0]?.timestamp).toBe(new Date('2026-03-12T08:46:50.763Z').getTime())
  })

  it('merges consecutive assistant delta chunks into one message', () => {
    const entries = parseGeminiMessages([
      createMessage({
        type: 'message',
        timestamp: '2026-03-12T09:21:29.457Z',
        role: 'assistant',
        content: 'The project is named ',
        delta: true,
      }),
      createMessage({
        type: 'message',
        timestamp: '2026-03-12T09:21:30.070Z',
        role: 'assistant',
        content: '**葱搭 Workspace**',
        delta: true,
      }),
      createMessage({
        type: 'message',
        timestamp: '2026-03-12T09:21:30.430Z',
        role: 'assistant',
        content: '.',
        delta: true,
      }),
      createMessage({
        type: 'result',
        timestamp: '2026-03-12T09:21:31.369Z',
        status: 'success',
      }),
    ])

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      type: 'assistant_message',
      content: 'The project is named **葱搭 Workspace**.',
    })
    expect(entries[1]).toMatchObject({
      type: 'system_message',
      metadata: {
        isResult: true,
        resultStatus: 'success',
      },
    })
  })

  it('unpacks structured assistant json content into answer and thinking entries', () => {
    const entries = parseGeminiMessages([
      createMessage({
        type: 'message',
        timestamp: '2026-03-12T09:21:30.430Z',
        role: 'assistant',
        content: [
          '```json',
          '[',
          '  {"thought":"Inspect openspec/project.md first."},',
          '  "The project is named **葱搭 Workspace**."',
          ']',
          '```',
        ].join('\n'),
      }),
    ])

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      type: 'assistant_message',
      content: 'The project is named **葱搭 Workspace**.',
    })
    expect(entries[1]).toMatchObject({
      type: 'thinking',
      content: 'Inspect openspec/project.md first.',
    })
  })

  it('unpacks structured assistant json after delta chunks are merged', () => {
    const entries = parseGeminiMessages([
      createMessage({
        type: 'message',
        timestamp: '2026-03-12T09:21:29.457Z',
        role: 'assistant',
        content: '```json\n[\n  {"thought": "Inspect openspec/project.md first.',
        delta: true,
      }),
      createMessage({
        type: 'message',
        timestamp: '2026-03-12T09:21:30.430Z',
        role: 'assistant',
        content: '"},\n  "The project is named **葱搭 Workspace**."\n]\n```',
        delta: true,
      }),
      createMessage({
        type: 'result',
        timestamp: '2026-03-12T09:21:31.369Z',
        status: 'success',
      }),
    ])

    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({
      type: 'assistant_message',
      content: 'The project is named **葱搭 Workspace**.',
    })
    expect(entries[1]).toMatchObject({
      type: 'thinking',
      content: 'Inspect openspec/project.md first.',
    })
    expect(entries[2]).toMatchObject({
      type: 'system_message',
      metadata: {
        isResult: true,
      },
    })
  })
})
