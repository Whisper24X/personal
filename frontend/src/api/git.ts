import type { GitBranches, GitPullMainResult } from '@/types/api/git'
import { apiHttp } from './http'

export const gitApi = {
  branches(projectId: string) {
    return apiHttp.get<GitBranches>('/git/branches', { projectId })
  },

  pullMain(projectId: string) {
    return apiHttp.post<GitPullMainResult>('/git/pull-main', { projectId })
  },
}
