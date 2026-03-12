import type { GitBranches, GitLog, GitPullMainResult, GitStatus } from '@/types/api/git'
import { apiHttp } from './http'

export const gitApi = {
  branches(projectId: string) {
    return apiHttp.get<GitBranches>('/git/branches', { projectId })
  },

  status(projectId: string) {
    return apiHttp.get<GitStatus>('/git/status', { projectId })
  },

  log(projectId: string) {
    return apiHttp.get<GitLog>('/git/log', { projectId })
  },

  pullMain(projectId: string) {
    return apiHttp.post<GitPullMainResult>('/git/pull-main', { projectId })
  },
}
