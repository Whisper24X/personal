import type { TaskMessage } from '@/types/api/tasks'
import type { NormalizedEntry, RecordLike } from '../types'
import {
  asRecord,
  createEntry,
  extractMessageText,
  extractReadablePlainText,
  getBoolean,
  getString,
  makeId,
  resolveTimestamp,
  resolveToolEntryType,
  stringify,
  stringifyContent,
} from '../utils'

function resolveGeminiTimestamp(msg: RecordLike, fallbackTimestamp: number | undefined): number {
  const isoTimestamp = getString(msg.timestamp)
  if (isoTimestamp) {
    const parsed = Date.parse(isoTimestamp)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return resolveTimestamp(msg, fallbackTimestamp)
}

function formatToolName(toolName: string): string {
  return toolName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function parseGeminiToolUse(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry {
  const rawToolName = getString(msg.tool_name) || getString(msg.name) || 'tool'
  const toolName = formatToolName(rawToolName)
  const toolInput = asRecord(msg.parameters) || asRecord(msg.input) || asRecord(msg.args)
  const toolUseId = getString(msg.tool_id) || getString(msg.tool_use_id) || getString(msg.id)

  return createEntry(
    resolveToolEntryType(rawToolName),
    toolInput ? stringify(toolInput) : toolName,
    timestamp,
    `${idBase}-tool-use`,
    {
      toolName,
      toolInput: toolInput ?? undefined,
      toolUseId,
      status: 'running',
    },
  )
}

function parseGeminiToolResult(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry {
  const output =
    stringifyContent(msg.output) ||
    stringifyContent(msg.result) ||
    stringifyContent(msg.content) ||
    ''
  const rawStatus = getString(msg.status)?.toLowerCase()
  const status =
    rawStatus === 'error' || rawStatus === 'failed' || rawStatus === 'failure'
      ? 'failed'
      : 'success'
  const toolUseId = getString(msg.tool_id) || getString(msg.tool_use_id) || getString(msg.id)

  return createEntry('tool_result', output, timestamp, `${idBase}-tool-result`, {
    toolUseId,
    toolOutput: output || undefined,
    status,
  })
}

function tryParseGeminiRecord(line: string): RecordLike | null {
  try {
    const parsed = JSON.parse(line) as unknown
    return asRecord(parsed)
  } catch {
    return null
  }
}

function extractJsonPayload(content: string): unknown | null {
  const trimmed = content.trim()
  if (!trimmed) {
    return null
  }

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fencedMatch?.[1]?.trim() || trimmed

  if (!candidate.startsWith('{') && !candidate.startsWith('[')) {
    return null
  }

  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function parseGeminiStructuredAssistantContent(
  content: string,
  timestamp: number,
  idBase: string,
): NormalizedEntry[] | null {
  const payload = extractJsonPayload(content)
  if (!Array.isArray(payload)) {
    return null
  }

  const assistantParts: string[] = []
  const thinkingParts: string[] = []

  payload.forEach((item) => {
    if (typeof item === 'string' && item.trim()) {
      assistantParts.push(item.trim())
      return
    }

    const record = asRecord(item)
    if (!record) {
      return
    }

    const thought =
      getString(record.thought) ||
      getString(record.reasoning) ||
      extractReadablePlainText(record.thought) ||
      extractReadablePlainText(record.reasoning)
    if (thought) {
      thinkingParts.push(thought)
    }

    const answer =
      getString(record.answer) ||
      getString(record.response) ||
      getString(record.content) ||
      getString(record.text)
    if (answer) {
      assistantParts.push(answer)
    }
  })

  if (assistantParts.length === 0 && thinkingParts.length === 0) {
    return null
  }

  const entries: NormalizedEntry[] = []

  if (assistantParts.length > 0) {
    entries.push(
      createEntry(
        'assistant_message',
        assistantParts.join('\n\n'),
        timestamp,
        `${idBase}-assistant-structured`,
      ),
    )
  }

  if (thinkingParts.length > 0) {
    entries.push(
      createEntry(
        'thinking',
        thinkingParts.join('\n\n'),
        timestamp,
        `${idBase}-thinking-structured`,
      ),
    )
  }

  return entries
}

function parseGeminiAssistantMessage(
  content: string,
  timestamp: number,
  idBase: string,
  options?: { isDelta?: boolean },
): NormalizedEntry | NormalizedEntry[] {
  const structuredEntries = parseGeminiStructuredAssistantContent(
    content,
    timestamp,
    idBase,
  )
  if (structuredEntries) {
    return structuredEntries
  }

  return createEntry('assistant_message', content, timestamp, `${idBase}-assistant`, {
    isDelta: options?.isDelta === true,
  })
}

function parseGeminiLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
): NormalizedEntry | NormalizedEntry[] | null {
  try {
    const msg = tryParseGeminiRecord(line)
    if (!msg) {
      const timestamp = fallbackTimestamp ?? Date.now()
      return createEntry('system_message', line, timestamp, `${idBase}-raw`)
    }

    const timestamp = resolveGeminiTimestamp(msg, fallbackTimestamp)
    const type = getString(msg.type)?.toLowerCase()

    if (type === 'message') {
      const role = getString(msg.role)?.toLowerCase()
      const content = extractMessageText(msg) || ''
      const isDelta = getBoolean(msg.delta)
      if (!content) {
        return null
      }

      if (role === 'assistant' || role === 'model') {
        return parseGeminiAssistantMessage(content, timestamp, idBase, { isDelta })
      }
      if (role === 'user') {
        return createEntry('user_message', content, timestamp, `${idBase}-user`)
      }

      return createEntry('system_message', content, timestamp, `${idBase}-message`)
    }

    if (type === 'tool_use') {
      return parseGeminiToolUse(msg, timestamp, idBase)
    }

    if (type === 'tool_result') {
      return parseGeminiToolResult(msg, timestamp, idBase)
    }

    if (type === 'init') {
      const model = getString(msg.model)
      const sessionId = getString(msg.session_id) || getString(msg.sessionId)
      const parts = [model ? `Model: ${model}` : null, sessionId ? `Session: ${sessionId}` : null].filter(Boolean)
      return createEntry('system_message', parts.join(' | ') || 'Session initialized', timestamp, `${idBase}-init`, {
        isInit: true,
        model,
        sessionId,
      })
    }

    if (type === 'result') {
      const resultStatus = getString(msg.status) || getString(msg.subtype) || 'completed'
      const content = stringifyContent(msg.output) || stringifyContent(msg.result) || resultStatus
      return createEntry('system_message', content, timestamp, `${idBase}-result`, {
        isResult: true,
        resultStatus,
      })
    }

    if (type === 'error') {
      const content =
        stringifyContent(msg.error) ||
        stringifyContent(msg.message) ||
        stringifyContent(msg.content) ||
        'Error'
      return createEntry('error', content, timestamp, `${idBase}-error`)
    }

    const content =
      extractMessageText(msg) ||
      stringifyContent(msg.output) ||
      stringifyContent(msg.result) ||
      getString(msg.message) ||
      getString(msg.content)

    return content
      ? createEntry('system_message', content, timestamp, `${idBase}-system`)
      : null
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, `${idBase}-raw`)
  }
}

export function parseGeminiMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []
  let pendingAssistantDelta:
    | {
        content: string
        timestamp: number
        idBase: string
      }
    | null = null

  const appendParsedEntries = (parsed: NormalizedEntry | NormalizedEntry[]) => {
    const parsedEntries = Array.isArray(parsed) ? parsed : [parsed]
    entries.push(...parsedEntries)
  }

  const flushPendingAssistantDelta = () => {
    if (!pendingAssistantDelta) {
      return
    }

    appendParsedEntries(
      parseGeminiAssistantMessage(
        pendingAssistantDelta.content,
        pendingAssistantDelta.timestamp,
        pendingAssistantDelta.idBase,
      ),
    )
    pendingAssistantDelta = null
  }

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `gemini-${index}`

    if (msg.role === 'error') {
      flushPendingAssistantDelta()
      entries.push(createEntry('error', content, timestamp, `${idBase}-stderr`))
      return
    }

    const record = tryParseGeminiRecord(content)
    if (record) {
      const type = getString(record.type)?.toLowerCase()
      const role = getString(record.role)?.toLowerCase()
      const isDelta = getBoolean(record.delta)
      const deltaContent = extractMessageText(record) || ''

      if (
        type === 'message' &&
        (role === 'assistant' || role === 'model') &&
        isDelta &&
        deltaContent
      ) {
        if (pendingAssistantDelta) {
          pendingAssistantDelta.content += deltaContent
        } else {
          pendingAssistantDelta = {
            content: deltaContent,
            timestamp: resolveGeminiTimestamp(record, timestamp),
            idBase,
          }
        }
        return
      }
    }

    flushPendingAssistantDelta()

    const parsed = parseGeminiLine(content, timestamp, idBase)
    if (parsed) {
      appendParsedEntries(parsed)
      return
    }

    entries.push(createEntry('system_message', content, timestamp, makeId(idBase, 'raw')))
  })

  flushPendingAssistantDelta()

  return entries
}
