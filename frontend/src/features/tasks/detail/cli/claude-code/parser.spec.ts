import { describe, expect, it } from 'vitest'
import type { TaskMessage } from '@/types/api/tasks'
import { parseClaudeCodeMessages } from './parser'

function createMessage(content: Record<string, unknown>, createdAt = '2026-03-12T03:00:00.000Z'): TaskMessage {
  return {
    role: 'system',
    content: JSON.stringify(content),
    createdAt,
  }
}

describe('parseClaudeCodeMessages', () => {
  it('parses thinking, init metadata, tool results, and final result stats', () => {
    const messages: TaskMessage[] = [
      createMessage({
        type: 'system',
        subtype: 'init',
        model: 'claude-sonnet-4-6',
        permissionMode: 'default',
        cwd: '/tmp/worktree/demo-project',
        claude_code_version: '2.1.72',
        session_id: 'session-1',
        mcp_servers: [
          { name: 'dbhub', status: 'connected' },
          { name: 'pencil', status: 'failed' },
        ],
      }),
      createMessage({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: 'I will inspect the repo.',
            },
            {
              type: 'thinking',
              thinking: 'Need to inspect AGENTS.md first.',
              signature: 'sig-1',
            },
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'Read',
              input: {
                file_path: '/tmp/worktree/demo-project/AGENTS.md',
              },
            },
          ],
        },
      }),
      createMessage({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              is_error: false,
              content: '     1→# Demo Project',
            },
          ],
        },
        tool_use_result: {
          type: 'text',
          file: {
            filePath: '/tmp/worktree/demo-project/AGENTS.md',
            content: '# Demo Project',
            numLines: 10,
            startLine: 1,
            totalLines: 10,
          },
        },
      }),
      createMessage({
        type: 'result',
        subtype: 'success',
        duration_ms: 172985,
        total_cost_usd: 0.1521057,
        num_turns: 6,
        stop_reason: 'end_turn',
        session_id: 'session-1',
        result: 'Done',
        usage: {
          input_tokens: 262,
          cache_read_input_tokens: 99749,
          cache_creation_input_tokens: 29660,
          output_tokens: 678,
        },
      }),
    ]

    const entries = parseClaudeCodeMessages(messages)

    expect(entries.find((entry) => entry.type === 'thinking')?.content).toContain('inspect AGENTS.md')

    const initEntry = entries.find((entry) => entry.metadata?.isInit === true)
    expect(initEntry?.content).toContain('Model: claude-sonnet-4-6')
    expect(initEntry?.content).toContain('Permissions: default')
    expect(initEntry?.content).toContain('MCP: 1/2 connected')
    expect(initEntry?.metadata?.cwdName).toBe('demo-project')

    const toolEntry = entries.find((entry) => entry.type === 'file_read')
    expect(toolEntry?.metadata?.toolUseId).toBe('toolu_1')

    const toolResultEntry = entries.find((entry) => entry.type === 'tool_result')
    expect(toolResultEntry?.metadata?.toolUseId).toBe('toolu_1')
    expect(toolResultEntry?.metadata?.fileName).toBe('AGENTS.md')
    expect(toolResultEntry?.metadata?.fileNumLines).toBe(10)

    const resultEntry = entries.find((entry) => entry.metadata?.isResult === true)
    expect(resultEntry?.metadata?.numTurns).toBe(6)
    expect(resultEntry?.metadata?.stopReason).toBe('end_turn')
    expect(resultEntry?.metadata?.inputTokens).toBe(262)
    expect(resultEntry?.metadata?.cacheReadTokens).toBe(99749)
    expect(resultEntry?.metadata?.outputTokens).toBe(678)
  })

  it('preserves tool failure status and stderr-like text from user tool results', () => {
    const messages: TaskMessage[] = [
      createMessage({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_2',
              name: 'Read',
              input: {
                file_path: '/tmp/worktree/demo-project/package.json',
              },
            },
          ],
        },
      }),
      createMessage({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_2',
              is_error: true,
              content: 'File does not exist.',
            },
          ],
        },
        tool_use_result: 'Error: File does not exist.',
      }),
    ]

    const entries = parseClaudeCodeMessages(messages)
    const toolResultEntry = entries.find((entry) => entry.type === 'tool_result')

    expect(toolResultEntry?.metadata?.status).toBe('failed')
    expect(toolResultEntry?.content).toContain('File does not exist')
  })
})
