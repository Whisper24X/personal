import type { NormalizedEntry, NormalizedEntryType, RecordLike } from './types'

export function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}

export function getBoolean(value: unknown): boolean {
  return value === true
}

export function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : null
}

export function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function makeId(base: string, suffix: string | number): string {
  return `${base}-${suffix}`
}

export function createEntry(
  type: NormalizedEntryType,
  content: string,
  timestamp: number,
  id: string,
  metadata?: NormalizedEntry['metadata'],
): NormalizedEntry {
  return { id, type, timestamp, content, metadata }
}

export function resolveTimestamp(msg: RecordLike, fallback?: number): number {
  const tsMs = getNumber(msg.timestamp_ms)
  if (tsMs !== undefined) return tsMs
  const ts = getNumber(msg.timestamp)
  if (ts !== undefined) return ts
  return fallback ?? Date.now()
}

export function toSnakeCase(value: string): string {
  return value
    .replace(/ToolCall$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

export function resolveToolEntryType(toolName: string): NormalizedEntryType {
  const lower = toolName.toLowerCase()
  if (lower.includes('bash') || lower.includes('shell') || lower.includes('command') || lower.includes('exec')) {
    return 'command_run'
  }
  if (lower.includes('read') || lower.includes('ls') || lower.includes('cat') || lower.includes('open')) {
    return 'file_read'
  }
  if (lower.includes('write') || lower.includes('edit') || lower.includes('patch') || lower.includes('apply')) {
    return 'file_edit'
  }
  return 'tool_use'
}

export function previewText(
  text: string,
  maxLines = 3,
  maxChars = 220,
): { text: string; truncated: boolean } {
  const trimmed = text.trim()
  if (!trimmed) return { text: '', truncated: false }

  const lines = trimmed.split('\n')
  const limitedLines = lines.slice(0, maxLines)
  let preview = limitedLines.join('\n')
  let truncated = lines.length > maxLines

  if (preview.length > maxChars) {
    preview = `${preview.slice(0, maxChars - 1)}...`
    truncated = true
  } else if (truncated) {
    preview = `${preview}...`
  }

  return { text: preview, truncated }
}

export function tryParseJson(value: string): unknown | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

export function summarizeParsedJson(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Returned empty list'
    return `Returned ${value.length} item${value.length === 1 ? '' : 's'}`
  }

  const record = asRecord(value)
  if (record) {
    const error = getString(record.error)
    if (error) return `Error: ${error}`
    const message =
      getString(record.message) ||
      getString(record.text) ||
      getString(record.summary) ||
      getString(record.content) ||
      getString(record.output)
    if (message) return message
    const keys = Object.keys(record)
    return keys.length > 0 ? `${keys.length} fields in result` : 'Returned empty object'
  }

  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

export function pickToolInputValue(input: RecordLike | null): string | undefined {
  if (!input) return undefined

  const byKey =
    getString(input.command) ||
    getString(input.path) ||
    getString(input.filePath) ||
    getString(input.file_path) ||
    getString(input.pattern) ||
    getString(input.query) ||
    getString(input.glob) ||
    getString(input.url)
  if (byKey) return byKey

  const firstString = Object.values(input).find((v) => typeof v === 'string' && v.trim())
  return typeof firstString === 'string' ? firstString : undefined
}

export function formatToolInput(toolName: string, toolInput: RecordLike | null): string {
  if (!toolInput) return toolName
  const lower = toolName.toLowerCase()
  if ((lower.includes('read') || lower.includes('ls')) && toolInput.path) {
    return String(toolInput.path)
  }
  if ((lower.includes('write') || lower.includes('edit')) && toolInput.filePath) {
    return String(toolInput.filePath)
  }
  if (lower.includes('command') && toolInput.command) {
    return `$ ${String(toolInput.command)}`
  }
  return stringify(toolInput)
}

export function extractMessageText(msg: RecordLike): string | null {
  const message = asRecord(msg.message)
  if (message) {
    const content = message.content
    if (Array.isArray(content)) {
      const parts = content
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const record = item as RecordLike
            return getString(record.text) || getString(record.content) || ''
          }
          return ''
        })
        .filter(Boolean)
      const text = parts.join('')
      return text.trim() ? text : null
    }
    const text = getString(message.content) || getString(message.text)
    if (text) return text
  }
  const content = getString(msg.content)
  if (content) return content
  return null
}

export function stringifyContent(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => stringifyContent(item))
      .filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join('') : undefined
  }
  if (typeof value === 'object') {
    const record = value as RecordLike
    const text = getString(record.text) || getString(record.content) || getString(record.message)
    if (text) return text
    const nested = record.error ?? record.warning
    const nestedRecord = asRecord(nested)
    const nestedText = getString(nested) || (nestedRecord ? getString(nestedRecord.message) : undefined)
    if (nestedText) return nestedText
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
