export type NormalizedEntryType =
  | 'assistant_message'
  | 'user_message'
  | 'system_message'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'command_run'
  | 'file_edit'
  | 'file_read'
  | 'error'

export interface NormalizedEntry {
  id: string
  type: NormalizedEntryType
  timestamp: number
  content: string
  metadata?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
    toolUseId?: string
    status?: 'pending' | 'running' | 'success' | 'failed'
    filePath?: string
    command?: string
    exitCode?: number
    success?: boolean
    isResult?: boolean
    [key: string]: unknown
  }
}

export type RecordLike = Record<string, unknown>

export type RawParser = (
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string,
) => NormalizedEntry | NormalizedEntry[] | null
