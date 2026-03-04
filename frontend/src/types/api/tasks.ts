export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

export type TaskMode = 'conversation' | 'workflow'

export type TaskNodeType = 'agent' | 'skill' | 'mcp' | 'manual'

export type Task = {
  id: string
  projectId: string
  workflowTemplateId?: string | null
  mode: TaskMode
  title: string
  description?: string | null
  acceptanceCriteria?: unknown[] | null
  status: TaskStatus
  branch?: string | null
  gitBaseBranch?: string | null
  gitWorktreePath?: string | null
  sandboxCleanupAt?: string | null
  environment?: string | null
  toolVersionsSnapshot?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
  startedAt?: string | null
  finishedAt?: string | null
}

export type TaskNode = {
  id: string
  taskId: string
  nodeOrder: number
  name: string
  nodeType: TaskNodeType
  status: TaskStatus
  requiresApproval: boolean
  attempt: number
  errorCode?: string | null
  errorMessage?: string | null
}

export type TaskDetail = {
  task: Task
  nodes: TaskNode[]
}

export type TaskLogLevel = 'info' | 'warn' | 'error' | 'debug'

export type TaskLog = {
  id: string
  taskId: string
  taskNodeId?: string | null
  level: TaskLogLevel
  message: string
  payload?: Record<string, unknown> | null
  createdAt: string
}

export type TaskMessageRole = 'user' | 'assistant' | 'system' | 'error'

export type TaskMessage = {
  role: TaskMessageRole
  content: string
  createdAt: string
  taskNodeId?: string | null
  level?: TaskLogLevel
}

export type TaskArtifactType = 'diff' | 'report' | 'file' | 'preview'

export type TaskArtifact = {
  id: string
  taskId: string
  taskNodeId?: string | null
  artifactType: TaskArtifactType
  name: string
  downloadUrl?: string | null
  content?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export type TaskWorkspaceEntry = {
  name: string
  path: string
  isDir: boolean
}

export type TaskWorkspaceTree = {
  cwd: string
  entries: TaskWorkspaceEntry[]
}

export type TaskWorkspaceFile = {
  path: string
  name: string
  size: number
  tooLarge: boolean
  encoding?: 'utf8' | 'base64' | null
  mimeType?: string | null
  content?: string | null
}

export type TaskWorkspacePreview = {
  path: string
  previewType: 'text' | 'image' | 'binary'
  tooLarge: boolean
  size: number
  mimeType?: string | null
  text?: string | null
  dataUrl?: string | null
}

export type TaskGitChangedFile = {
  path: string
  status: string
  staged: boolean
}

export type TaskGitStatus = {
  branchName: string | null
  baseBranch: string | null
  files: TaskGitChangedFile[]
}

export type TaskGitDiff = {
  diffText: string
}

export type TaskGitBranchDiffFile = {
  path: string
  status: string
}

export type TaskGitBranchDiffFiles = {
  baseBranch: string | null
  currentBranch: string | null
  files: TaskGitBranchDiffFile[]
}

export type TaskGitActionResult = {
  success: boolean
  message: string
  conflicts?: string[]
}

export type TaskGitPrLink = {
  url?: string | null
}

export type TaskTerminalSessionStatus = 'running' | 'stopped' | 'error'

export type TaskTerminalSession = {
  id: string
  taskId: string
  cwd: string
  shell: string
  status: TaskTerminalSessionStatus
  createdAt: string
  updatedAt: string
}

export type TaskTerminalSessionList = {
  sessions: TaskTerminalSession[]
}

export type TaskTerminalEvent = {
  type: 'chunk' | 'status' | 'exit' | 'error'
  stream?: 'stdout' | 'stderr' | null
  data?: string | null
  code?: number | null
  signal?: string | null
  message?: string | null
  timestamp: string
}

export type CreateTaskPayload = {
  projectId: string
  workflowTemplateId?: string
  mode?: TaskMode
  title: string
  description?: string
  acceptanceCriteria?: unknown[]
  branch?: string
  environment?: string
  toolVersionsSnapshot?: Record<string, unknown>
}

export type UpdateTaskPayload = {
  title?: string
  description?: string
  acceptanceCriteria?: unknown[]
  branch?: string
  environment?: string
  cliToolId?: string
  agentToolConfigId?: string
  toolVersionsSnapshot?: Record<string, unknown>
}

export type ReplyTaskPayload = {
  message: string
}

export type CreateTaskArtifactPayload = {
  taskNodeId?: string
  artifactType: TaskArtifactType
  name: string
  downloadUrl?: string
  content?: string
  metadata?: Record<string, unknown>
}

export type RetryTaskPayload = {
  nodeId?: string
}

export type ApproveTaskPayload = {
  nodeId: string
}

export type TaskGitFilesPayload = {
  files: string[]
}

export type TaskGitCommitPayload = {
  message: string
}

export type TaskGitBaseBranchPayload = {
  baseBranch?: string
}

export type CreateTaskTerminalSessionPayload = {
  shell?: string
}

export type TaskTerminalInputPayload = {
  input: string
}
