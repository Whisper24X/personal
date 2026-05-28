import { describe, expect, it } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCursorAgentMessages } from './parser'

function createTaskMessage(content: string): TaskMessage {
  return {
    role: 'system',
    content,
    createdAt: '2026-03-19T02:00:00.000Z',
  }
}

describe('parseCursorAgentMessages', () => {
  it('parses AINative injected prompt as user message', () => {
    const line = JSON.stringify({
      type: 'user_message',
      message: '使用 brainstorm 技能，生成需求澄清文档。',
      source: 'ainative_injected_prompt',
      created_at: '2026-03-19T02:00:00.000Z',
    })
    const entries = parseCursorAgentMessages([createTaskMessage(line)])

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      type: 'user_message',
      content: '使用 brainstorm 技能，生成需求澄清文档。',
    })
  })

  it('deduplicates AINative injected prompt when Cursor emits the same user message', () => {
    const prompt = '使用 brainstorm 技能，生成需求澄清文档。'
    const injected = JSON.stringify({
      type: 'user_message',
      message: prompt,
      source: 'ainative_injected_prompt',
      created_at: '2026-03-19T02:00:00.000Z',
    })
    const nativeUser = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    })
    const entries = parseCursorAgentMessages([
      createTaskMessage(injected),
      createTaskMessage(nativeUser),
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      type: 'user_message',
      content: prompt,
    })
  })

  it('extracts thinking from message.content parts with thinking field', () => {
    const line = JSON.stringify({
      type: 'thinking',
      subtype: 'delta',
      message: {
        content: [{ type: 'thinking', thinking: 'Read AGENTS.md first.' }],
      },
    })
    const entries = parseCursorAgentMessages([createTaskMessage(line)])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      type: 'thinking',
      content: 'Read AGENTS.md first.',
    })
  })

  it('unwraps JSON string in text into readable plain text', () => {
    const line = JSON.stringify({
      type: 'thinking',
      subtype: 'delta',
      text: '{"text":"Plan the refactor.","meta":{"x":1}}',
    })
    const entries = parseCursorAgentMessages([createTaskMessage(line)])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      type: 'thinking',
      content: 'Plan the refactor.',
    })
  })

  it('merges consecutive thinking deltas', () => {
    const entries = parseCursorAgentMessages([
      createTaskMessage(
        JSON.stringify({ type: 'thinking', subtype: 'delta', text: 'a' }),
      ),
      createTaskMessage(
        JSON.stringify({ type: 'thinking', subtype: 'delta', text: 'b' }),
      ),
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.type).toBe('thinking')
    expect(entries[0]?.content).toBe('ab')
  })

  it('does not emit raw JSON for empty thinking delta or completed thinking', () => {
    const emptyDelta = JSON.stringify({
      type: 'thinking',
      subtype: 'delta',
      text: '',
      session_id: 'd08b9752-6f7b-4f6d-9fb3-fd4b4c2d9a2f',
      timestamp_ms: 1774254971448,
    })
    const completed = JSON.stringify({
      type: 'thinking',
      subtype: 'completed',
      session_id: 'd08b9752-6f7b-4f6d-9fb3-fd4b4c2d9a2f',
      timestamp_ms: 1774254971619,
    })
    const entries = parseCursorAgentMessages([
      createTaskMessage(emptyDelta),
      createTaskMessage(completed),
    ])
    expect(entries).toHaveLength(0)
    expect(entries.some((e) => e.content.includes('"type":"thinking"'))).toBe(false)
  })

  it('ignores whitespace-only assistant lines without surfacing JSON', () => {
    const assistant = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: '\n\n\n' }] },
      session_id: 'd08b9752-6f7b-4f6d-9fb3-fd4b4c2d9a2f',
      model_call_id: '994ccbef-0999-4733-8aea-e84581a6c4c4-0-zdri',
      timestamp_ms: 1774254971862,
    })
    const entries = parseCursorAgentMessages([createTaskMessage(assistant)])
    expect(entries).toHaveLength(0)
  })
})
