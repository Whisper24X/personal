/** 任务创建 / 目标创建共用的 CLI 与标题区文案（避免跨 feature 互相引用） */

export type TaskCreateSupportedCliToolId =
  | 'claude-code'
  | 'codex'
  | 'gemini-cli'
  | 'cursor-agent'
  | 'opencode'

export const TASK_CREATE_SUPPORTED_CLI_TOOLS: Array<{
  id: TaskCreateSupportedCliToolId
  label: string
}> = [
  { id: 'cursor-agent', label: 'Cursor Agent' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'opencode', label: 'Opencode' },
]

export const TASK_CREATE_HEADLINES = [
  '我能为你做什么？',
  '告诉我目标，我来帮你推进。',
  '给我一句描述，我帮你拆解成可执行任务。',
  '从一个想法开始，把它落地成结果。',
  '想清楚方向后，剩下的交给我。',
  '输入你的需求，我们马上开始。',
]

export const TASK_HEADLINE_ROTATE_INTERVAL_MS = 30000

export const GOAL_CREATE_SELECT_PANEL_Z_INDEX = 130
export const GOAL_CREATE_SELECT_PANEL_PLACEMENT = 'top' as const
