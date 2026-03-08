export type Project = {
  id: string
  businessLineId: string
  name: string
  description?: string | null
  gitUrl: string
  defaultBranch: string
  configJson?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
}

export type ProjectMemberRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

export type ProjectMember = {
  id: string
  projectId: string
  userId: string
  role: string
  customRoleName?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ProjectCustomRole = {
  id: string
  businessLineId: string
  code: string
  name: string
  description?: string | null
  capabilities: string[]
  createdAt: string
  updatedAt: string
}

export type CreateProjectPayload = {
  businessLineId: string
  name: string
  description?: string
  gitUrl: string
  defaultBranch?: string
  configJson?: Record<string, unknown>
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>

export type CreateProjectMemberPayload = {
  userId: string
  role: string
}

export type UpdateProjectMemberPayload = {
  role: string
}

export type InspectProjectRepositoryPayload = {
  businessLineId: string
  gitUrl: string
}

export type ProjectRepositoryInspection = {
  repoName: string
  branches: string[]
  recommendedDefaultBranch: string | null
}

export type CreateProjectCustomRolePayload = {
  name: string
  description?: string
  capabilities: string[]
}

export type UpdateProjectCustomRolePayload = Partial<CreateProjectCustomRolePayload>
