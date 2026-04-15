import type { ConfigFieldSchema, ConfigFieldType } from './agent-tool-config-modal.schema'
import { TOOL_CONFIG_SCHEMAS } from './agent-tool-config-modal.schema'

export function sanitizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (accumulator, [key, item]) => {
      if (typeof item === 'string') {
        accumulator[key] = item
      }
      return accumulator
    },
    {},
  )
}

export function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

export function parseStringArrayInput(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function toStringArrayInput(value: unknown): string {
  return sanitizeStringArray(value).join('\n')
}

export function parseStringMapInput(value: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      result[line] = ''
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (!key) {
      continue
    }

    result[key] = line.slice(separatorIndex + 1)
  }

  return result
}

export function toStringMapInput(value: unknown): string {
  return Object.entries(sanitizeStringMap(value))
    .map(([key, item]) => `${key}=${item}`)
    .join('\n')
}

export function sanitizeFieldByType(
  type: ConfigFieldType,
  value: unknown,
  defaultValue?: unknown,
): unknown {
  if (type === 'string') {
    return typeof value === 'string' ? value : typeof defaultValue === 'string' ? defaultValue : ''
  }

  if (type === 'stringArray') {
    return sanitizeStringArray(value)
  }

  if (type === 'stringMap') {
    return sanitizeStringMap(value)
  }

  if (type === 'boolean') {
    if (typeof value === 'boolean') {
      return value
    }

    if (typeof defaultValue === 'boolean') {
      return defaultValue
    }

    return false
  }

  if (type === 'booleanNullable') {
    return typeof value === 'boolean' ? value : null
  }

  return value
}

export function normalizeConfigByTool(
  toolId: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (toolId === 'codex') {
    const executionMode = typeof config.execution_mode === 'string' ? config.execution_mode : ''

    if (executionMode !== 'standard') {
      return {
        ...config,
        sandbox: '',
      }
    }

    return config
  }

  if (toolId === 'claude-code' && config.dangerously_skip_permissions === true) {
    return {
      ...config,
      permission_mode: '',
    }
  }

  if (toolId === 'gemini-cli' && config.yolo === true) {
    return {
      ...config,
      approval_mode: '',
    }
  }

  return config
}

export function createConfigTemplate(toolId: string): Record<string, unknown> {
  const schema = TOOL_CONFIG_SCHEMAS[toolId]
  if (!schema) {
    return {}
  }

  return Object.entries(schema).reduce<Record<string, unknown>>((accumulator, [key, field]) => {
    accumulator[key] = sanitizeFieldByType(field.type, undefined, field.defaultValue)
    return accumulator
  }, {})
}

export function sanitizeConfigBySchema(
  toolId: string,
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const schema = TOOL_CONFIG_SCHEMAS[toolId]
  if (!schema) {
    return parsed
  }

  const sanitized = Object.entries(schema).reduce<Record<string, unknown>>(
    (accumulator, [key, field]) => {
      accumulator[key] = sanitizeFieldByType(field.type, parsed[key], field.defaultValue)
      return accumulator
    },
    {},
  )

  return normalizeConfigByTool(toolId, sanitized)
}

export const SECRET_FIELD_KEYS = new Set(['api_key', 'auth_token'])

export function isFieldWide(fieldKey: string, field: ConfigFieldSchema): boolean {
  return (
    field.type === 'stringArray' ||
    field.type === 'stringMap' ||
    (field.type === 'string' && Boolean(field.multiline)) ||
    SECRET_FIELD_KEYS.has(fieldKey)
  )
}

export function isSecretFieldKey(fieldKey: string): boolean {
  return SECRET_FIELD_KEYS.has(fieldKey)
}
