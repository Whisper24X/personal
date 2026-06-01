import type { SupportedCliToolId } from './blm-workflow-template.types'

export const DEFAULT_AGENT_TOOL_CONFIG_NAME = 'default'

export const SUPPORTED_CLI_TOOLS: Array<{ id: SupportedCliToolId; label: string }> = [
  { id: 'cursor-agent', label: 'Cursor Agent' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'opencode', label: 'Opencode' },
]
