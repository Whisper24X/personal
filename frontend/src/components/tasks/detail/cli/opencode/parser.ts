import type { NormalizedEntry, RecordLike } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import {
  asRecord,
  createEntry,
  getNumber,
  getString,
  makeId,
  previewText,
  resolveTimestamp,
  resolveToolEntryType,
  stringify,
  stringifyContent,
} from '../utils'

function toLabel(raw: string): string {
  return raw
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatToolName(rawToolName: string): string {
  const normalized = rawToolName.trim().toLowerCase()
  const aliases: Record<string, string> = {
    read: 'Read',
    glob: 'Glob',
    grep: 'Grep',
    bash: 'Bash',
    edit: 'Edit',
    write: 'Write',
    list: 'List',
  }

  return aliases[normalized] ?? toLabel(rawToolName)
}

type EntryStatus = 'pending' | 'running' | 'success' | 'failed'

function resolveToolStatus(status: string | undefined): EntryStatus {
  if (status === 'completed') return 'success'
  if (status === 'error') return 'failed'
  if (status === 'pending') return 'pending'
  return 'running'
}

function resolveToolPath(input: RecordLike | null): string | undefined {
  if (!input) return undefined

  return (
    getString(input.filePath) ||
    getString(input.file_path) ||
    getString(input.path) ||
    getString(input.targetDirectory)
  )
}

function resolveToolCommand(input: RecordLike | null): string | undefined {
  if (!input) return undefined
  return getString(input.command)
}

function summarizeToolInput(toolName: string, input: RecordLike | null): string {
  if (!input) return toolName

  const command = resolveToolCommand(input)
  if (command) return `$ ${command}`

  const path = resolveToolPath(input)
  const pattern = getString(input.pattern) || getString(input.query)
  if (path && pattern) return `${path} → ${pattern}`
  if (path) return path
  if (pattern) return pattern

  const firstString = Object.values(input).find((value) => typeof value === 'string' && value.trim())
  if (typeof firstString === 'string') return firstString

  return toolName
}

function summarizeToolOutput(state: RecordLike): {
  summary: string
  fullOutput?: string
} {
  const error = getString(state.error)
  if (error) {
    return {
      summary: error,
      fullOutput: error,
    }
  }

  const metadata = asRecord(state.metadata)
  const preview = getString(metadata?.preview)
  const output = stringifyContent(state.output)
  const content = preview || output || ''

  if (!content.trim()) {
    return {
      summary: 'Completed',
    }
  }

  const summarized = previewText(content, 4, 240)

  return {
    summary: summarized.text || 'Completed',
    fullOutput: output || preview || undefined,
  }
}

function parseToolEvent(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry[] | null {
  const part = asRecord(msg.part)
  const state = asRecord(part?.state)
  if (!part || !state) return null

  const rawToolName = getString(part.tool) || getString(msg.tool) || 'tool'
  const toolName = formatToolName(rawToolName)
  const input = asRecord(state.input)
  const toolUseId = getString(part.callID) || getString(msg.callID) || getString(part.id)
  const status = resolveToolStatus(getString(state.status)?.toLowerCase())
  const entryType = resolveToolEntryType(rawToolName)
  const content = summarizeToolInput(toolName, input)

  const toolEntry = createEntry(entryType, content, timestamp, makeId(idBase, 'tool'), {
    toolName,
    toolInput: input ?? undefined,
    toolUseId,
    status,
    command: resolveToolCommand(input),
    filePath: resolveToolPath(input),
  })

  if (status === 'pending' || status === 'running') {
    return [toolEntry]
  }

  const { summary, fullOutput } = summarizeToolOutput(state)

  return [
    toolEntry,
    createEntry('tool_result', summary, timestamp, makeId(idBase, 'result'), {
      toolUseId,
      toolName,
      toolOutput: fullOutput ?? summary,
      status,
      filePath: resolveToolPath(input),
      command: resolveToolCommand(input),
    }),
  ]
}

function parseStepStart(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry {
  const part = asRecord(msg.part)
  const snapshot = getString(part?.snapshot)

  return createEntry('system_message', 'Step started', timestamp, makeId(idBase, 'step-start'), {
    opencodeEventType: 'step_start',
    snapshot,
  })
}

function formatStepReason(reason: string | undefined): string {
  if (!reason) return '步骤结束'
  const labels: Record<string, string> = {
    'tool-calls': '工具调用完成',
    stop: '响应完成',
  }

  return labels[reason] ?? toLabel(reason)
}

function parseStepFinish(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry {
  const part = asRecord(msg.part)
  const tokens = asRecord(part?.tokens)
  const totalTokens = getNumber(tokens?.total)
  const outputTokens = getNumber(tokens?.output)
  const reason = getString(part?.reason)
  const pieces = [formatStepReason(reason)]

  if (totalTokens !== undefined) {
    pieces.push(`${totalTokens.toLocaleString('en-US')} tokens`)
  }
  if (outputTokens !== undefined) {
    pieces.push(`${outputTokens.toLocaleString('en-US')} out`)
  }

  return createEntry('system_message', pieces.join(' · '), timestamp, makeId(idBase, 'step-finish'), {
    opencodeEventType: 'step_finish',
    stepReason: reason,
    totalTokens,
    outputTokens,
    inputTokens: getNumber(tokens?.input),
    reasoningTokens: getNumber(tokens?.reasoning),
    stepCost: getNumber(part?.cost),
    snapshot: getString(part?.snapshot),
  })
}

function parseTextMessage(
  msg: RecordLike,
  timestamp: number,
  idBase: string,
): NormalizedEntry | null {
  const part = asRecord(msg.part)
  const text = getString(part?.text)

  if (!text) return null

  return createEntry('assistant_message', text, timestamp, makeId(idBase, 'text'), {
    opencodeEventType: 'text',
  })
}

function parseOpencodeLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
): NormalizedEntry | NormalizedEntry[] | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = resolveTimestamp(msg, fallbackTimestamp)
    const type = getString(msg.type)?.toLowerCase()

    if (type === 'step_start') {
      return parseStepStart(msg, timestamp, idBase)
    }

    if (type === 'step_finish') {
      return parseStepFinish(msg, timestamp, idBase)
    }

    if (type === 'tool_use') {
      return parseToolEvent(msg, timestamp, idBase)
    }

    if (type === 'text') {
      return parseTextMessage(msg, timestamp, idBase)
    }

    if (type === 'error') {
      return createEntry(
        'error',
        getString(msg.error) || getString(msg.message) || stringify(msg),
        timestamp,
        makeId(idBase, 'error'),
      )
    }

    const content = getString(msg.message) || stringifyContent(msg.part) || stringify(msg)
    return content
      ? createEntry('system_message', content, timestamp, makeId(idBase, 'system'))
      : null
  } catch {
    const timestamp = fallbackTimestamp ?? Date.now()
    return createEntry('system_message', line, timestamp, makeId(idBase, 'raw'))
  }
}

export function parseOpencodeMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `opencode-${index}`

    const parsed = parseOpencodeLine(content, timestamp, idBase)
    if (!parsed) return

    if (Array.isArray(parsed)) {
      entries.push(...parsed)
      return
    }

    entries.push(parsed)
  })

  return entries
}
