export type Project = {
  id: string
  businessLineId: string
  name: string
  slug: string
  description?: string | null
  gitUrl: string
  defaultBranch: string
  repositoryProvisioningStatus?: 'pending' | 'ready' | 'failed'
  repositoryProvisioningError?: string | null
  repositoryProvisionedAt?: string | null
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
  slug: string
  description?: string
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

export type DatabaseIsolationConfig = {
  enabled: boolean
  postgres: {
    host: string
    port: number
    adminUser: string
    sourceDatabase: string
  }
  envVar: string
  dataImport?: {
    tables: string[]
  }
}

export type DatabaseIsolationTableInfo = {
  name: string
  estimatedRows: number
  sizeBytes: number
}

export type SubtreeDeployItemStatus = 'pending' | 'pushing' | 'success' | 'failed' | 'skipped'

export type SubtreeDeployItem = {
  prefix: string
  targetBranch: string
  sourceCommitSha: string
  status: SubtreeDeployItemStatus
  attempts: number
  error?: string
  skippedReason?: 'no_changes'
  pushedAt?: string
}

export type SubtreeDeployStatus = {
  snapshotEpoch: string
  deployCommitSha?: string
  cleanupCommitSha?: string
  updatedAt: string
  subtrees: SubtreeDeployItem[]
  mainRepoPushed: boolean
}

export type ProjectRunnerRegenerateResponse = {
  accepted: true
  projectId: string
  queuedAt: string
}
