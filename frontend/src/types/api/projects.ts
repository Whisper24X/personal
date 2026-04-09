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

export type RunnerServiceConfig = {
  name: string
  workdir: string
  command: string
  port?: number
  env?: Record<string, string>
  installCommand?: string
  installCheckPath?: string
  priority?: number
  startsecs?: number
  startretries?: number
}

export type RunnerRouteConfig = {
  path: string
  action?: 'proxy' | 'redirect'
  match?: 'prefix' | 'exact' | 'regex'
  service?: string
  targetPort?: number
  upstreamPath?: string
  websocket?: boolean
  redirectTo?: string
  redirectCode?: number
}

export type RunnerHomepageConfig = {
  title?: string
  description?: string
  links?: Array<{
    label: string
    path: string
  }>
}

export type RunnerNamedVolumeConfig = {
  name: string
  target: string
}

export type RunnerPreviewConfig = {
  service: string
  path?: string
}

export type RunnerOrchestrationConfig = {
  services: RunnerServiceConfig[]
  routes?: RunnerRouteConfig[]
  homepage?: RunnerHomepageConfig
  sharedVolumes?: RunnerNamedVolumeConfig[]
  preview?: RunnerPreviewConfig
}

export type ProjectContainerRuntimeConfig = {
  env?: Record<string, string>
  runnerOrchestration?: RunnerOrchestrationConfig
}

export type ProjectMemberRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

export type ProjectMember = {
  id: string
  projectId: string
  userId: string
  roleId: string
  customRoleName?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ProjectCustomRole = {
  id: string
  businessLineId: string
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
  roleId: string
}

export type UpdateProjectMemberPayload = {
  roleId: string
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
