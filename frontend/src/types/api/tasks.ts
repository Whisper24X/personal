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
  createdAt?: string
  updatedAt?: string
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
