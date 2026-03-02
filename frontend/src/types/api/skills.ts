export type Skill = {
  id: string
  name: string
  version: string
  description?: string | null
  scope?: string | null
  homepageUrl?: string | null
  metadataJson?: Record<string, unknown> | null
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export type CreateSkillPayload = {
  name: string
  version: string
  description?: string
  scope?: string
  homepageUrl?: string
  metadataJson?: Record<string, unknown>
  enabled?: boolean
}

export type UpdateSkillPayload = Partial<CreateSkillPayload>

export type SkillContent = {
  id: string
  name: string
  content: string
}

export type ProjectSkillProvider = 'codex' | 'cursor' | 'curso'

export type ProjectLocalSkillResult = {
  name: string
  description?: string | null
  directoryName: string
  provider: ProjectSkillProvider
}
