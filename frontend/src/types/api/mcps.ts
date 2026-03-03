export type Mcp = {
  id: string
  name: string
  version: string
  description?: string | null
  provider?: string | null
  toolsCount: number
  configSchema?: Record<string, unknown> | null
  metadataJson?: Record<string, unknown> | null
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export type ProjectLocalMcpProvider =
  | 'cursor'
  | 'gemini'
  | 'opencode'
  | 'claude-code'
  | 'codex'

export type ProjectLocalMcpConfig = {
  name: string
  sourcePath: string
  config: Record<string, unknown>
}

export type ImportProjectLocalMcpsPayload = {
  projectId: string
  provider: ProjectLocalMcpProvider
  payload: Record<string, unknown>
}

export type ImportProjectLocalMcpsResult = {
  importedCount: number
  overwrittenCount: number
}

export type CreateMcpPayload = {
  name: string
  version: string
  description?: string
  provider?: string
  toolsCount?: number
  configSchema?: Record<string, unknown>
  metadataJson?: Record<string, unknown>
  enabled?: boolean
}

export type UpdateMcpPayload = Partial<CreateMcpPayload>
