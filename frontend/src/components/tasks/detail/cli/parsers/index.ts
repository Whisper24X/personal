import type { NormalizedEntry } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCursorAgentMessages } from './cursor-agent'
import { parseClaudeCodeMessages } from './claude-code'
import { parseCodexMessages } from './codex'
import { parseGeminiMessages } from './gemini'
import { parseOpencodeMessages } from './opencode'
import { parseFallbackMessages } from './fallback'

export function parseMessages(agentCliId: string, messages: TaskMessage[]): NormalizedEntry[] {
  switch (agentCliId) {
    case 'cursor-agent':
    case 'cursor':
      return parseCursorAgentMessages(messages)
    case 'claude-code':
      return parseClaudeCodeMessages(messages)
    case 'codex':
      return parseCodexMessages(messages)
    case 'gemini-cli':
      return parseGeminiMessages(messages)
    case 'opencode':
      return parseOpencodeMessages(messages)
    default:
      return parseFallbackMessages(messages)
  }
}
