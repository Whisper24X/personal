import type { NormalizedEntry, NormalizedEntryType, RecordLike } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import {
  asRecord,
  createEntry,
  extractReadablePlainText,
  getBoolean,
  getNumber,
  getString,
  resolveTimestamp,
  stringify,
} from '../utils'

/**
 * Cursor Agent output.jsonl type+subtype matrix:
 *
 *   type=system    subtype=init         → system init (model, cwd, permissions)
 *   type=user      (no subtype)         → user message (message.content[])
 *   type=thinking  subtype=delta        → incremental thinking text
 *   type=thinking  subtype=completed    → thinking block end (skip)
 *   type=assistant (no subtype)         → assistant message (message.content[])
 *   type=tool_call subtype=started      → tool invocation started
 *   type=tool_call subtype=completed    → tool invocation finished (with result)
 *   type=result    subtype=success/error → final result with duration + usage
 *   type=error     (no subtype)         → error
 */

const TOOL_KEY_DISPLAY_NAME: Record<string, string> = {
  readToolCall: 'Read',
  globToolCall: 'Glob',
  grepToolCall: 'Grep',
  writeToolCall: 'Write',
  editToolCall: 'Edit',
  listToolCall: 'List',
  terminalToolCall: 'Terminal',
  codebaseSearchToolCall: 'Search',
  fileSearchToolCall: 'FileSearch',
}

function resolveToolFromKey(key: string): { displayName: string; entryType: NormalizedEntryType } {
  const display = TOOL_KEY_DISPLAY_NAME[key]
  if (display) {
    const lower = display.toLowerCase()
    if (lower === 'terminal') return { displayName: display, entryType: 'command_run' }
    if (lower === 'read' || lower === 'glob' || lower === 'grep' || lower === 'list' || lower === 'search' || lower === 'filesearch') {
      return { displayName: display, entryType: 'file_read' }
    }
    if (lower === 'write' || lower === 'edit') return { displayName: display, entryType: 'file_edit' }
    return { displayName: display, entryType: 'tool_use' }
  }
  const cleaned = key.replace(/ToolCall$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2')
  return { displayName: cleaned || key, entryType: 'tool_use' }
}

function extractToolCallContent(toolData: RecordLike, displayName: string): string {
  const args = asRecord(toolData.args) || asRecord(toolData.input)
  if (!args) return displayName

  const path = getString(args.path) || getString(args.filePath) || getString(args.file_path) || getString(args.targetDirectory)
  const command = getString(args.command)
  const pattern = getString(args.pattern) || getString(args.globPattern) || getString(args.query)

  if (command) return `$ ${command}`
  if (path && pattern) return `${path} → ${pattern}`
  if (path) return path
  if (pattern) return pattern

  return stringify(args)
}

function extractToolResultContent(toolData: RecordLike): string {
  const result = toolData.result ?? toolData.output
  if (result === undefined) return ''

  const resultRecord = asRecord(result)
  if (!resultRecord) return stringify(result)

  const success = asRecord(resultRecord.success)
  if (success) {
    const content = getString(success.content)
    if (content) {
      const totalLines = getNumber(success.totalLines)
      return totalLines ? `${totalLines} lines` : content.length > 200 ? `${content.slice(0, 200)}...` : content
    }
    const files = success.files
    if (Array.isArray(files)) return `${files.length} file${files.length === 1 ? '' : 's'} found`

    const matches = success.matches
    if (Array.isArray(matches)) return `${matches.length} match${matches.length === 1 ? '' : 'es'}`

    const output = success.output as RecordLike | undefined
    if (output) {
      const outputRecord = asRecord(output)
      if (outputRecord) {
        const matchResults = outputRecord.matches
        if (Array.isArray(matchResults)) return `${matchResults.length} match${matchResults.length === 1 ? '' : 'es'}`
        const totalLines = getNumber(outputRecord.totalLines)
        if (totalLines) return `${totalLines} total lines`
      }
    }

    return stringify(success)
  }

  const error = asRecord(resultRecord.error)
  if (error) return `Error: ${getString(error.message) || stringify(error)}`

  return stringify(resultRecord)
}

function parseToolCall(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry | null {
  const subtype = getString(msg.subtype)?.toLowerCase()
  const toolCallObj = asRecord(msg.tool_call)
  const callId = getString(msg.call_id)

  if (!toolCallObj) return null

  const toolEntries = Object.entries(toolCallObj)
  const firstEntry = toolEntries[0]
  if (!firstEntry) return null

  const [toolKey, toolValue] = firstEntry
  const toolData = asRecord(toolValue)
  if (!toolData) return null

  const { displayName, entryType } = resolveToolFromKey(toolKey)
  const args = asRecord(toolData.args) || asRecord(toolData.input)

  if (subtype === 'completed') {
    const content = extractToolResultContent(toolData)
    const result = toolData.result ?? toolData.output
    const resultRecord = asRecord(result)
    const hasError = getBoolean(msg.is_error) || Boolean(resultRecord && asRecord(resultRecord.error))

    return createEntry('tool_result', content, timestamp, `${idBase}-result`, {
      toolUseId: callId,
      toolName: displayName,
      toolOutput: content,
      status: hasError ? 'failed' : 'success',
    })
  }

  const content = extractToolCallContent(toolData, displayName)
  return createEntry(entryType, content, timestamp, `${idBase}-call`, {
    toolName: displayName,
    toolInput: args ?? undefined,
    toolUseId: callId,
    status: subtype === 'started' ? 'running' : 'pending',
  })
}

/**
 * Cursor thinking 行可能使用 message.content[]（含 thinking 字段）、顶层 text/delta，或 JSON 字符串。
 */
function extractThinkingText(msg: RecordLike): string | null {
  const message = asRecord(msg.message)
  if (message) {
    const content = message.content
    if (Array.isArray(content)) {
      const parts: string[] = []
      for (const item of content) {
        if (typeof item === 'string') {
          parts.push(item)
          continue
        }
        const rec = asRecord(item)
        if (!rec) continue
        const t =
          getString(rec.thinking) ||
          getString(rec.text) ||
          getString(rec.content) ||
          getString(rec.delta)
        if (t) parts.push(t)
      }
      const joined = parts.join('').trim()
      if (joined) return joined
    }
    if (typeof content === 'string' && content.trim()) {
      return content.trim()
    }
  }

  const direct = getString(msg.text) || getString(msg.delta) || getString(msg.content)
  if (direct) {
    const plain = extractReadablePlainText(direct) ?? direct
    return plain.trim() || null
  }

  const rawContent = msg.content
  if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    const plain = extractReadablePlainText(rawContent)
    if (plain) return plain.trim() || null
  }

  return null
}

function extractContentParts(msg: RecordLike): string | null {
  const message = asRecord(msg.message)
  if (!message) return getString(msg.content) || null

  const content = message.content
  if (typeof content === 'string') return content.trim() || null

  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const item of content) {
      if (typeof item === 'string') {
        parts.push(item)
        continue
      }
      const rec = asRecord(item)
      if (!rec) continue
      const text = getString(rec.text) || getString(rec.content)
      if (text) parts.push(text)
    }
    const joined = parts.join('').trim()
    return joined || null
  }

  return null
}

/**
 * 解析结果为 null 时，若本行是「无内容的 thinking / assistant」等可忽略事件，则不要落为 system_message，
 * 否则会把整行 JSON 刷到执行日志里。
 */
function shouldSkipUnparsedCursorLine(line: string): boolean {
  try {
    const msg = JSON.parse(line) as RecordLike
    const type = getString(msg.type)?.toLowerCase()
    if (type === 'thinking') {
      return true
    }
    if (type === 'assistant') {
      const text = extractContentParts(msg)
      if (!text?.trim()) {
        return true
      }
    }
  } catch {
    return false
  }
  return false
}

function parseSystemInit(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry {
  const model = getString(msg.model) || 'unknown'
  const permissionMode = getString(msg.permissionMode)
  const parts = [`Model: ${model}`]
  if (permissionMode) parts.push(`Permissions: ${permissionMode}`)
  return createEntry('system_message', parts.join(' | '), timestamp, `${idBase}-init`, {
    model,
    permissionMode,
  })
}

function parseResult(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry {
  const subtype = getString(msg.subtype)
  const durationMs = getNumber(msg.duration_ms)
  const isError = getBoolean(msg.is_error)
  const usage = asRecord(msg.usage)
  const resultText = getString(msg.result)

  const label = isError ? 'Failed' : 'Completed'
  const content = durationMs ? `${label} in ${(durationMs / 1000).toFixed(1)}s` : label

  const type = isError ? 'error' : 'system_message'
  return createEntry(type, content, timestamp, `${idBase}-result`, {
    isResult: true,
    resultSubtype: subtype,
    durationMs,
    inputTokens: usage ? getNumber(usage.inputTokens) : undefined,
    outputTokens: usage ? getNumber(usage.outputTokens) : undefined,
    cacheReadTokens: usage ? getNumber(usage.cacheReadTokens) : undefined,
    resultText,
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
    const subtype = getString(msg.subtype)?.toLowerCase()

    // type=system
    if (type === 'system') {
      if (subtype === 'init') return parseSystemInit(msg, timestamp, idBase)
      const content = getString(msg.content) || (subtype ? `System: ${subtype}` : '')
      return content ? createEntry('system_message', content, timestamp, `${idBase}-system`) : null
    }

    // type=user
    if (type === 'user') {
      const content = extractContentParts(msg)
      return content ? createEntry('user_message', content, timestamp, `${idBase}-user`) : null
    }

    // type=thinking
    if (type === 'thinking') {
      if (subtype === 'completed') return null
      const text = extractThinkingText(msg)
      if (!text) return null
      return createEntry('thinking', text, timestamp, `${idBase}-thinking`)
    }

    // type=assistant
    if (type === 'assistant') {
      const content = extractContentParts(msg)
      return content ? createEntry('assistant_message', content, timestamp, `${idBase}-assistant`) : null
    }

    // type=tool_call (subtype=started | completed)
    if (type === 'tool_call') {
      return parseToolCall(msg, timestamp, idBase)
    }

    // type=result (subtype=success | error)
    if (type === 'result') {
      return parseResult(msg, timestamp, idBase)
    }

    // type=error
    if (type === 'error' || getBoolean(msg.is_error)) {
      const content = getString(msg.error) || getString(msg.message) || 'Error'
      return createEntry('error', content, timestamp, `${idBase}-error`)
    }

    const fallback = extractContentParts(msg) || getString(msg.content) || getString(msg.message)
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

    if (shouldSkipUnparsedCursorLine(content)) {
      return
    }

    entries.push(createEntry('system_message', content, timestamp, `${idBase}-raw`))
  })

  return mergeThinkingDeltas(entries)
}

function mergeThinkingDeltas(entries: NormalizedEntry[]): NormalizedEntry[] {
  const result: NormalizedEntry[] = []

  for (const entry of entries) {
    if (entry.type !== 'thinking') {
      result.push(entry)
      continue
    }
    const prev = result[result.length - 1]
    if (prev && prev.type === 'thinking') {
      prev.content += entry.content
    } else {
      result.push({ ...entry })
    }
  }

  return result
}
