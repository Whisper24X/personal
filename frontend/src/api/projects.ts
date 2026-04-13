import type { ProjectContext } from '@/types/api/project-context'
import type {
  ProjectDocContent,
  ProjectDocItem,
  ProjectDocsPreview,
  ProjectDocsTree,
  QueryProjectDocsPayload,
  QueryProjectDocsResponse,
  SaveProjectDocPayload,
} from '@/types/api/project-docs'
import type {
  CreateProjectMemberPayload,
  CreateProjectPayload,
  InspectProjectRepositoryPayload,
  Project,
  ProjectRepositoryInspection,
  ProjectCustomRole,
  ProjectMember,
  UpdateProjectMemberPayload,
  UpdateProjectPayload,
  CreateProjectCustomRolePayload,
  UpdateProjectCustomRolePayload,
} from '@/types/api/projects'
import {
  apiHttp,
  buildUrl,
  openSseStream,
  postSseStream,
  type InfinityPaginationResponse,
  type SseCallbacks,
} from './http'
import { STORAGE_KEYS } from '@shared/types/common/storage'

export const projectsApi = {
  list(params?: { page?: number; limit?: number; businessLineId?: string; keyword?: string }) {
    return apiHttp.get<InfinityPaginationResponse<Project>>('/projects', {
      page: params?.page,
      limit: params?.limit,
      businessLineId: params?.businessLineId,
      keyword: params?.keyword,
    })
  },

  detail(projectId: string) {
    return apiHttp.get<Project>(`/projects/${projectId}`)
  },

  context(projectId: string) {
    return apiHttp.get<ProjectContext>(`/projects/${projectId}/context`)
  },

  create(payload: CreateProjectPayload) {
    return apiHttp.post<Project>('/projects', payload)
  },

  inspectRepository(payload: InspectProjectRepositoryPayload) {
    return apiHttp.post<ProjectRepositoryInspection>('/projects/inspect-repository', payload)
  },

  update(projectId: string, payload: UpdateProjectPayload) {
    return apiHttp.patch<Project>(`/projects/${projectId}`, payload)
  },

  remove(projectId: string) {
    return apiHttp.delete<void>(`/projects/${projectId}`)
  },

  listMembers(projectId: string) {
    return apiHttp.get<ProjectMember[]>(`/projects/${projectId}/members`)
  },

  addMember(projectId: string, payload: CreateProjectMemberPayload) {
    return apiHttp.post<ProjectMember>(`/projects/${projectId}/members`, payload)
  },

  updateMember(projectId: string, userId: string, payload: UpdateProjectMemberPayload) {
    return apiHttp.patch<ProjectMember>(`/projects/${projectId}/members/${userId}`, payload)
  },

  removeMember(projectId: string, userId: string) {
    return apiHttp.delete<void>(`/projects/${projectId}/members/${userId}`)
  },

  listCustomRoles(projectId: string) {
    return apiHttp.get<ProjectCustomRole[]>(`/projects/${projectId}/custom-roles`)
  },

  listCustomRoleLibrary(projectId: string) {
    return apiHttp.get<ProjectCustomRole[]>(`/projects/${projectId}/custom-role-library`)
  },

  createCustomRole(projectId: string, payload: CreateProjectCustomRolePayload) {
    return apiHttp.post<ProjectCustomRole>(`/projects/${projectId}/custom-roles`, payload)
  },

  updateCustomRole(projectId: string, roleId: string, payload: UpdateProjectCustomRolePayload) {
    return apiHttp.patch<ProjectCustomRole>(
      `/projects/${projectId}/custom-roles/${roleId}`,
      payload,
    )
  },

  removeCustomRole(projectId: string, roleId: string) {
    return apiHttp.delete<void>(`/projects/${projectId}/custom-roles/${roleId}`)
  },

  listDocs(projectId: string) {
    return apiHttp.get<ProjectDocItem[]>(`/projects/${projectId}/docs`)
  },

  docsTree(projectId: string, params?: { path?: string }) {
    return apiHttp.get<ProjectDocsTree>(`/projects/${projectId}/docs/tree`, {
      path: params?.path,
    })
  },

  
  getDocsFileRawUrl(projectId: string, path: string) {
    const token = localStorage.getItem(STORAGE_KEYS.authToken)
    return buildUrl(`/projects/${projectId}/docs/file/raw`, { path, token }).toString()
  },
  docsPreview(projectId: string, path: string) {
    return apiHttp.get<ProjectDocsPreview>(`/projects/${projectId}/docs/preview`, {
      path,
    })
  },

  readDoc(projectId: string, path: string) {
    return apiHttp.get<ProjectDocContent>(`/projects/${projectId}/docs/content`, {
      path,
    })
  },

  createDoc(projectId: string, payload: SaveProjectDocPayload) {
    return apiHttp.post<ProjectDocContent>(`/projects/${projectId}/docs`, payload)
  },

  /** Binary upload (multipart); upserts without JSON/base64 body size issues */
  uploadDoc(projectId: string, formData: FormData) {
    return apiHttp.post<ProjectDocContent>(`/projects/${projectId}/docs/upload`, formData)
  },

  updateDoc(projectId: string, payload: SaveProjectDocPayload) {
    return apiHttp.patch<ProjectDocContent>(`/projects/${projectId}/docs`, payload)
  },

  removeDoc(projectId: string, path: string) {
    return apiHttp.delete<void>(`/projects/${projectId}/docs?path=${encodeURIComponent(path)}`)
  },

  queryDocs(projectId: string, payload: QueryProjectDocsPayload) {
    return apiHttp.post<QueryProjectDocsResponse>(`/projects/${projectId}/docs/query`, payload)
  },

  /**
   * SSE: chunk / citations / error / done. Use `post` for long instructions or revise_current_doc.
   */
  queryDocsStream(
    projectId: string,
    payload: QueryProjectDocsPayload,
    callbacks: SseCallbacks,
    method: 'get' | 'post' = 'get',
  ) {
    const path = `/projects/${projectId}/docs/query/stream`
    const body = {
      question: payload.question,
      scope: payload.scope,
      currentPath: payload.currentPath,
      maxContextDocs: payload.maxContextDocs,
      mode: payload.mode,
    }
    if (method === 'post') {
      return postSseStream(path, body, callbacks)
    }
    return openSseStream(path, body, callbacks)
  },

  getDeployInfo(projectId: string, taskId: string) {
    return apiHttp.get<{ featureBranch: string | null }>(`/projects/${projectId}/deploy-info`, { taskId })
  },

  deploy(projectId: string, taskId: string, command: string, callbacks: SseCallbacks) {
    return postSseStream(`/projects/${projectId}/deploy`, { taskId, command }, callbacks)
  },
}
