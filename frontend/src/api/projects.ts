import type { ProjectContext } from '@/types/api/project-context'
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
import { apiHttp, type InfinityPaginationResponse } from './http'

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
}
