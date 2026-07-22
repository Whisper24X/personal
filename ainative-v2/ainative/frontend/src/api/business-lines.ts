import { apiHttp, type InfinityPaginationResponse } from './http'
import type { Skill, SkillContent, SkillFile, SkillTree } from '@/types/api/skills'
import type { Mcp } from '@/types/api/mcps'
import type {
  CreateProjectCustomRolePayload,
  ProjectCustomRole,
  UpdateProjectCustomRolePayload,
} from '@/types/api/projects'

export type SubRepoConfig = {
  url: string
  prefix: string
  branch: string
}

export type BusinessLineConfigJson = {
  subRepos?: SubRepoConfig[]
  runnerFingerprint?: string
  runnerConfigStatus?: RunnerConfigStatus
  runnerConfigError?: string
  runnerConfigUpdatedAt?: string
  runnerGeneratedAt?: string
  runnerConfigCache?: Record<string, unknown>
  runnerConfigCacheMeta?: RunnerConfigCacheMeta
  runnerLastAttemptedFingerprint?: string
  runnerLastAttemptedAt?: string
}

export type RunnerConfigStatus =
  | 'pending'
  | 'ready'
  | 'generated'
  | 'verifying'
  | 'needsManualReview'
  | 'failed'
  | 'partial'

export type RunnerConfigCacheMeta = {
  source?: 'ai' | 'fallback' | 'ai-full-scan'
  generatedAt?: string
  discoveredRepoPrefixes?: string[]
  selectedRepoPrefixes?: string[]
  notAutoStartedRepoPrefixes?: string[]
  omittedRepoPrefixes?: string[]
  omissionReasonsByRepo?: Record<string, string[]>
  autoStartLimited?: boolean
  factsTruncated?: boolean
  truncatedPrefixes?: string[]
  analysisWarnings?: string[]
  generatorToolId?: string
  generatorConfigId?: string
  inputFingerprint?: string
  partial?: boolean
  probeStatus?: 'passed' | 'failed' | 'skipped'
  probeMode?: 'off' | 'warn' | 'required'
  probeError?: string
  probeDurationMs?: number
  routeProbeResults?: RunnerRouteProbeResult[]
  probeRepaired?: boolean
  probeRepairSummary?: string
  fullScanAttempted?: boolean
  fullScanError?: string
  fullScanReasoning?: string
  fullScanEvidenceBytes?: number
  verificationId?: string
  verificationStatus?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  verificationStartedAt?: string
  verificationFinishedAt?: string
  verificationDurationMs?: number
  verificationError?: string
  verificationLogsPreview?: string
}

export type RunnerRouteProbeResult = {
  path: string
  service?: string
  port?: number
  status: 'passed' | 'failed' | 'skipped'
  statusCode?: number
  failureKind?: string
  error?: string
}

export type RunnerStatusSummary = {
  status: RunnerConfigStatus | 'unknown'
  statusLabel: string
  source?: RunnerConfigCacheMeta['source']
  error?: string
  updatedAt?: string
  generatedAt?: string
  fingerprint?: string
  verificationStatus?: RunnerConfigCacheMeta['verificationStatus']
  verificationDurationMs?: number
  verificationError?: string
  verificationLogsPreview?: string
  probeStatus?: RunnerConfigCacheMeta['probeStatus']
  probeMode?: RunnerConfigCacheMeta['probeMode']
  probeError?: string
  probeDurationMs?: number
  routeProbeResults?: RunnerRouteProbeResult[]
  probeRepaired?: boolean
  probeRepairSummary?: string
  fullScanAttempted?: boolean
  fullScanError?: string
  fullScanReasoning?: string
  fullScanEvidenceBytes?: number
  warningCount: number
  latestWarning?: string
  verifiedReady: boolean
}

export type BusinessLine = {
  id: string
  name: string
  slug: string
  description?: string | null
  defaultAgentCliToolId?: string | null
  configJson?: BusinessLineConfigJson | null
  createdAt?: string
  updatedAt?: string
}

export type BusinessLineMemberRole = 'owner' | 'admin' | 'member'

export type BusinessLineMember = {
  id: string
  businessLineId: string
  userId: string
  roleId: string
  customRoleName?: string | null
  createdAt?: string
  updatedAt?: string
}

export type CreateBusinessLinePayload = {
  name: string
  slug: string
  description?: string
  configJson?: BusinessLineConfigJson
}

export type UpdateBusinessLinePayload = Partial<CreateBusinessLinePayload>

export type UpdateDefaultAgentCliToolPayload = {
  defaultAgentCliToolId: string | null
}

export type CreateBusinessLineMemberPayload = {
  userId: string
  roleId: string
}

export type UpdateBusinessLineMemberPayload = {
  roleId: string
  projectRoles?: Record<string, string>
}

export type BusinessLineInviteProjectRole = 'none' | 'manage' | 'developer' | 'viewer'

export type CreateBusinessLineInvitePayload = {
  roleId: string
  projectRoles?: Record<string, BusinessLineInviteProjectRole>
}

export type BusinessLineMemberProjectRoles = {
  projectRoles: Record<string, string>
}

export type BusinessLineInvite = {
  token: string
  expiresAt: string
  businessLineId: string
  roleId: string
  projectRoles: Record<string, BusinessLineInviteProjectRole>
  customRoleName?: string | null
}

export type AcceptBusinessLineInvitePayload = {
  token: string
}

export type AcceptBusinessLineInviteResponse = {
  member: BusinessLineMember
  failedProjects: string[]
}

export type AgentToolConfig = {
  id: string
  businessLineId: string
  toolId: string
  name: string
  description?: string | null
  configJson: Record<string, unknown>
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type AgentToolConfigSmokeTestResult = {
  ok: boolean
  exitCode: number | null
  command: string
  args: string[]
  stdoutPreview?: string
  stderrPreview?: string
  errorCode?: 'ENOENT' | 'TIMEOUT' | 'NON_ZERO' | 'SPAWN_ERROR' | 'AUTH_ERROR'
}

export type BusinessLineCustomRole = {
  id: string
  businessLineId: string
  name: string
  description?: string | null
  capabilities: string[]
  createdAt: string
  updatedAt: string
}

export type CreateBusinessLineCustomRolePayload = {
  name: string
  description?: string
  capabilities: string[]
}

export type UpdateBusinessLineCustomRolePayload = Partial<CreateBusinessLineCustomRolePayload>

export type CreateAgentToolConfigPayload = {
  toolId: string
  name: string
  description?: string
  configJson: Record<string, unknown>
  isDefault?: boolean
}

export type UpdateAgentToolConfigPayload = Partial<CreateAgentToolConfigPayload>

export type UploadLocalSkillResult = {
  name: string
  description?: string | null
  directoryName: string
}

export type LocalMcpTransportType = 'stdio' | 'http' | 'sse'

export type CreateLocalMcpPayload = {
  name: string
  transportType: LocalMcpTransportType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export type ImportLocalMcpsPayload = {
  payload: Record<string, unknown>
}

export type ImportLocalMcpsResult = {
  importedCount: number
  overwrittenCount: number
}

export type LocalMcpConfig = {
  name: string
  sourcePath: string
  config: Record<string, unknown>
}

export const businessLinesApi = {
  list(params?: { page?: number; limit?: number }) {
    return apiHttp.get<InfinityPaginationResponse<BusinessLine>>('/business-lines', {
      page: params?.page,
      limit: params?.limit,
    })
  },

  detail(businessLineId: string) {
    return apiHttp.get<BusinessLine>(`/business-lines/${businessLineId}`)
  },

  runnerStatus(businessLineId: string) {
    return apiHttp.get<RunnerStatusSummary>(`/business-lines/${businessLineId}/runner-status`)
  },

  create(payload: CreateBusinessLinePayload) {
    return apiHttp.post<BusinessLine>('/business-lines', payload)
  },

  update(businessLineId: string, payload: UpdateBusinessLinePayload) {
    return apiHttp.patch<BusinessLine>(`/business-lines/${businessLineId}`, payload)
  },

  updateDefaultAgentCliTool(
    businessLineId: string,
    payload: UpdateDefaultAgentCliToolPayload,
  ) {
    return apiHttp.patch<BusinessLine>(
      `/business-lines/${businessLineId}/agent-cli/default-tool`,
      payload,
    )
  },

  remove(businessLineId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}`)
  },

  listMembers(businessLineId: string) {
    return apiHttp.get<BusinessLineMember[]>(`/business-lines/${businessLineId}/members`)
  },

  addMember(businessLineId: string, payload: CreateBusinessLineMemberPayload) {
    return apiHttp.post<BusinessLineMember>(`/business-lines/${businessLineId}/members`, payload)
  },

  createInvitation(businessLineId: string, payload: CreateBusinessLineInvitePayload) {
    return apiHttp.post<BusinessLineInvite>(
      `/business-lines/${businessLineId}/invitations`,
      payload,
    )
  },

  getLatestInvitation(businessLineId: string) {
    return apiHttp.get<BusinessLineInvite | null>(
      `/business-lines/${businessLineId}/invitations/latest`,
    )
  },

  acceptInvitation(payload: AcceptBusinessLineInvitePayload) {
    return apiHttp.post<AcceptBusinessLineInviteResponse>(
      '/business-lines/invitations/accept',
      payload,
    )
  },

  getMemberProjectRoles(businessLineId: string, userId: string) {
    return apiHttp.get<BusinessLineMemberProjectRoles>(
      `/business-lines/${businessLineId}/members/${userId}/project-roles`,
    )
  },

  updateMember(businessLineId: string, userId: string, payload: UpdateBusinessLineMemberPayload) {
    return apiHttp.patch<BusinessLineMember>(
      `/business-lines/${businessLineId}/members/${userId}`,
      payload,
    )
  },

  removeMember(businessLineId: string, userId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/members/${userId}`)
  },

  listCustomRoles(businessLineId: string) {
    return apiHttp.get<BusinessLineCustomRole[]>(`/business-lines/${businessLineId}/custom-roles`)
  },

  listCustomRoleLibrary(businessLineId: string) {
    return apiHttp.get<BusinessLineCustomRole[]>(
      `/business-lines/${businessLineId}/custom-role-library`,
    )
  },

  createCustomRole(businessLineId: string, payload: CreateBusinessLineCustomRolePayload) {
    return apiHttp.post<BusinessLineCustomRole>(
      `/business-lines/${businessLineId}/custom-roles`,
      payload,
    )
  },

  updateCustomRole(
    businessLineId: string,
    roleId: string,
    payload: UpdateBusinessLineCustomRolePayload,
  ) {
    return apiHttp.patch<BusinessLineCustomRole>(
      `/business-lines/${businessLineId}/custom-roles/${roleId}`,
      payload,
    )
  },

  removeCustomRole(businessLineId: string, roleId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/custom-roles/${roleId}`)
  },

  listProjectCustomRoles(businessLineId: string) {
    return apiHttp.get<ProjectCustomRole[]>(
      `/business-lines/${businessLineId}/project-custom-roles`,
    )
  },

  createProjectCustomRole(businessLineId: string, payload: CreateProjectCustomRolePayload) {
    return apiHttp.post<ProjectCustomRole>(
      `/business-lines/${businessLineId}/project-custom-roles`,
      payload,
    )
  },

  updateProjectCustomRole(
    businessLineId: string,
    roleId: string,
    payload: UpdateProjectCustomRolePayload,
  ) {
    return apiHttp.patch<ProjectCustomRole>(
      `/business-lines/${businessLineId}/project-custom-roles/${roleId}`,
      payload,
    )
  },

  removeProjectCustomRole(businessLineId: string, roleId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/project-custom-roles/${roleId}`)
  },

  listAgentToolConfigs(businessLineId: string, params?: { toolId?: string }) {
    return apiHttp.get<AgentToolConfig[]>(
      `/business-lines/${businessLineId}/agent-tool-configs`,
      params,
    )
  },

  createAgentToolConfig(businessLineId: string, payload: CreateAgentToolConfigPayload) {
    return apiHttp.post<AgentToolConfig>(
      `/business-lines/${businessLineId}/agent-tool-configs`,
      payload,
    )
  },

  updateAgentToolConfig(
    businessLineId: string,
    configId: string,
    payload: UpdateAgentToolConfigPayload,
  ) {
    return apiHttp.patch<AgentToolConfig>(
      `/business-lines/${businessLineId}/agent-tool-configs/${configId}`,
      payload,
    )
  },

  removeAgentToolConfig(businessLineId: string, configId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/agent-tool-configs/${configId}`)
  },

  testAgentToolConfig(businessLineId: string, configId: string) {
    return apiHttp.post<AgentToolConfigSmokeTestResult>(
      `/business-lines/${businessLineId}/agent-tool-configs/${configId}/test`,
    )
  },

  listLocalSkills(businessLineId: string, params?: { keyword?: string }) {
    return apiHttp.get<Skill[]>(`/business-lines/${businessLineId}/local-skills`, params)
  },

  uploadLocalSkill(businessLineId: string, file: File | FormData) {
    const formData =
      file instanceof FormData
        ? file
        : (() => {
            const nextFormData = new FormData()
            nextFormData.append('file', file)
            return nextFormData
          })()
    return apiHttp.post<UploadLocalSkillResult>(
      `/business-lines/${businessLineId}/local-skills/upload`,
      formData,
    )
  },

  getLocalSkillTree(businessLineId: string, skillName: string) {
    return apiHttp.get<SkillTree>(
      `/business-lines/${businessLineId}/local-skills/${encodeURIComponent(skillName)}/tree`,
    )
  },

  getLocalSkillContent(businessLineId: string, skillName: string, relativePath: string) {
    return apiHttp.get<SkillContent>(
      `/business-lines/${businessLineId}/local-skills/${encodeURIComponent(skillName)}/content`,
      { relativePath },
    )
  },

  removeLocalSkill(businessLineId: string, skillName: string) {
    return apiHttp.delete<void>(
      `/business-lines/${businessLineId}/local-skills/${encodeURIComponent(skillName)}`,
    )
  },

  localSkillTree(businessLineId: string, skillName: string) {
    return apiHttp.get<SkillTree>(
      `/business-lines/${businessLineId}/local-skills/${encodeURIComponent(skillName)}/tree`,
    )
  },

  localSkillFile(businessLineId: string, skillName: string, path: string) {
    return apiHttp.get<SkillFile>(
      `/business-lines/${businessLineId}/local-skills/${encodeURIComponent(skillName)}/content`,
      { relativePath: path },
    )
  },

  listLocalMcps(businessLineId: string) {
    return apiHttp.get<Mcp[]>(`/business-lines/${businessLineId}/local-mcps`)
  },

  importLocalMcps(businessLineId: string, payload: ImportLocalMcpsPayload) {
    return apiHttp.post<ImportLocalMcpsResult>(
      `/business-lines/${businessLineId}/local-mcps/import-json`,
      payload,
    )
  },

  getLocalMcpConfig(businessLineId: string, params: { name: string; sourcePath?: string }) {
    return apiHttp.get<LocalMcpConfig>(`/business-lines/${businessLineId}/local-mcps/config`, {
      name: params.name,
      sourcePath: params.sourcePath,
    })
  },

  createLocalMcp(businessLineId: string, payload: CreateLocalMcpPayload) {
    return apiHttp.post<Mcp>(`/business-lines/${businessLineId}/local-mcps`, payload)
  },

  removeLocalMcp(businessLineId: string, params: { name: string; sourcePath: string }) {
    const query = new URLSearchParams()
    query.set('name', params.name)
    query.set('sourcePath', params.sourcePath)
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/local-mcps?${query.toString()}`)
  },

  getWorkspaceProject(businessLineId: string) {
    return apiHttp.get<{
      projectId: string | null
      enabled: boolean
      businessLineId?: string
      name?: string
      description?: string | null
      gitUrl?: string
      defaultBranch?: string
      repositoryProvisioningStatus?: string | null
      repositoryProvisioningError?: string | null
      repositoryProvisionedAt?: string | null
      configJson?: Record<string, unknown> | null
    }>(`/business-lines/${businessLineId}/workspace-project`)
  },
}
