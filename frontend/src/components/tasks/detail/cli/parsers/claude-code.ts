import type { NormalizedEntry, NormalizedEntryType, RecordLike } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import {
  asRecord,
  createEntry,
  getBoolean,
  getNumber,
  getString,
  isRecord,
  makeId,
  resolveTimestamp,
} from '../utils'

function extractExitCode(output: string): number | undefined {
  const match = output.match(/\[Process exited with code (\d+)\]/)
  return match ? Number.parseInt(match[1], 10) : undefined
}

function parseClaudeToolUse(
  toolName: string,
  toolInput: RecordLike | undefined,
  toolUseId: string | undefined,
  timestamp: number,
  idBase: string,
): NormalizedEntry {
  let entryType: NormalizedEntryType = 'tool_use'
  if (toolName === 'Bash' || toolName === 'execute') entryType = 'command_run'
  else if (toolName === 'Edit' || toolName === 'Write') entryType = 'file_edit'
  else if (toolName === 'Read') entryType = 'file_read'

  let content = ''
  if (toolInput) {
    if (toolName === 'Bash' && toolInput.command) {
      content = `$ ${String(toolInput.command)}`
    } else if ((toolName === 'Read' || toolName === 'Edit' || toolName === 'Write') && toolInput.file_path) {
      content = String(toolInput.file_path)
    } else {
      content = JSON.stringify(toolInput, null, 2)
    }
  }

  return {
    id: idBase,
    type: entryType,
    timestamp,
    content,
    metadata: { toolName, toolInput, toolUseId, status: 'pending' },
  }
}

function parseClaudeAssistantMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry | NormalizedEntry[] | null {
  const entries: NormalizedEntry[] = []
  const message = asRecord(msg.message)
  const content = message?.content

  if (Array.isArray(content)) {
    content.forEach((item, index) => {
      if (!isRecord(item)) return
      const itemType = getString(item.type)
      if (itemType === 'text' && getString(item.text) && item.text !== '(no content)') {
        entries.push(createEntry('assistant_message', String(item.text), timestamp, makeId(idBase, `text-${index}`)))
      } else if (itemType === 'tool_use' && getString(item.name)) {
        const toolInput = asRecord(item.input) || undefined
        entries.push(
          parseClaudeToolUse(String(item.name), toolInput ?? undefined, getString(item.id), timestamp, makeId(idBase, `tool-${index}`)),
        )
      }
    })
  } else if (getString(msg.content)) {
    entries.push(createEntry('assistant_message', String(msg.content), timestamp, makeId(idBase, 'text')))
  }

  if (entries.length === 0) return null
  return entries.length === 1 ? entries[0] : entries
}

function parseClaudeUserMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry | null {
  const toolUseResult = asRecord(msg.tool_use_result)
  if (toolUseResult) {
    const stdout = getString(toolUseResult.stdout) || ''
    const stderr = getString(toolUseResult.stderr) || ''
    const content = stderr ? `${stdout}\n${stderr}` : stdout
    if (content.trim()) {
      return createEntry('tool_result', content.trim(), timestamp, makeId(idBase, 'tool-result'))
    }
  }

  const message = asRecord(msg.message)
  const content = message?.content
  if (Array.isArray(content)) {
    for (const item of content) {
      if (!isRecord(item)) continue
      const itemType = getString(item.type)
      if (itemType === 'tool_result' && getString(item.content)) {
        return {
          id: makeId(idBase, 'tool-result'),
          type: 'tool_result',
          timestamp,
          content: String(item.content),
          metadata: {
            toolUseId: getString(item.tool_use_id),
            status: getBoolean(item.is_error) ? 'failed' : 'success',
          },
        }
      }
    }
  }

  return null
}

function parseClaudeSystemMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry | null {
  const subtype = getString(msg.subtype)
  let content = ''

  if (subtype === 'init') {
    const model = getString(msg.model) || 'unknown'
    content = `System initialized with model: ${model}`
  } else if (getString(msg.content)) {
    content = String(msg.content)
  } else if (subtype) {
    content = `System: ${subtype}`
  }

  if (!content) return null
  return createEntry('system_message', content, timestamp, makeId(idBase, 'system'))
}

function parseClaudeResultMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry | null {
  const durationMs = getNumber(msg.duration_ms)
  const totalCost = getNumber(msg.total_cost_usd)
  const status = getString(msg.subtype) === 'success' ? '\u2713' : '\u2717'
  const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : ''
  const cost = totalCost ? `$${totalCost.toFixed(4)}` : ''
  const content = `${status} Completed ${duration ? `in ${duration}` : ''} ${cost ? `(${cost})` : ''}`.trim()
  return createEntry('system_message', content, timestamp, makeId(idBase, 'result'))
}

function parseClaudeCodeLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
): NormalizedEntry | NormalizedEntry[] | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = resolveTimestamp(msg, fallbackTimestamp)
    const type = getString(msg.type)

    switch (type) {
      case 'assistant':
        return parseClaudeAssistantMessage(msg, timestamp, idBase)
      case 'user':
        return parseClaudeUserMessage(msg, timestamp, idBase)
      case 'system':
        return parseClaudeSystemMessage(msg, timestamp, idBase)
      case 'result':
        return parseClaudeResultMessage(msg, timestamp, idBase)
      case 'tool_use': {
        const toolName = getString(msg.name) || 'unknown'
        const toolInput = asRecord(msg.input) || undefined
        return parseClaudeToolUse(toolName, toolInput ?? undefined, getString(msg.tool_use_id), timestamp, makeId(idBase, 'tool-use'))
      }
      case 'tool_result': {
        const output = getString(msg.output) || ''
        return {
          id: makeId(idBase, 'tool-result'),
          type: 'tool_result',
          timestamp,
          content: output,
          metadata: {
            toolUseId: getString(msg.tool_use_id),
            toolOutput: output,
            exitCode: extractExitCode(output),
            status: getBoolean(msg.is_error) ? 'failed' : 'success',
          },
        }
      }
      case 'control_response':
        return createEntry('system_message', 'Session initialized', timestamp, makeId(idBase, 'control'))
      default:
        return null
    }
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, makeId(idBase, 'raw'))
  }
}

export function parseClaudeCodeMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `claude-${index}`

    if (msg.role === 'error') {
      entries.push(createEntry('error', content, timestamp, `${idBase}-stderr`))
      return
    }

    const parsed = parseClaudeCodeLine(content, timestamp, idBase)
    if (parsed) {
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      arr.forEach((e) => entries.push(e))
      return
    }

    entries.push(createEntry('system_message', content, timestamp, `${idBase}-raw`))
  })

  return entries
}
