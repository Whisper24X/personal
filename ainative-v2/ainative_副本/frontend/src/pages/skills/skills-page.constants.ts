import type { ProjectSkillProvider } from '@/types/api/skills'

export const SKILLS_PAGE_LIMIT = 50
export const SKILLS_MAX_PAGE_COUNT = 20
export const SKILLS_PROJECT_PROVIDER_ORDER: ProjectSkillProvider[] = [
  'cursor',
  'gemini',
  'opencode',
  'claude',
  'codex',
]
export const SKILLS_PROJECT_PROVIDER_LABELS: Record<string, string> = {
  codex: 'Codex',
  cursor: 'Cursor',
  curso: 'Cursor',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  claude: 'Claude Code',
}
