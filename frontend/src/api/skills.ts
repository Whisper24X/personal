import type {
  CreateSkillPayload,
  ProjectLocalSkillResult,
  ProjectSkillProvider,
  Skill,
  SkillContent,
  UpdateSkillPayload,
} from '@/types/api/skills'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const skillsApi = {
  list(params?: { page?: number; limit?: number; keyword?: string; enabled?: boolean; projectId?: string }) {
    return apiHttp.get<InfinityPaginationResponse<Skill>>('/skills', {
      page: params?.page,
      limit: params?.limit,
      keyword: params?.keyword,
      enabled: params?.enabled,
      projectId: params?.projectId,
    })
  },

  detail(skillId: string) {
    return apiHttp.get<Skill>(`/skills/${skillId}`)
  },

  content(skillId: string, params: { projectId: string }) {
    return apiHttp.get<SkillContent>(`/skills/${skillId}/content`, {
      projectId: params.projectId,
    })
  },

  copyFromBusinessLine(payload: {
    projectId: string
    businessLineSkillId: string
    provider?: ProjectSkillProvider
  }) {
    return apiHttp.post<ProjectLocalSkillResult>('/skills/project/copy-from-business-line', payload)
  },

  uploadToProject(
    file: File,
    params: {
      projectId: string
      provider?: ProjectSkillProvider
    },
  ) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', params.projectId)
    if (params.provider) {
      formData.append('provider', params.provider)
    }
    return apiHttp.post<ProjectLocalSkillResult>('/skills/project/upload', formData)
  },

  create(payload: CreateSkillPayload) {
    return apiHttp.post<Skill>('/skills', payload)
  },

  update(skillId: string, payload: UpdateSkillPayload) {
    return apiHttp.patch<Skill>(`/skills/${skillId}`, payload)
  },

  remove(skillId: string) {
    return apiHttp.delete<void>(`/skills/${skillId}`)
  },
}
