export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskNodeStatus = TaskStatus | 'failed'
export type TaskEnvironmentStatus =
  | 'not_started'
  | 'starting'
  | 'ready'
  | 'failed'
  | 'stopping'
  | 'stopped'
export type TaskEnvironmentStage =
  | 'workspace_preparing'
  | 'slot_claiming'
  | 'container_starting'
  | 'ready'
  | 'failed'
  | 'stopped'
export type TaskEnvironmentStepStatus = 'pending' | 'in_progress' | 'done' | 'error'

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
  earlyExitMarkerFileName?: string | null
  earlyExitMarkerEnabled?: boolean | null
  attachments?: TaskAttachmentConfig[] | null
}

export type Task = {
  id: string
  projectId: string
  goalId?: string | null
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
    earlyExitMarkerFileName?: string | null
    earlyExitMarkerEnabled?: boolean | null
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
  beforeRunCommitSha?: string | null
  afterRunCommitSha?: string | null
  status: TaskNodeStatus
}

export type TaskGoalSummary = {
  id: string
  title: string
  status:
    | 'draft'
    | 'prd_generated'
    | 'prd_confirmed'
    | 'planned'
    | 'in_progress'
    | 'done'
    | 'archived'
}

export type TaskDetail = {
  task: Task
  nodes: TaskNode[]
  goalSummary?: TaskGoalSummary | null
  /** 为 true 时不应展示删除（仍有后置计划子任务依赖本任务且尚未物化） */
  planDeletionBlocked?: boolean
}

export type TaskEnvironmentStep = {
  key: string
  label: string
  status: TaskEnvironmentStepStatus
  message?: string | null
}

export type TaskPreviewStatus = 'unavailable' | 'provisioning' | 'ready' | 'failed'

export type TaskEnvironmentRuntime = {
  gitWorktree?: string | null
  containerId?: string | null
}

export type TaskEnvironmentPreview = {
  status: TaskPreviewStatus
  url?: string | null
  expiresAt?: string | null
}

export type TaskEnvironment = {
  status: TaskEnvironmentStatus
  stage: TaskEnvironmentStage
  failedStage?: TaskEnvironmentStage | null
  stageLabel: string
  message?: string | null
  updatedAt: string
  runtime?: TaskEnvironmentRuntime | null
  preview: TaskEnvironmentPreview
  steps: TaskEnvironmentStep[]
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

export type TaskWorkspaceChangeKind = 'add' | 'change' | 'unlink'

export type TaskWorkspaceChange = {
  id: string
  taskId: string
  changedAt: string
  changes: Array<{
    path: string
    kind: TaskWorkspaceChangeKind
  }>
  truncated: boolean
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

export type TaskArtifactSource = {
  sourceType: 'commit_range' | 'workspace_unstaged_fallback' | 'unavailable'
  nodeId?: string | null
  beforeCommitSha?: string | null
  afterCommitSha?: string | null
}

export type TaskArtifactFile = {
  path: string
  status?: string | null
  deleted: boolean
}

export type TaskArtifactTree = {
  cwd: string
  entries: TaskWorkspaceEntry[]
  files: TaskArtifactFile[]
  artifactSource: TaskArtifactSource
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

export type TaskArtifactPreview = TaskWorkspacePreview & {
  artifactSource: TaskArtifactSource
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

export type ResetNodePayload = {
  nodeId: string
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
