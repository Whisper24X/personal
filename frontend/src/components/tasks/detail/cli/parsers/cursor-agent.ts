import type { NormalizedEntry, RecordLike } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import {
  asRecord,
  createEntry,
  extractMessageText,
  formatToolInput,
  getBoolean,
  getString,
  resolveTimestamp,
  resolveToolEntryType,
  toSnakeCase,
  stringify,
} from '../utils'

function parseCursorToolCall(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry | null {
  const subtype = getString(msg.subtype)?.toLowerCase()
  const toolCall = asRecord(msg.tool_call) || asRecord(msg.toolCall)
  let toolName = 'tool'
  let toolInput: RecordLike | null = null
  let toolOutput: string | null = null
  let toolUseId = getString(msg.call_id)
  let isError = getBoolean(msg.is_error)

  if (toolCall) {
    const entries = Object.entries(toolCall)
    if (entries.length > 0) {
      const [key, value] = entries[0]
      toolName = toSnakeCase(key) || key
      const toolData = asRecord(value)
      if (toolData) {
        toolInput = asRecord(toolData.args) || asRecord(toolData.input)
        if (!toolUseId) {
          toolUseId = getString((toolInput as RecordLike | null)?.toolCallId)
        }
        const result = toolData.result ?? toolData.output
        if (result !== undefined) {
          toolOutput = stringify(result)
          if (!isError && asRecord(result)?.error) {
            isError = true
          }
        }
      }
    }
  }

  const entryType = resolveToolEntryType(toolName)

  if (subtype === 'completed') {
    const content = toolOutput ?? ''
    return createEntry('tool_result', content, timestamp, `${idBase}-tool-result`, {
      toolUseId,
      toolName,
      toolOutput: content,
      status: isError ? 'failed' : 'success',
    })
  }

  return createEntry(entryType, formatToolInput(toolName, toolInput), timestamp, `${idBase}-tool-use`, {
    toolName,
    toolInput: toolInput ?? undefined,
    toolUseId,
    status: subtype === 'started' ? 'running' : 'pending',
  })
}

function parseCursorAgentLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
): NormalizedEntry | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = resolveTimestamp(msg, fallbackTimestamp)
    const type = getString(msg.type)?.toLowerCase()

    if (type === 'assistant') {
      const content = extractMessageText(msg)
      return content ? createEntry('assistant_message', content, timestamp, `${idBase}-assistant`) : null
    }

    if (type === 'user') {
      const content = extractMessageText(msg)
      return content ? createEntry('user_message', content, timestamp, `${idBase}-user`) : null
    }

    if (type === 'system') {
      const subtype = getString(msg.subtype)
      if (subtype === 'init') {
        const model = getString(msg.model) || 'unknown'
        return createEntry('system_message', `System initialized with model: ${model}`, timestamp, `${idBase}-system`)
      }
      const content = getString(msg.content) || (subtype ? `System: ${subtype}` : '')
      return content ? createEntry('system_message', content, timestamp, `${idBase}-system`) : null
    }

    if (type === 'tool_call') {
      return parseCursorToolCall(msg, timestamp, idBase)
    }

    if (type === 'result') {
      const resultText = getString(msg.result)
      if (resultText) {
        return createEntry('assistant_message', resultText, timestamp, `${idBase}-result`, { isResult: true })
      }
      return createEntry('system_message', 'Completed', timestamp, `${idBase}-result`, { isResult: true })
    }

    if (type === 'error' || getBoolean(msg.is_error)) {
      const content = getString(msg.error) || getString(msg.message) || 'Error'
      return createEntry('error', content, timestamp, `${idBase}-error`)
    }

    const fallback = extractMessageText(msg) || getString(msg.content) || getString(msg.message)
    if (fallback) {
      return createEntry('system_message', fallback, timestamp, `${idBase}-system`)
    }
    return null
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, `${idBase}-raw`)
  }
}

export function parseCursorAgentMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `cursor-${index}`

    if (msg.role === 'error') {
      entries.push(createEntry('error', content, timestamp, `${idBase}-stderr`))
      return
    }

    const parsed = parseCursorAgentLine(content, timestamp, idBase)
    if (parsed) {
      entries.push(parsed)
      return
    }

    entries.push(createEntry('system_message', content, timestamp, `${idBase}-raw`))
  })

  const hasNonResultAssistant = entries.some(
    (e) => e.type === 'assistant_message' && !e.metadata?.isResult,
  )
  if (!hasNonResultAssistant) return entries
  return entries.filter((e) => !e.metadata?.isResult)
}
