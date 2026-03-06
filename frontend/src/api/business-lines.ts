import { apiHttp, type InfinityPaginationResponse } from './http'
import type { Skill, SkillContent, SkillFile, SkillTree } from '@/types/api/skills'
import type { Mcp } from '@/types/api/mcps'

export type BusinessLine = {
  id: string
  name: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export type BusinessLineMemberRole = 'owner' | 'admin' | 'member'

export type BusinessLineMember = {
  id: string
  businessLineId: string
  userId: string
  role: BusinessLineMemberRole
  createdAt?: string
  updatedAt?: string
}

export type CreateBusinessLinePayload = {
  name: string
  description?: string
}

export type UpdateBusinessLinePayload = Partial<CreateBusinessLinePayload>

export type CreateBusinessLineMemberPayload = {
  userId: string
  role: BusinessLineMemberRole
}

export type UpdateBusinessLineMemberPayload = {
  role: BusinessLineMemberRole
}

export type BusinessLineInviteProjectRole = 'none' | 'manage' | 'developer' | 'viewer'

export type CreateBusinessLineInvitePayload = {
  role: BusinessLineMemberRole
  projectRoles?: Record<string, BusinessLineInviteProjectRole>
}

export type BusinessLineInvite = {
  token: string
  expiresAt: string
  businessLineId: string
  role: BusinessLineMemberRole
  projectRoles: Record<string, BusinessLineInviteProjectRole>
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

  create(payload: CreateBusinessLinePayload) {
    return apiHttp.post<BusinessLine>('/business-lines', payload)
  },

  update(businessLineId: string, payload: UpdateBusinessLinePayload) {
    return apiHttp.patch<BusinessLine>(`/business-lines/${businessLineId}`, payload)
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

  updateMember(businessLineId: string, userId: string, payload: UpdateBusinessLineMemberPayload) {
    return apiHttp.patch<BusinessLineMember>(
      `/business-lines/${businessLineId}/members/${userId}`,
      payload,
    )
  },

  removeMember(businessLineId: string, userId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/members/${userId}`)
  },

  listAgentToolConfigs(businessLineId: string, params?: { toolId?: string }) {
    return apiHttp.get<AgentToolConfig[]>(`/business-lines/${businessLineId}/agent-tool-configs`, {
      toolId: params?.toolId,
    })
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

  listLocalSkills(businessLineId: string, params?: { keyword?: string }) {
    return apiHttp.get<Skill[]>(`/business-lines/${businessLineId}/local-skills`, {
      keyword: params?.keyword,
    })
  },

  removeLocalSkill(businessLineId: string, skillId: string) {
    return apiHttp.delete<void>(`/business-lines/${businessLineId}/local-skills/${skillId}`)
  },

  localSkillContent(businessLineId: string, skillId: string) {
    return apiHttp.get<SkillContent>(
      `/business-lines/${businessLineId}/local-skills/${skillId}/content`,
    )
  },

  localSkillTree(businessLineId: string, skillId: string) {
    return apiHttp.get<SkillTree>(
      `/business-lines/${businessLineId}/local-skills/${skillId}/tree`,
    )
  },

  localSkillFile(businessLineId: string, skillId: string, filePath: string) {
    return apiHttp.get<SkillFile>(
      `/business-lines/${businessLineId}/local-skills/${skillId}/file`,
      { path: filePath },
    )
  },

  uploadLocalSkill(businessLineId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return apiHttp.post<UploadLocalSkillResult>(
      `/business-lines/${businessLineId}/local-skills/upload`,
      formData,
    )
  },

  listLocalMcps(businessLineId: string) {
    return apiHttp.get<Mcp[]>(`/business-lines/${businessLineId}/local-mcps`)
  },

  createLocalMcp(businessLineId: string, payload: CreateLocalMcpPayload) {
    return apiHttp.post<Mcp>(`/business-lines/${businessLineId}/local-mcps`, payload)
  },

  importLocalMcps(businessLineId: string, payload: ImportLocalMcpsPayload) {
    return apiHttp.post<ImportLocalMcpsResult>(
      `/business-lines/${businessLineId}/local-mcps/import-json`,
      payload,
    )
  },

  getLocalMcpConfig(businessLineId: string, params: { name: string; sourcePath: string }) {
    return apiHttp.get<LocalMcpConfig>(`/business-lines/${businessLineId}/local-mcps/config`, {
      name: params.name,
      sourcePath: params.sourcePath,
    })
  },

  removeLocalMcp(businessLineId: string, params: { name: string; sourcePath: string }) {
    const query = new URLSearchParams()
    query.set('name', params.name)
    query.set('sourcePath', params.sourcePath)
    return apiHttp.delete<void>(
      `/business-lines/${businessLineId}/local-mcps?${query.toString()}`,
    )
  },
}
