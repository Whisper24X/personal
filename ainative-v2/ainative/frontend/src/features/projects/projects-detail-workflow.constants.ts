import type { ProjectDetailSupportedCliToolId } from './projects-detail-workflow.types'

export const PROJECT_DETAIL_SUPPORTED_CLI_TOOLS: Array<{
  id: ProjectDetailSupportedCliToolId
  label: string
}> = [
  { id: 'cursor-agent', label: 'Cursor Agent' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'opencode', label: 'Opencode' },
]

export { WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX as PROJECT_WORKFLOW_SELECT_PANEL_Z_INDEX } from '@features/workflow'
