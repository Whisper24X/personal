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

export type ProjectLocalMcpProvider = 'cursor' | 'gemini' | 'opencode' | 'claude-code' | 'codex'

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

export type LocalMcpProbeResult = {
  ok: boolean
  transport?: 'stdio' | 'http' | 'sse'
  toolsCount?: number
  errorCode?: string
  message?: string
  stderrPreview?: string
  warnings?: string[]
}

export type ProjectMcpOAuthCli = 'codex' | 'claude' | 'cursor'

export type ProjectMcpOAuthCliState = {
  cli: ProjectMcpOAuthCli
  status: 'connected' | 'disconnected' | 'pending' | 'error'
  lastLoginAt?: string | null
}

export type ProjectMcpOAuthProvider = {
  provider: string
  displayName: string
  upstreamMcpUrl: string
  status: 'connected' | 'disconnected' | 'pending' | 'error'
  hint?: string | null
  lastError?: string | null
  cliStates: ProjectMcpOAuthCliState[]
}

export type ProjectMcpOAuthLoginSession = {
  sessionId: string
  provider: string
  cli: ProjectMcpOAuthCli
  status: 'pending' | 'relayed' | 'succeeded' | 'failed' | 'timed_out'
  authorizationUrl?: string | null
  errorMessage?: string | null
  expiresAt: string
}

export type ProjectMcpOAuthRelayResult = {
  ok: boolean
  status: 'relayed' | 'succeeded' | 'failed'
  message?: string | null
}
