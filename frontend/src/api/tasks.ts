import type {
  ApproveTaskPayload,
  CreateTaskArtifactPayload,
  CreateTaskPayload,
  CreateTaskTerminalSessionPayload,
  ReplyTaskPayload,
  RetryTaskPayload,
  Task,
  TaskArtifact,
  TaskDetail,
  TaskGitActionResult,
  TaskGitBaseBranchPayload,
  TaskGitBranchDiffFiles,
  TaskGitCommitPayload,
  TaskGitDiff,
  TaskGitFilesPayload,
  TaskGitPrLink,
  TaskGitStatus,
  TaskLog,
  TaskMessage,
  TaskTerminalInputPayload,
  TaskTerminalSession,
  TaskTerminalSessionList,
  TaskWorkspaceFile,
  TaskWorkspacePreview,
  TaskWorkspaceTree,
  UpdateTaskPayload,
} from '@/types/api/tasks'
import { apiHttp, type InfinityPaginationResponse } from './http'

export const tasksApi = {
  list(params?: {
    page?: number
    limit?: number
    projectId?: string
    status?: string
  }) {
    return apiHttp.get<InfinityPaginationResponse<Task>>('/tasks', {
      page: params?.page,
      limit: params?.limit,
      projectId: params?.projectId,
      status: params?.status,
    })
  },

  detail(taskId: string) {
    return apiHttp.get<Task>(`/tasks/${taskId}`)
  },

  detailWithNodes(taskId: string) {
    return apiHttp.get<TaskDetail>(`/tasks/${taskId}/detail`)
  },

  create(payload: CreateTaskPayload) {
    return apiHttp.post<Task>('/tasks', payload)
  },

  update(taskId: string, payload: UpdateTaskPayload) {
    return apiHttp.patch<TaskDetail>(`/tasks/${taskId}`, payload)
  },

  remove(taskId: string) {
    return apiHttp.delete<void>(`/tasks/${taskId}`)
  },

  execute(taskId: string) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/execute`)
  },

  reply(taskId: string, payload: ReplyTaskPayload) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/reply`, payload)
  },

  messages(taskId: string) {
    return apiHttp.get<TaskMessage[]>(`/tasks/${taskId}/messages`)
  },

  retry(taskId: string, payload: RetryTaskPayload) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/retry`, payload)
  },

  cancel(taskId: string) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/cancel`)
  },

  approve(taskId: string, payload: ApproveTaskPayload) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/approve`, payload)
  },

  cleanupWorktree(taskId: string) {
    return apiHttp.post<TaskDetail>(`/tasks/${taskId}/cleanup-worktree`)
  },

  logs(taskId: string, params?: { since?: string; afterId?: string; limit?: number }) {
    return apiHttp.get<TaskLog[]>(`/tasks/${taskId}/logs`, {
      since: params?.since,
      afterId: params?.afterId,
      limit: params?.limit,
    })
  },

  artifacts(taskId: string) {
    return apiHttp.get<TaskArtifact[]>(`/tasks/${taskId}/artifacts`)
  },

  worktreeFiles(taskId: string, prefix?: string) {
    return apiHttp.get<string[]>(`/tasks/${taskId}/worktree-files`, {
      prefix,
    })
  },

  worktreeFileContent(taskId: string, path: string) {
    return apiHttp.get<{ path: string; content: string }>(
      `/tasks/${taskId}/worktree-files/content`,
      { path },
    )
  },

  createArtifact(taskId: string, payload: CreateTaskArtifactPayload) {
    return apiHttp.post<TaskArtifact>(`/tasks/${taskId}/artifacts`, payload)
  },

  workspaceTree(taskId: string, params?: { path?: string }) {
    return apiHttp.get<TaskWorkspaceTree>(`/tasks/${taskId}/workspace/tree`, {
      path: params?.path,
    })
  },

  workspaceFile(taskId: string, path: string) {
    return apiHttp.get<TaskWorkspaceFile>(`/tasks/${taskId}/workspace/file`, {
      path,
    })
  },

  workspacePreview(taskId: string, path: string) {
    return apiHttp.get<TaskWorkspacePreview>(`/tasks/${taskId}/workspace/preview`, {
      path,
    })
  },

  gitStatus(taskId: string) {
    return apiHttp.get<TaskGitStatus>(`/tasks/${taskId}/git/status`)
  },

  gitDiff(taskId: string, params?: { path?: string; staged?: boolean }) {
    return apiHttp.get<TaskGitDiff>(`/tasks/${taskId}/git/diff`, {
      path: params?.path,
      staged: params?.staged,
    })
  },

  gitBranchDiffFiles(taskId: string, params?: { baseBranch?: string; path?: string }) {
    return apiHttp.get<TaskGitBranchDiffFiles>(`/tasks/${taskId}/git/branch-diff-files`, {
      baseBranch: params?.baseBranch,
      path: params?.path,
    })
  },

  gitBranchDiff(taskId: string, params?: { baseBranch?: string; path?: string }) {
    return apiHttp.get<TaskGitDiff>(`/tasks/${taskId}/git/branch-diff`, {
      baseBranch: params?.baseBranch,
      path: params?.path,
    })
  },

  gitStage(taskId: string, payload: TaskGitFilesPayload) {
    return apiHttp.post<TaskGitActionResult>(`/tasks/${taskId}/git/stage`, payload)
  },

  gitUnstage(taskId: string, payload: TaskGitFilesPayload) {
    return apiHttp.post<TaskGitActionResult>(`/tasks/${taskId}/git/unstage`, payload)
  },

  gitCommit(taskId: string, payload: TaskGitCommitPayload) {
    return apiHttp.post<TaskGitActionResult>(`/tasks/${taskId}/git/commit`, payload)
  },

  gitMerge(taskId: string, payload?: TaskGitBaseBranchPayload) {
    return apiHttp.post<TaskGitActionResult>(`/tasks/${taskId}/git/merge`, payload ?? {})
  },

  gitRebase(taskId: string, payload?: TaskGitBaseBranchPayload) {
    return apiHttp.post<TaskGitActionResult>(`/tasks/${taskId}/git/rebase`, payload ?? {})
  },

  gitPrLink(taskId: string, payload?: TaskGitBaseBranchPayload) {
    return apiHttp.post<TaskGitPrLink>(`/tasks/${taskId}/git/pr-link`, payload ?? {})
  },

  createTerminalSession(taskId: string, payload?: CreateTaskTerminalSessionPayload) {
    return apiHttp.post<TaskTerminalSession>(`/tasks/${taskId}/terminal/sessions`, payload ?? {})
  },

  listTerminalSessions(taskId: string) {
    return apiHttp.get<TaskTerminalSessionList>(`/tasks/${taskId}/terminal/sessions`)
  },

  terminalInput(taskId: string, sessionId: string, payload: TaskTerminalInputPayload) {
    return apiHttp.post<void>(`/tasks/${taskId}/terminal/sessions/${sessionId}/input`, payload)
  },

  terminalStop(taskId: string, sessionId: string) {
    return apiHttp.post<void>(`/tasks/${taskId}/terminal/sessions/${sessionId}/stop`)
  },
}
