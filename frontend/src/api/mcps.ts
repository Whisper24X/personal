import type {
  CreateMcpPayload,
  ImportProjectLocalMcpsPayload,
  ImportProjectLocalMcpsResult,
  LocalMcpProbeResult,
  Mcp,
  ProjectMcpOAuthCli,
  ProjectMcpOAuthLoginSession,
  ProjectMcpOAuthProvider,
  ProjectMcpOAuthRelayResult,
  ProjectLocalMcpConfig,
  UpdateMcpPayload,
} from '@/types/api/mcps'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const mcpsApi = {
  list(params?: {
    page?: number
    limit?: number
    keyword?: string
    enabled?: boolean
    projectId?: string
  }) {
    return apiHttp.get<InfinityPaginationResponse<Mcp>>('/mcps', {
      page: params?.page,
      limit: params?.limit,
      keyword: params?.keyword,
      enabled: params?.enabled,
      projectId: params?.projectId,
    })
  },

  detail(mcpId: string) {
    return apiHttp.get<Mcp>(`/mcps/${mcpId}`)
  },

  create(payload: CreateMcpPayload) {
    return apiHttp.post<Mcp>('/mcps', payload)
  },

  update(mcpId: string, payload: UpdateMcpPayload) {
    return apiHttp.patch<Mcp>(`/mcps/${mcpId}`, payload)
  },

  remove(mcpId: string) {
    return apiHttp.delete<void>(`/mcps/${mcpId}`)
  },

  getProjectLocalConfig(params: { projectId: string; name: string; sourcePath: string }) {
    return apiHttp.get<ProjectLocalMcpConfig>('/mcps/project-local/config', {
      projectId: params.projectId,
      name: params.name,
      sourcePath: params.sourcePath,
    })
  },

  testProjectLocalMcp(payload: {
    projectId: string
    name: string
    sourcePath: string
    agentToolConfigId: string
  }) {
    return apiHttp.post<LocalMcpProbeResult>('/mcps/project-local/test', payload)
  },

  importProjectLocalMcps(payload: ImportProjectLocalMcpsPayload) {
    return apiHttp.post<ImportProjectLocalMcpsResult>('/mcps/project-local/import-json', payload)
  },

  removeProjectLocalMcp(params: {
    projectId: string
    provider: string
    name: string
    sourcePath: string
  }) {
    const query = new URLSearchParams()
    query.set('projectId', params.projectId)
    query.set('provider', params.provider)
    query.set('name', params.name)
    query.set('sourcePath', params.sourcePath)
    return apiHttp.delete<void>(`/mcps/project-local?${query.toString()}`)
  },

  listProjectOAuthProviders(projectId: string) {
    return apiHttp.get<ProjectMcpOAuthProvider[]>('/mcps/project-oauth/providers', {
      projectId,
    })
  },

  startProjectOAuthLogin(payload: {
    projectId: string
    provider: string
    cli: ProjectMcpOAuthCli
  }) {
    return apiHttp.post<ProjectMcpOAuthLoginSession>(
      `/mcps/project-oauth/${payload.provider}/start-login`,
      {
        projectId: payload.projectId,
        cli: payload.cli,
      },
    )
  },

  relayProjectOAuthCallback(payload: {
    projectId: string
    provider: string
    sessionId: string
    callbackUrl: string
  }) {
    return apiHttp.post<ProjectMcpOAuthRelayResult>(
      `/mcps/project-oauth/${payload.provider}/relay-callback`,
      {
        projectId: payload.projectId,
        sessionId: payload.sessionId,
        callbackUrl: payload.callbackUrl,
      },
    )
  },
}
