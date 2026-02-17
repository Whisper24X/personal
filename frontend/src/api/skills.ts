import type { CreateSkillPayload, Skill, UpdateSkillPayload } from '@/types/api/skills'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const skillsApi = {
  list(params?: { page?: number; limit?: number; keyword?: string; enabled?: boolean }) {
    return apiHttp.get<InfinityPaginationResponse<Skill>>('/skills', {
      page: params?.page,
      limit: params?.limit,
      keyword: params?.keyword,
      enabled: params?.enabled,
    })
  },

  detail(skillId: string) {
    return apiHttp.get<Skill>(`/skills/${skillId}`)
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
