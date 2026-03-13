import type { GitBranches, GitBranchesDetail, GitChangedFiles, GitCheckoutResult, GitCommitDetail, GitCreateBranchResult, GitDeleteBranchResult, GitLog, GitLogPaginated, GitPullMainResult, GitPushResult, GitStatus } from '@/types/api/git'
import { apiHttp } from './http'

export const gitApi = {
  branches(projectId: string) {
    return apiHttp.get<GitBranches>('/git/branches', { projectId })
  },

  branchesDetail(projectId: string) {
    return apiHttp.get<GitBranchesDetail>('/git/branches-detail', { projectId })
  },

  status(projectId: string) {
    return apiHttp.get<GitStatus>('/git/status', { projectId })
  },

  log(projectId: string, params?: { limit?: number; offset?: number }) {
    return apiHttp.get<GitLog>('/git/log', { projectId, ...params })
  },

  logPaginated(projectId: string, params: { limit: number; offset: number }) {
    return apiHttp.get<GitLogPaginated>('/git/log', { projectId, ...params })
  },

  pullMain(projectId: string) {
    return apiHttp.post<GitPullMainResult>('/git/pull-main', { projectId })
  },

  changedFiles(projectId: string) {
    return apiHttp.get<GitChangedFiles>('/git/changed-files', { projectId })
  },

  push(projectId: string, branch?: string) {
    return apiHttp.post<GitPushResult>('/git/push', { projectId, branch })
  },

  commitDetail(projectId: string, sha: string) {
    return apiHttp.get<GitCommitDetail>(`/git/commit/${sha}`, { projectId })
  },

  checkout(projectId: string, branch: string) {
    return apiHttp.post<GitCheckoutResult>('/git/checkout', { projectId, branch })
  },

  createBranch(projectId: string, name: string, from?: string) {
    return apiHttp.post<GitCreateBranchResult>('/git/create-branch', { projectId, name, from })
  },

  deleteBranch(projectId: string, branch: string, remote?: boolean) {
    const params = new URLSearchParams({ projectId, branch })
    if (remote !== undefined) params.append('remote', String(remote))
    return apiHttp.delete<GitDeleteBranchResult>(`/git/delete-branch?${params.toString()}`)
  },

  pullBranch(projectId: string, branch: string) {
    return apiHttp.post<GitPushResult>('/git/pull-branch', { projectId, branch })
  },

  pushBranch(projectId: string, branch: string) {
    return apiHttp.post<GitPushResult>('/git/push-branch', { projectId, branch })
  },
}
