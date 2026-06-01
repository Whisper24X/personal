import type { NormalizedEntry, RecordLike } from '../types'
import type { TaskMessage } from '@/types/api/tasks'
import {
  asRecord,
  createEntry,
  getNumber,
  getString,
  isRecord,
  makeId,
  stringifyContent,
} from '../utils'

function formatCommand(command: unknown): string | undefined {
  if (Array.isArray(command)) return command.map((part) => String(part)).join(' ')
  if (typeof command === 'string') return command
  return undefined
}

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatPatchApplyBegin(msg: RecordLike): string {
  const changes = asRecord(msg.changes)
  const fileCount = changes ? Object.keys(changes).length : 0
  const suffix = fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? '' : 's'})` : ''
  return `Applying patch${suffix}`
}

function formatPatchApplyEnd(msg: RecordLike): string {
  const success = msg.success === true
  const detail = getString(msg.stdout) || getString(msg.stderr)
  if (detail) return success ? `Patch applied: ${detail}` : `Patch failed: ${detail}`
  return success ? 'Patch applied' : 'Patch failed'
}

function formatThreadStarted(msg: RecordLike): string {
  const threadId = getString(msg.thread_id) || getString(msg.threadId)
  return threadId ? `Thread started: ${threadId}` : 'Thread started'
}

function formatTurnCompleted(msg: RecordLike): string {
  const usage = asRecord(msg.usage)
  if (!usage) return 'Turn completed'
  const inputTokens = getNumber(usage.input_tokens)
  const cachedInputTokens = getNumber(usage.cached_input_tokens)
  const outputTokens = getNumber(usage.output_tokens)
  const parts = [
    inputTokens !== undefined ? `in ${inputTokens}` : null,
    cachedInputTokens !== undefined ? `cached ${cachedInputTokens}` : null,
    outputTokens !== undefined ? `out ${outputTokens}` : null,
  ].filter(Boolean)
  if (parts.length === 0) return 'Turn completed'
  return `Turn completed (${parts.join(', ')})`
}

function extractCodexContent(msg: RecordLike): string | undefined {
  const direct = pickCodexContent(msg)
  if (direct) return direct

  const params = asRecord(msg.params)
  if (params) {
    const fromParams = pickCodexContent(params)
    if (fromParams) return fromParams
    const paramsEvent = asRecord(params.event)
    if (paramsEvent) {
      const fromEvent = pickCodexContent(paramsEvent)
      if (fromEvent) return fromEvent
    }
  }

  const result = asRecord(msg.result)
  if (result) {
    const fromResult = pickCodexContent(result)
    if (fromResult) return fromResult
  }

  return undefined
}

function pickCodexContent(record: RecordLike): string | undefined {
  const direct = stringifyContent(record.message ?? record.text ?? record.delta ?? record.content)
  if (direct) return direct
  const errorText = stringifyContent(record.error)
  if (errorText) return errorText
  const warningText = stringifyContent(record.warning)
  if (warningText) return warningText
  return undefined
}

function createCodexCommandBegin(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry | null {
  const callId = getString(msg.call_id)
  const command = formatCommand(msg.command)
  const cwd = getString(msg.cwd)
  if (!command) return null
  return {
    id: idBase,
    type: 'command_run',
    timestamp,
    content: command,
    metadata: { toolName: 'execute', toolInput: { command, cwd }, toolUseId: callId, status: 'running' },
  }
}

function createCodexCommandEnd(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry | null {
  const callId = getString(msg.call_id)
  const exitCode = getNumber(msg.exit_code)
  const output =
    getString(msg.aggregated_output) ||
    getString(msg.formatted_output) ||
    [getString(msg.stdout), getString(msg.stderr)].filter(Boolean).join('\n')
  if (!output && exitCode === undefined) return null
  return {
    id: idBase,
    type: 'tool_result',
    timestamp,
    content: output || '',
    metadata: {
      toolUseId: callId,
      status: exitCode === undefined || exitCode === 0 ? 'success' : 'failed',
      exitCode,
    },
  }
}

function createCodexCommandEntry(
  item: RecordLike,
  timestamp: number,
  flags: { isStarted: boolean; isCompleted: boolean },
  idBase: string,
): NormalizedEntry | null {
  const command = getString(item.command) || getString(item.cmd) || getString(item.command_text)
  const toolUseId = getString(item.id) || getString(item.command_id)
  const status = getString(item.status)?.toLowerCase()
  const exitCode = getNumber(item.exit_code)
  const output = stringifyContent(item.aggregated_output) || stringifyContent(item.output) || ''
  const hasResultData = Boolean(output) || exitCode !== undefined

  if (!command && !hasResultData) return null

  const isStarted = flags.isStarted || status === 'in_progress' || status === 'running'
  const isCompleted = flags.isCompleted || status === 'completed' || exitCode !== undefined

  if (isStarted) {
    return {
      id: idBase,
      type: 'command_run',
      timestamp,
      content: command || 'Command',
      metadata: { toolName: 'execute', toolInput: command ? { command } : undefined, toolUseId, status: 'running' },
    }
  }

  if (isCompleted) {
    return {
      id: idBase,
      type: 'tool_result',
      timestamp,
      content: output,
      metadata: {
        toolUseId,
        status: status === 'failed' || (exitCode !== undefined && exitCode !== 0) ? 'failed' : 'success',
        exitCode,
      },
    }
  }

  return null
}

function createCodexToolUseFromItem(item: RecordLike, timestamp: number, idBase: string): NormalizedEntry | null {
  const toolCall = asRecord(item.tool_call)
  const toolName = getString(item.tool_name) || getString(item.name) || getString(toolCall?.name)
  const toolInput = asRecord(item.input) || asRecord(toolCall?.input)
  const toolUseId = getString(item.tool_call_id) || getString(item.id) || getString(toolCall?.id)

  if (!toolName && !toolInput) return null

  return {
    id: idBase,
    type: 'tool_use',
    timestamp,
    content: toolInput ? JSON.stringify(toolInput) : toolName || 'tool',
    metadata: { toolName: toolName || 'tool', toolInput: toolInput ?? undefined, toolUseId },
  }
}

const MCP_DISPLAY_MAX = 500

function truncateForDisplay(value: string, max = MCP_DISPLAY_MAX): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function summarizeMcpArguments(args: unknown): string | undefined {
  if (args === undefined || args === null) return undefined
  try {
    const s = typeof args === 'string' ? args : JSON.stringify(args)
    return truncateForDisplay(s, 240)
  } catch {
    return undefined
  }
}

function summarizeMcpResult(result: unknown): string | undefined {
  const r = asRecord(result)
  if (!r) return undefined
  const content = r.content
  if (Array.isArray(content)) {
    for (const block of content) {
      const b = asRecord(block)
      if (!b || getString(b.type) !== 'text') continue
      const text = getString(b.text)
      if (text) return truncateForDisplay(text)
    }
  }
  const structured = r.structured_content ?? r.structuredContent
  if (structured !== undefined) {
    try {
      return truncateForDisplay(JSON.stringify(structured), MCP_DISPLAY_MAX)
    } catch {
      return undefined
    }
  }
  const fallback = stringifyContent(r)
  return fallback ? truncateForDisplay(fallback) : undefined
}

function createCodexMcpToolCallEntry(
  item: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string,
): NormalizedEntry | null {
  const server = getString(item.server) || 'mcp'
  const tool = getString(item.tool) || 'tool'
  const argsSummary = summarizeMcpArguments(item.arguments)
  const statusRaw = getString(item.status)?.toLowerCase()
  const phase = normalizedType?.endsWith('_completed')
    ? 'completed'
    : normalizedType?.endsWith('_started')
      ? 'started'
      : normalizedType?.endsWith('_updated')
        ? 'updated'
        : 'event'

  const errRec = asRecord(item.error)
  const errMsg = errRec
    ? getString(errRec.message) || stringifyContent(errRec) || stringifyContent(item.error)
    : undefined

  let content: string
  if (phase === 'started') {
    const argsLine = argsSummary ? `\n${argsSummary}` : ''
    content = `MCP · ${server} → ${tool}${argsLine}`
  } else if (phase === 'completed') {
    const resultSummary = summarizeMcpResult(item.result)
    const failed = statusRaw === 'failed' || Boolean(errMsg)
    const body = failed ? errMsg || resultSummary || '(failed)' : resultSummary || '(done)'
    content = `MCP · ${server} → ${tool} · ${failed ? 'failed' : 'completed'}\n${truncateForDisplay(body, MCP_DISPLAY_MAX)}`
  } else {
    const parts = [`MCP · ${server} → ${tool} · ${phase}`]
    if (argsSummary) parts.push(argsSummary)
    const rs = summarizeMcpResult(item.result)
    if (rs) parts.push(rs)
    if (errMsg) parts.push(errMsg)
    content = parts.join('\n')
  }

  const metadata: Record<string, unknown> = {
    codexCardType: 'mcp_tool_call',
    codexItemPhase: phase,
    mcpServer: server,
    mcpTool: tool,
    mcpArguments: item.arguments,
    mcpStatus: statusRaw,
  }
  if (errRec) metadata.mcpError = item.error

  return {
    id: idBase,
    type: 'system_message',
    timestamp,
    content,
    metadata,
  }
}

function extractTodoListItems(item: RecordLike): Array<{ text: string; completed: boolean }> {
  const rawItems = Array.isArray(item.items) ? item.items : []
  return rawItems
    .map((raw) => {
      const record = asRecord(raw)
      if (!record) return null
      const text = getString(record.text) || getString(record.content) || getString(record.label)
      if (!text) return null
      return {
        text,
        completed: record.completed === true,
      }
    })
    .filter((entry): entry is { text: string; completed: boolean } => Boolean(entry))
}

function shortenFilePath(path: string): string {
  const segments = path.split(/[\\/]+/).filter(Boolean)
  if (segments.length <= 4) return segments.join('/')
  return segments.slice(-4).join('/')
}

function formatFileChangeKind(kind: string | undefined): string {
  const normalized = kind?.toLowerCase()
  if (normalized === 'add' || normalized === 'create') return '新增'
  if (normalized === 'delete' || normalized === 'remove') return '删除'
  if (normalized === 'rename') return '重命名'
  if (normalized === 'move') return '移动'
  if (normalized === 'update' || normalized === 'modify' || normalized === 'edit') return '修改'
  return '变更'
}

type CodexFileChange = {
  path: string
  kind?: string
}

function extractFileChanges(item: RecordLike): CodexFileChange[] {
  const rawChanges = Array.isArray(item.changes) ? item.changes : []
  const changes: CodexFileChange[] = []

  rawChanges.forEach((raw) => {
    const record = asRecord(raw)
    if (!record) return

    const path = getString(record.path)
    if (!path) return

    changes.push({
      path,
      kind: getString(record.kind),
    })
  })

  return changes
}

function createCodexTodoListEntry(
  item: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string,
): NormalizedEntry {
  const todoItems = extractTodoListItems(item)
  const completedCount = todoItems.filter((entry) => entry.completed).length
  const totalCount = todoItems.length
  const isCompleted = normalizedType?.endsWith('_completed') ?? false
  const progressText = totalCount > 0 ? ` (${completedCount}/${totalCount})` : ''

  return {
    id: idBase,
    type: 'system_message',
    timestamp,
    content: `${isCompleted ? 'Todo list completed' : 'Todo list updated'}${progressText}`,
    metadata: {
      codexCardType: 'todo_list',
      codexItemId: getString(item.id),
      codexItemType: 'todo_list',
      todoItems,
      todoCompletedCount: completedCount,
      todoTotalCount: totalCount,
      status: isCompleted ? 'success' : 'running',
    },
  }
}

function createCodexFileChangeEntry(
  item: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string,
): NormalizedEntry | null {
  const changes = extractFileChanges(item)
  if (changes.length === 0) return null

  const isCompleted = normalizedType?.endsWith('_completed') ?? false
  const heading = isCompleted ? '文件变更' : '文件变更中'
  const lines = changes.map((change) => `- ${formatFileChangeKind(change.kind)} \`${shortenFilePath(change.path)}\``)
  const firstLine = lines[0]
  if (!firstLine) return null

  return {
    id: idBase,
    type: 'system_message',
    timestamp,
    content: lines.length === 1 ? `${heading} · ${firstLine.slice(2)}` : `${heading} (${lines.length})\n${lines.join('\n')}`,
    metadata: {
      codexCardType: 'file_change',
      codexItemId: getString(item.id),
      codexItemType: 'file_change',
      codexChanges: changes,
      status: isCompleted ? 'success' : 'running',
    },
  }
}

function extractCodexItem(msg: RecordLike): RecordLike | null {
  const direct = asRecord(msg.item)
  if (direct) return direct
  const params = asRecord(msg.params)
  if (params) {
    const nested = asRecord(params.item)
    if (nested) return nested
  }
  const result = asRecord(msg.result)
  if (result) {
    const nested = asRecord(result.item)
    if (nested) return nested
  }
  return null
}

function parseCodexItemEvent(
  msg: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string,
): NormalizedEntry | null {
  const item = extractCodexItem(msg)
  if (!item) return null

  const rawItemType = getString(item.type) || getString(item.kind)
  const itemType = rawItemType ? rawItemType.toLowerCase() : undefined
  const isStarted = normalizedType?.endsWith('_started') ?? false
  const isCompleted = normalizedType?.endsWith('_completed') ?? false

  if (itemType && itemType.includes('reasoning')) return null

  if (itemType && (itemType.includes('command') || itemType.includes('exec'))) {
    return createCodexCommandEntry(item, timestamp, { isStarted, isCompleted }, idBase)
  }

  // Must run before `includes('tool')`: `mcp_tool_call` contains the substring "tool".
  if (itemType === 'mcp_tool_call') {
    return createCodexMcpToolCallEntry(item, timestamp, normalizedType, idBase)
  }

  if (itemType && itemType.includes('tool')) {
    return createCodexToolUseFromItem(item, timestamp, idBase)
  }

  if (itemType === 'todo_list') {
    return createCodexTodoListEntry(item, timestamp, normalizedType, idBase)
  }

  if (itemType === 'file_change') {
    return createCodexFileChangeEntry(item, timestamp, normalizedType, idBase)
  }

  const text = stringifyContent(item.text ?? item.content ?? item.message ?? item.output ?? item.result)
  if (!text) return null

  if (itemType && (itemType.includes('agent') || itemType.includes('assistant'))) {
    return createEntry('assistant_message', text, timestamp, idBase)
  }

  if (itemType && itemType.includes('user')) {
    return createEntry('user_message', text, timestamp, idBase)
  }

  return createEntry('system_message', text, timestamp, idBase)
}

function parseCodexEventArrayFrom(
  record: RecordLike,
  idBase: string,
  fallbackTimestamp: number | undefined,
): NormalizedEntry[] | null {
  const candidates = [record.events, record.initial_messages, record.messages]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const entries: NormalizedEntry[] = []
    candidate.forEach((item, index) => {
      if (!isRecord(item)) return
      const parsed = parseCodexMessage(item, makeId(idBase, `evt-${index}`), fallbackTimestamp)
      if (parsed) {
        if (Array.isArray(parsed)) entries.push(...parsed)
        else entries.push(parsed)
      }
    })
    if (entries.length > 0) return entries
  }
  return null
}

function parseCodexMessage(
  msg: RecordLike,
  idBase: string,
  fallbackTimestamp: number | undefined,
): NormalizedEntry | NormalizedEntry[] | null {
  const nested = parseCodexEventArrayFrom(msg, idBase, fallbackTimestamp)
  if (nested) return nested

  const params = asRecord(msg.params)
  if (params) {
    const fromParams = parseCodexEventArrayFrom(params, makeId(idBase, 'params'), fallbackTimestamp)
    if (fromParams) return fromParams
  }

  const result = asRecord(msg.result)
  if (result) {
    const fromResult = parseCodexEventArrayFrom(result, makeId(idBase, 'result'), fallbackTimestamp)
    if (fromResult) return fromResult
  }

  const timestamp = fallbackTimestamp ?? Date.now()
  const rawType = getString(msg.type) || getString(msg.event) || getString(msg.method)
  const normalizedType = rawType ? rawType.toLowerCase().replace(/\./g, '_') : undefined
  const content = extractCodexContent(msg)

  if (normalizedType) {
    if (normalizedType.includes('reasoning')) return null

    if (normalizedType === 'exec_command_begin')
      return createCodexCommandBegin(msg, timestamp, makeId(idBase, 'exec-begin'))
    if (normalizedType === 'exec_command_end')
      return createCodexCommandEnd(msg, timestamp, makeId(idBase, 'exec-end'))
    if (normalizedType === 'patch_apply_begin')
      return createEntry('system_message', formatPatchApplyBegin(msg), timestamp, makeId(idBase, 'patch-begin'), { codexEventType: 'patch_begin' })
    if (normalizedType === 'patch_apply_end')
      return createEntry('system_message', formatPatchApplyEnd(msg), timestamp, makeId(idBase, 'patch-end'), { codexEventType: 'patch_end', success: msg.success === true })

    if (normalizedType.startsWith('item_')) {
      const itemEntry = parseCodexItemEvent(msg, timestamp, normalizedType, makeId(idBase, 'item'))
      if (itemEntry) return itemEntry
      return null
    }

    if (normalizedType === 'thread_started')
      return createEntry('system_message', formatThreadStarted(msg), timestamp, makeId(idBase, 'thread'), {
        codexEventType: 'thread_started',
        threadId: getString(msg.thread_id) || getString(msg.threadId),
      })
    if (normalizedType === 'turn_started')
      return createEntry('system_message', 'Turn started', timestamp, makeId(idBase, 'turn-start'), {
        codexEventType: 'turn_started',
      })
    if (normalizedType === 'turn_completed')
      return createEntry('system_message', formatTurnCompleted(msg), timestamp, makeId(idBase, 'turn-end'), { codexEventType: 'turn_completed' })

    if (['agent_message', 'agent_message_delta', 'assistant_message', 'message', 'response'].includes(normalizedType)) {
      if (!content) return null
      return createEntry('assistant_message', content, timestamp, makeId(idBase, 'assistant'))
    }

    if (normalizedType === 'user_message' || normalizedType === 'user') {
      if (!content) return null
      return createEntry('user_message', content, timestamp, makeId(idBase, 'user'))
    }

    if (normalizedType.includes('error'))
      return createEntry('error', content || rawType || normalizedType, timestamp, makeId(idBase, 'error'))
    if (normalizedType.includes('warning'))
      return createEntry('system_message', content || rawType || normalizedType, timestamp, makeId(idBase, 'warning'))

    if (normalizedType === 'task_started' || normalizedType === 'task_complete') {
      return createEntry('system_message', formatTypeLabel(rawType ?? normalizedType), timestamp, makeId(idBase, 'task'))
    }
  }

  if (content) return createEntry('system_message', content, timestamp, makeId(idBase, 'system'))
  if (rawType) return createEntry('system_message', rawType, timestamp, makeId(idBase, 'system'))
  return null
}

function parseCodexLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
): NormalizedEntry | NormalizedEntry[] | null {
  try {
    const msg = JSON.parse(line) as unknown
    if (!msg || typeof msg !== 'object') {
      return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
    }
    return parseCodexMessage(msg as RecordLike, idBase, fallbackTimestamp)
  } catch {
    return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
  }
}

export function parseCodexMessages(messages: TaskMessage[]): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  messages.forEach((msg, index) => {
    const content = msg.content?.trim()
    if (!content) return

    const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
    const idBase = `codex-${index}`

    if (msg.role === 'error') {
      entries.push(createEntry('error', content, timestamp, `${idBase}-stderr`))
      return
    }

    const parsed = parseCodexLine(content, timestamp, idBase)
    if (parsed) {
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      arr.forEach((e) => entries.push(e))
      return
    }

    entries.push(createEntry('system_message', content, timestamp, `${idBase}-raw`))
  })

  return entries
}
