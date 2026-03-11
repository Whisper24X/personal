import type { NormalizedEntry, RecordLike } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import {
  asRecord,
  createEntry,
  getBoolean,
  getString,
  resolveTimestamp,
  resolveToolEntryType,
  stringify,
  toSnakeCase,
} from '../utils'

function extractContent(msg: RecordLike | undefined): string | null {
  if (!msg) return null
  const direct = getString(msg.content) || getString(msg.text) || getString(msg.message)
  if (direct) return direct
  const message = asRecord(msg.message)
  if (message) {
    const content = message.content
    if (Array.isArray(content)) {
      const text = content
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const record = item as RecordLike
            return getString(record.text) || getString(record.content) || ''
          }
          return ''
        })
        .join('')
      return text.trim() ? text : null
    }
    const nested = getString(message.content) || getString(message.text)
    if (nested) return nested
  }
  return null
}

function parseOpencodeLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
): NormalizedEntry | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = resolveTimestamp(msg, fallbackTimestamp)
    const rawType = getString(msg.type) || getString(msg.event)
    const type = rawType?.toLowerCase()

    if (type === 'assistant' || type === 'assistant_message') {
      const content = extractContent(msg)
      return content ? createEntry('assistant_message', content, timestamp, `${idBase}-assistant`) : null
    }

    if (type === 'user' || type === 'user_message') {
      const content = extractContent(msg)
      return content ? createEntry('user_message', content, timestamp, `${idBase}-user`) : null
    }

    if (type === 'tool_use' || type === 'tool_call' || type === 'tool') {
      const toolName = getString(msg.tool) || getString(msg.name) || getString(msg.tool_name) || 'tool'
      const toolInput = asRecord(msg.input) || asRecord(msg.args)
      const toolUseId = getString(msg.tool_use_id) || getString(msg.call_id) || getString(msg.id)
      const entryType = resolveToolEntryType(toolName)
      return createEntry(entryType, toolInput ? stringify(toolInput) : toolName, timestamp, `${idBase}-tool-use`, {
        toolName: toSnakeCase(toolName),
        toolInput: toolInput ?? undefined,
        toolUseId,
        status: 'running',
      })
    }

    if (type === 'tool_result' || type === 'tool_output') {
      const output = extractContent(msg) || stringify(msg.result)
      const toolUseId = getString(msg.tool_use_id) || getString(msg.call_id) || getString(msg.id)
      return createEntry('tool_result', output, timestamp, `${idBase}-tool-result`, {
        toolUseId,
        status: getBoolean(msg.is_error) ? 'failed' : 'success',
      })
    }

    if (type === 'error') {
      const content = extractContent(msg) || rawType || 'Error'
      return createEntry('error', content, timestamp, `${idBase}-error`)
    }

    if (type === 'sdk_event') {
      const event = asRecord(msg.event)
      if (event) {
        const eventType = getString(event.type) || getString(event.name)
        const eventContent = extractContent(event) || eventType || 'Event'
        if (eventType?.toLowerCase().includes('error')) {
          return createEntry('error', eventContent, timestamp, `${idBase}-error`)
        }
        return createEntry('system_message', eventContent, timestamp, `${idBase}-system`)
      }
    }

    const content = extractContent(msg)
    return content ? createEntry('system_message', content, timestamp, `${idBase}-system`) : null
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, `${idBase}-raw`)
  }
}

export function parseOpencodeMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `opencode-${index}`

    if (msg.role === 'error') {
      entries.push(createEntry('error', content, timestamp, `${idBase}-stderr`))
      return
    }

    const parsed = parseOpencodeLine(content, timestamp, idBase)
    if (parsed) {
      entries.push(parsed)
      return
    }

    entries.push(createEntry('system_message', content, timestamp, `${idBase}-raw`))
  })

  return entries
}
