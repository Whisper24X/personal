import type { ProjectLocalMcpProvider } from '@/types/api/mcps'

export const MCP_PAGE_LIMIT = 50
export const MCP_MAX_PAGE_COUNT = 20
export const MCP_PROJECT_PROVIDER_ORDER = ['cursor', 'gemini', 'opencode', 'claude-code', 'codex']
export const MCP_PROVIDER_LABEL_MAP: Record<string, string> = {
  cursor: 'Cursor',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  'claude-code': 'Claude Code',
  codex: 'Codex',
}
export const MCP_EDITABLE_PROVIDER_SET = new Set<ProjectLocalMcpProvider>([
  'cursor',
  'gemini',
  'opencode',
  'claude-code',
  'codex',
])
