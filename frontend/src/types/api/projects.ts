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

export type ProjectMember = {
  id: string
  projectId: string
  userId: string
  role: 'owner' | 'maintainer' | 'developer' | 'viewer'
  createdAt?: string
  updatedAt?: string
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
  role: ProjectMember['role']
}

export type UpdateProjectMemberPayload = {
  role: ProjectMember['role']
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
