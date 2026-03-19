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
})
