export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

/** GET /tasks/stats 项目任务按状态聚合 */
export type TaskStatusCounts = {
  projectId: string
  todo: number
  in_progress: number
  in_review: number
  done: number
  total: number
}

export type TaskMode = 'conversation' | 'workflow'

export type TaskNodeType = 'agent' | 'skill' | 'mcp' | 'manual'

export type TaskAttachmentConfig = {
  name: string
  size: number
  type: string
  lastModified: number
}

export type TaskLoopConfig = {
  enabled: boolean
  loopCount: number
  maxLoops: number
}

export type TaskConfig = {
  workflowTemplateId?: string | null
  agentCliId?: string | null
  agentCliConfigId?: string | null
  loopEnabled?: boolean | null
  maxLoops?: number | null
  attachments?: TaskAttachmentConfig[] | null
}

export type Task = {
  id: string
  projectId: string
  businessLineId: string
  mode: TaskMode
  title: string
  prompt?: string | null
  status: TaskStatus
  gitBranch?: string | null
  gitBaseBranch?: string | null
  gitWorktree?: string | null
  configJson?: TaskConfig | null
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
  input?: {
    taskInput?: string | null
    nodeInput?: string | null
    [key: string]: unknown
  } | null
  agentCliId?: string | null
  agentCliConfigId?: string | null
  agentClioutput?: string | null
  loopJson?: TaskLoopConfig | null
  runtimeJson?: {
    workerId?: string | null
    leaseUntil?: string | null
    heartbeatAt?: string | null
    [key: string]: unknown
  } | null
  status: TaskStatus
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
  previewType: 'text' | 'image' | 'binary' | 'pdf' | 'video' | 'audio'
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
  mode?: TaskMode
  title: string
  prompt?: string
  gitBranch?: string
  gitBaseBranch?: string
  gitWorktree?: string
  configJson?: TaskConfig
}

export type UpdateTaskPayload = {
  title?: string
  prompt?: string
  gitBranch?: string
  gitBaseBranch?: string
  gitWorktree?: string
  configJson?: TaskConfig
}

export type ReplyTaskPayload = {
  message: string
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

export type TaskGitBaseBranchPayload = {
  baseBranch?: string
}

export type TaskGitCommitPayload = {
  message: string
}

export type CreateTaskTerminalSessionPayload = {
  cwd?: string
  shell?: string
  cols?: number
  rows?: number
}

export type TaskTerminalInputPayload = {
  input: string
}

export type StepSummaryRequestItem = {
  id: string
  rawText: string
}

export type StepSummariesPayload = {
  items: StepSummaryRequestItem[]
  taskNodeId?: string
}

export type StepSummariesResponse = {
  items: Array<{ id: string; summary: string }>
}

export type SuggestTaskTitlePayload = {
  projectId: string
  mode: TaskMode
  prompt: string
  agentCliId?: string
  agentCliConfigId?: string
  workflowTemplateId?: string
}

export type SuggestTaskTitleResponse = {
  title: string
}
