<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { useAccessStore } from '@/stores/modules/access'
import ExecutionPanel from '@/components/tasks/detail/ExecutionPanel.vue'
import ReplyCard from '@/components/tasks/detail/ReplyCard.vue'
import ReviewCard from '@/components/tasks/detail/ReviewCard.vue'
import RightPanelSection from '@/components/tasks/detail/RightPanelSection.vue'
import TaskDialogs, { type TaskEditFormValue } from '@/components/tasks/detail/TaskDialogs.vue'
import TaskEnvironmentGate from '@/components/tasks/detail/TaskEnvironmentGate.vue'
import TaskExecutionContextBar from '@/components/tasks/detail/TaskExecutionContextBar.vue'
import WorkflowCard from '@/components/tasks/detail/WorkflowCard.vue'
import { openSseStream } from '@/api/http'
import { tasksApi } from '@/api/tasks'
import type {
  ResetNodePayload,
  Task,
  TaskDetail,
  TaskEnvironment,
  TaskEnvironmentStage,
  TaskEnvironmentStatus,
  TaskLog,
  TaskMessage,
  TaskNode,
  TaskWorkspaceChange,
} from '@/types/api/tasks'
import { STORAGE_KEYS } from '@/types/common/storage'
import { BUTTON_ACCESS_CONFIG, hasSomeAccess } from '@/constants/access-control'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { refreshSidebarRecentTasks } from '@/utils/sidebar-recent-tasks-refresh'

defineOptions({
  name: 'TaskDetailView',
})

const route = useRoute()
const hasButtonAccess = (buttonKey: keyof typeof BUTTON_ACCESS_CONFIG) => {
  return hasSomeAccess(BUTTON_ACCESS_CONFIG[buttonKey].capabilities, (capability) =>
    accessStore.hasCapability(capability),
  )
}

const router = useRouter()
const accessStore = useAccessStore()
const taskId = computed(() => String(route.params.id ?? ''))

const resolveStoredRightPanelVisible = () => {
  if (typeof localStorage === 'undefined') {
    return true
  }

  return localStorage.getItem(STORAGE_KEYS.taskDetailRightPanelVisible) !== 'false'
}

const loading = ref(false)
const actionLoading = ref(false)
const streamConnected = ref(false)
const isRightPanelVisible = ref(resolveStoredRightPanelVisible())
const rightPanelRefreshToken = ref(0)
const rightPanelArtifactRefreshPaths = ref<string[] | null>([])
/** 右栏「产物」面板：工作区文件预览路径 */
const artifactFilePath = ref<string | null>(null)
const artifactOpenNonce = ref(0)
const leftPanelWidth = ref(50)
const isDragging = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const detail = ref<TaskDetail | null>(null)
const environment = ref<TaskEnvironment | null>(null)
const logs = ref<TaskLog[]>([])
const messages = ref<TaskMessage[]>([])
const selectedWorkflowNodeId = ref<string | null>(null)
const workflowCardRef = ref<{ scrollToNode: (nodeId: string) => Promise<void> | void } | null>(null)
const lastWorkflowAutoSyncSignature = ref<string | null>(null)

const editOpen = ref(false)
const deleteOpen = ref(false)
const savingEdit = ref(false)
const removingTask = ref(false)
const editForm = reactive<TaskEditFormValue>({
  title: '',
  prompt: '',
  gitBranch: '',
  agentCliId: '',
  agentCliConfigId: '',
})

const message = useMessage()

let streamAbortController: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let detailRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
let sidebarRecentTasksDebounceTimer: ReturnType<typeof setTimeout> | null = null
let messageRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
let rightPanelWorkspaceRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
let streamLogFlushTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null
let lastSseEventTime = 0
const SSE_HEARTBEAT_TIMEOUT_MS = 90_000
let detailRequestId = 0
let pendingStreamLogs: TaskLog[] = []
const pendingRightPanelArtifactRefreshPaths = new Set<string>()
let pendingRightPanelArtifactRefreshUnknown = false

const TASK_DETAIL_REFRESH_LOG_MESSAGES = [
  'Node execution started',
  'Agent node completed; pending approval',
  'Agent node completed successfully',
  'Task completed; worktree preserved',
  'Agent node execution failed',
  'Node approved and marked as done',
  'Task title generated',
] as const

const NODE_STATUS_CHANGE_LOG_MESSAGES = [
  'Node execution started',
  'Agent node completed; pending approval',
  'Agent node completed successfully',
  'Agent node execution failed',
  'Node approved and marked as done',
] as const

const statusLabelMap: Record<Task['status'], string> = {
  todo: '待执行',
  in_progress: '处理中',
  in_review: '待完成',
  done: '已完成',
}

const nodeStatusLabelMap: Record<TaskNode['status'], string> = {
  todo: '待执行',
  in_progress: '执行中',
  in_review: '待处理',
  done: '已完成',
}

const modeLabelMap: Record<Task['mode'], string> = {
  conversation: '对话',
  workflow: '工作流',
}

const statusClassMap: Record<Task['status'], string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

const environmentStatusLabelMap: Record<TaskEnvironmentStatus, string> = {
  not_started: '未启动',
  starting: '启动中',
  ready: '已就绪',
  failed: '启动失败',
  stopping: '释放中',
  stopped: '已释放',
}

const environmentStatusClassMap: Record<TaskEnvironmentStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  starting: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  ready: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-destructive/10 text-destructive',
  stopping: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  stopped: 'bg-muted text-muted-foreground',
}

const cliLabelMap: Record<string, string> = {
  cursor: 'Cursor Agent',
  'cursor-agent': 'Cursor Agent',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  'gemini-cli': 'Gemini CLI',
  opencode: 'Opencode',
}

const task = computed(() => detail.value?.task ?? null)
const pageLoading = computed(() => loading.value && !detail.value)

const taskConfig = computed(() => task.value?.configJson ?? null)
const environmentStatus = computed(() => environment.value?.status ?? null)
const isEnvironmentReady = computed(() => environmentStatus.value === 'ready')
const environmentStatusLabel = computed(() => {
  return environmentStatus.value ? environmentStatusLabelMap[environmentStatus.value] : ''
})
const environmentStatusClass = computed(() => {
  return environmentStatus.value
    ? environmentStatusClassMap[environmentStatus.value]
    : 'bg-muted text-muted-foreground'
})
const shouldShowEnvironmentGate = computed(() => {
  if (!task.value || !environment.value) {
    return false
  }

  if (task.value.status === 'done') {
    return false
  }

  return environment.value.status !== 'ready'
})

const sortedNodes = computed(() => {
  if (!detail.value) {
    return [] as TaskNode[]
  }

  return [...detail.value.nodes].sort((left, right) => left.nodeOrder - right.nodeOrder)
})

const queryProjectId = computed(() => {
  const rawProjectId = route.query?.projectId
  if (typeof rawProjectId === 'string') {
    return rawProjectId
  }

  if (Array.isArray(rawProjectId) && typeof rawProjectId[0] === 'string') {
    return rawProjectId[0]
  }

  return ''
})

const activeProjectId = computed(() => {
  return task.value?.projectId || queryProjectId.value || ''
})

const taskListRoute = computed(() => {
  if (!activeProjectId.value) {
    return '/tasks'
  }

  return {
    path: '/tasks',
    query: {
      projectId: activeProjectId.value,
    },
  }
})

const taskStatusLabel = computed(() => {
  if (!task.value) {
    return '-'
  }
  return statusLabelMap[task.value.status]
})

const taskStatusClass = computed(() => {
  if (!task.value) {
    return 'bg-muted text-muted-foreground'
  }
  return statusClassMap[task.value.status]
})

const taskModeLabel = computed(() => {
  if (!task.value) {
    return '-'
  }
  return modeLabelMap[task.value.mode]
})

const showWorkflowCard = computed(() => {
  return task.value?.mode === 'workflow' && sortedNodes.value.length > 0
})

const workflowNodeStatusSignature = computed(() => {
  if (task.value?.mode !== 'workflow' || sortedNodes.value.length === 0) {
    return null
  }

  return sortedNodes.value.map((node) => `${node.id}:${node.nodeOrder}:${node.status}`).join('|')
})

const currentReviewNode = computed(() => {
  return sortedNodes.value.find((node) => node.status === 'in_review') ?? null
})

const showReviewCard = computed(() => {
  return task.value?.mode === 'workflow' && currentReviewNode.value !== null
})

const hasRunningNode = computed(() => {
  if (sortedNodes.value.some((node) => node.status === 'in_progress')) {
    return true
  }

  // Legacy conversation responses in tests may omit nodes; fall back to task status there.
  return (
    task.value?.mode === 'conversation' &&
    sortedNodes.value.length === 0 &&
    task.value.status === 'in_progress'
  )
})

const hasTodoNode = computed(() => {
  if (sortedNodes.value.some((node) => node.status === 'todo')) {
    return true
  }

  return (
    task.value?.mode === 'conversation' &&
    sortedNodes.value.length === 0 &&
    task.value.status === 'todo'
  )
})

const hasInReviewNode = computed(() => {
  return sortedNodes.value.some((node) => node.status === 'in_review')
})

const canExecute = computed(() => {
  if (!task.value || !hasButtonAccess('executeTask') || !isEnvironmentReady.value) {
    return false
  }

  if (task.value.status === 'done' || hasRunningNode.value || hasInReviewNode.value) {
    return false
  }

  return hasTodoNode.value
})

const areAllNodesDone = computed(() => {
  return sortedNodes.value.length > 0 && sortedNodes.value.every((node) => node.status === 'done')
})

const canRemove = computed(() => {
  if (!hasButtonAccess('deleteTask') || !task.value) {
    return false
  }
  if (detail.value?.planDeletionBlocked) {
    return false
  }
  return true
})

const canManageReview = computed(() => {
  return hasButtonAccess('executeTask')
})

const isCliRunning = computed(() => {
  return hasRunningNode.value
})

const canInterruptExecution = computed(() => {
  return isCliRunning.value && hasButtonAccess('cancelTask')
})

const canCompleteTask = computed(() => {
  if (!task.value || !hasButtonAccess('executeTask') || actionLoading.value || isCliRunning.value) {
    return false
  }

  return task.value.status === 'in_review' && areAllNodesDone.value
})

const canStartEnvironment = computed(() => {
  if (!task.value || !hasButtonAccess('executeTask') || actionLoading.value) {
    return false
  }

  if (task.value.status === 'done') {
    return false
  }

  return environment.value?.status !== 'ready' && environment.value?.status !== 'starting'
})

const selectedWorkflowNode = computed(() => {
  if (!selectedWorkflowNodeId.value) {
    return null
  }

  return sortedNodes.value.find((node) => node.id === selectedWorkflowNodeId.value) ?? null
})

const canResetSelectedWorkflowNode = computed(() => {
  const currentTask = task.value

  if (
    !currentTask ||
    currentTask.mode !== 'workflow' ||
    currentTask.status === 'done' ||
    !hasButtonAccess('executeTask') ||
    actionLoading.value ||
    isCliRunning.value
  ) {
    return false
  }

  if (!selectedWorkflowNode.value) {
    return false
  }

  return (
    selectedWorkflowNode.value.status === 'in_review' ||
    selectedWorkflowNode.value.status === 'done'
  )
})

const replyDisabled = computed(() => {
  return !task.value || actionLoading.value || isCliRunning.value || task.value.status === 'done'
})

const replyPlaceholder = computed(() => {
  if (task.value?.status === 'done') {
    return '任务已完成，无法继续回复...'
  }

  if (isCliRunning.value) {
    return '任务执行中，暂不可回复...'
  }

  return '补充指令或继续提问...'
})

const executionMessages = computed(() => {
  const sourceMessages = messages.value

  if (!selectedWorkflowNodeId.value) {
    return sourceMessages
  }

  return sourceMessages.filter((item) => {
    return item.taskNodeId === selectedWorkflowNodeId.value
  })
})

const executionCliId = computed(() => {
  const selectedNode = selectedWorkflowNodeId.value
    ? (sortedNodes.value.find((node) => node.id === selectedWorkflowNodeId.value) ?? null)
    : null
  return (
    selectedNode?.agentCliId ||
    taskConfig.value?.agentCliId ||
    sortedNodes.value[0]?.agentCliId ||
    ''
  )
})

const executionPanelTitle = computed(() => {
  const cliId = executionCliId.value
  return cliLabelMap[cliId] || cliId || 'Execution'
})

const contextSubtitle = computed(() => {
  if (!task.value) {
    return ''
  }
  if (task.value.mode === 'workflow') {
    const n = sortedNodes.value.length
    const cur = sortedNodes.value.find(
      (node) => node.status === 'in_progress' || node.status === 'in_review',
    )
    const tail = cur?.name ? ` · 当前：${cur.name}` : ''
    return `共 ${n} 个节点${tail}`
  }
  return executionPanelTitle.value
})

const formatDate = (value?: string) => {
  if (!value) return '-'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const buildEnvironmentSteps = (
  status: TaskEnvironmentStatus,
  stage: TaskEnvironmentStage,
  message: string | null,
): TaskEnvironment['steps'] => {
  const stepDefinitions: Array<{ key: TaskEnvironmentStage; label: string }> = [
    { key: 'workspace_preparing', label: '准备任务工作区' },
    { key: 'slot_claiming', label: '分配任务执行资源' },
    { key: 'container_starting', label: '启动执行容器' },
    { key: 'ready', label: '执行环境就绪' },
  ]

  const activeStage = status === 'failed' ? 'container_starting' : stage
  const activeIndex = stepDefinitions.findIndex((step) => step.key === activeStage)

  return stepDefinitions.map((step, index) => {
    let stepStatus: TaskEnvironment['steps'][number]['status'] = 'pending'

    if (status === 'ready' || status === 'stopped') {
      stepStatus = 'done'
    } else if (status === 'starting') {
      if (activeIndex > index) {
        stepStatus = 'done'
      } else if (activeIndex === index) {
        stepStatus = 'in_progress'
      }
    } else if (status === 'failed') {
      if (activeIndex > index) {
        stepStatus = 'done'
      } else if (activeIndex === index) {
        stepStatus = 'error'
      }
    }

    return {
      key: step.key,
      label: step.label,
      status: stepStatus,
      message:
        stepStatus === 'in_progress' ||
        stepStatus === 'error' ||
        (status === 'ready' && step.key === 'ready')
          ? message
          : null,
    }
  })
}

const updateEnvironmentFromLog = (log: TaskLog) => {
  if (!log.payload || typeof log.payload !== 'object') {
    return
  }

  const payload = log.payload as Record<string, unknown>
  if (payload.scope !== 'task_environment') {
    return
  }

  const nextStatus = payload.environmentStatus
  const nextStage = payload.environmentStage
  const nextMessage = payload.environmentMessage

  if (
    typeof nextStatus !== 'string' ||
    typeof nextStage !== 'string' ||
    (nextMessage !== null && nextMessage !== undefined && typeof nextMessage !== 'string')
  ) {
    return
  }

  const runtime = environment.value?.runtime ?? null
  const preview = environment.value?.preview ?? { status: 'unavailable', url: null }
  environment.value = {
    status: nextStatus as TaskEnvironmentStatus,
    stage: nextStage as TaskEnvironmentStage,
    stageLabel:
      nextStage === 'failed'
        ? '执行环境启动失败'
        : nextStage === 'stopped'
          ? '执行环境已释放'
          : buildEnvironmentSteps(
              nextStatus as TaskEnvironmentStatus,
              nextStage as TaskEnvironmentStage,
              typeof nextMessage === 'string' ? nextMessage : null,
            ).find((step) => step.key === nextStage)?.label || '执行环境',
    message: typeof nextMessage === 'string' ? nextMessage : null,
    updatedAt: log.createdAt,
    runtime,
    preview,
    steps: buildEnvironmentSteps(
      nextStatus as TaskEnvironmentStatus,
      nextStage as TaskEnvironmentStage,
      typeof nextMessage === 'string' ? nextMessage : null,
    ),
  }
}

const isAgentOutputLog = (log: TaskLog) => {
  return (
    log.message === 'Agent CLI stdout chunk' ||
    log.message === 'Agent CLI stderr chunk' ||
    log.level === 'error'
  )
}

const resolveLogMessageContent = (log: TaskLog) => {
  const payload = log.payload && typeof log.payload === 'object' ? log.payload : null

  if (
    (log.message === 'Agent CLI stdout chunk' || log.message === 'Agent CLI stderr chunk') &&
    payload &&
    typeof payload.text === 'string' &&
    payload.text.length > 0
  ) {
    return payload.text
  }

  return log.message
}

const mapLogToMessage = (log: TaskLog): TaskMessage => {
  const payload = log.payload && typeof log.payload === 'object' ? log.payload : null
  const payloadRole =
    payload && typeof payload.messageRole === 'string' ? payload.messageRole : null

  if (
    payloadRole === 'user' ||
    payloadRole === 'assistant' ||
    payloadRole === 'system' ||
    payloadRole === 'error'
  ) {
    return {
      role: payloadRole,
      content: resolveLogMessageContent(log),
      createdAt: log.createdAt,
      taskNodeId: log.taskNodeId,
      level: log.level,
    }
  }

  if (log.level === 'error') {
    return {
      role: 'error',
      content: resolveLogMessageContent(log),
      createdAt: log.createdAt,
      taskNodeId: log.taskNodeId,
      level: log.level,
    }
  }

  return {
    role: 'system',
    content: resolveLogMessageContent(log),
    createdAt: log.createdAt,
    taskNodeId: log.taskNodeId,
    level: log.level,
  }
}

const upsertLog = (nextLog: TaskLog) => {
  const existedIndex = logs.value.findIndex((log) => log.id === nextLog.id)

  if (existedIndex >= 0) {
    logs.value[existedIndex] = nextLog
    return false
  }

  logs.value.push(nextLog)

  logs.value.sort((left, right) => {
    const leftAt = new Date(left.createdAt).getTime()
    const rightAt = new Date(right.createdAt).getTime()
    return leftAt - rightAt
  })

  return true
}

const getLastLogCursor = () => {
  const lastLog = logs.value.length > 0 ? logs.value[logs.value.length - 1] : null
  if (!lastLog) {
    return null
  }

  return {
    since: lastLog.createdAt,
    afterId: lastLog.id,
  }
}

const applyTaskLog = (payload: TaskLog) => {
  const isFresh = upsertLog(payload)
  if (!isFresh) {
    return
  }

  updateEnvironmentFromLog(payload)

  if (isAgentOutputLog(payload)) {
    scheduleRefreshMessages()
  }
  if (shouldRefreshRightPanelForNodeStatusLog(payload)) {
    bumpRightPanelRefresh([])
  }
  if (shouldRefreshTaskDetailForLog(payload)) {
    scheduleRefreshTaskDetail()
  }
  if (payload.message?.includes('Task title generated')) {
    if (sidebarRecentTasksDebounceTimer) clearTimeout(sidebarRecentTasksDebounceTimer)
    sidebarRecentTasksDebounceTimer = setTimeout(() => {
      sidebarRecentTasksDebounceTimer = null
      void refreshSidebarRecentTasks()
    }, 300)
  }
}

const clearStreamLogFlushTimer = () => {
  if (!streamLogFlushTimer) {
    return
  }

  clearTimeout(streamLogFlushTimer)
  streamLogFlushTimer = null
}

const flushPendingStreamLogs = () => {
  clearStreamLogFlushTimer()

  const nextBatch = pendingStreamLogs.splice(0, 20)
  for (const log of nextBatch) {
    applyTaskLog(log)
  }

  if (pendingStreamLogs.length > 0) {
    streamLogFlushTimer = setTimeout(() => {
      flushPendingStreamLogs()
    }, 16)
  }
}

const queueTaskLog = (payload: TaskLog) => {
  pendingStreamLogs.push(payload)

  if (streamLogFlushTimer) {
    return
  }

  streamLogFlushTimer = setTimeout(() => {
    flushPendingStreamLogs()
  }, 16)
}

const shouldRefreshTaskDetailForLog = (log: TaskLog) => {
  return TASK_DETAIL_REFRESH_LOG_MESSAGES.some((messageText) => log.message?.includes(messageText))
}

const shouldRefreshRightPanelForNodeStatusLog = (log: TaskLog) => {
  return NODE_STATUS_CHANGE_LOG_MESSAGES.some((messageText) => log.message?.includes(messageText))
}

const clearReconnectTimer = () => {
  if (!reconnectTimer) {
    return
  }

  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

const clearMessageRefreshTimer = () => {
  if (!messageRefreshDebounceTimer) {
    return
  }

  clearTimeout(messageRefreshDebounceTimer)
  messageRefreshDebounceTimer = null
}

const clearRightPanelWorkspaceRefreshTimer = () => {
  if (!rightPanelWorkspaceRefreshDebounceTimer) {
    return
  }

  clearTimeout(rightPanelWorkspaceRefreshDebounceTimer)
  rightPanelWorkspaceRefreshDebounceTimer = null
}

const resetPendingRightPanelArtifactRefresh = () => {
  pendingRightPanelArtifactRefreshPaths.clear()
  pendingRightPanelArtifactRefreshUnknown = false
}

const bumpRightPanelRefresh = (artifactRefreshPaths: string[] | null = []) => {
  rightPanelArtifactRefreshPaths.value =
    artifactRefreshPaths === null ? null : [...new Set(artifactRefreshPaths.filter(Boolean))]
  rightPanelRefreshToken.value += 1
}

const clearPendingStreamLogs = () => {
  pendingStreamLogs = []
  clearStreamLogFlushTimer()
}

const scheduleRefreshMessages = (delay = 120) => {
  if (!taskId.value) {
    return
  }

  clearMessageRefreshTimer()
  messageRefreshDebounceTimer = setTimeout(() => {
    messageRefreshDebounceTimer = null
    void refreshMessages()
  }, delay)
}

const scheduleRefreshTaskDetail = (delay = 300) => {
  if (!taskId.value) {
    return
  }

  if (detailRefreshDebounceTimer) {
    clearTimeout(detailRefreshDebounceTimer)
  }

  detailRefreshDebounceTimer = setTimeout(() => {
    detailRefreshDebounceTimer = null
    void refreshTaskDetail()
  }, delay)
}

const scheduleRightPanelWorkspaceRefresh = (artifactRefreshPaths: string[] | null, delay = 250) => {
  if (!taskId.value || !isRightPanelVisible.value) {
    return
  }

  if (artifactRefreshPaths === null) {
    pendingRightPanelArtifactRefreshUnknown = true
  } else {
    for (const path of artifactRefreshPaths) {
      if (path) {
        pendingRightPanelArtifactRefreshPaths.add(path)
      }
    }
  }

  clearRightPanelWorkspaceRefreshTimer()
  rightPanelWorkspaceRefreshDebounceTimer = setTimeout(() => {
    rightPanelWorkspaceRefreshDebounceTimer = null
    const nextArtifactRefreshPaths = pendingRightPanelArtifactRefreshUnknown
      ? null
      : [...pendingRightPanelArtifactRefreshPaths]
    resetPendingRightPanelArtifactRefresh()
    bumpRightPanelRefresh(nextArtifactRefreshPaths)
  }, delay)
}

const stopHeartbeatCheck = () => {
  if (heartbeatCheckTimer) {
    clearInterval(heartbeatCheckTimer)
    heartbeatCheckTimer = null
  }
}

const startHeartbeatCheck = () => {
  stopHeartbeatCheck()
  heartbeatCheckTimer = setInterval(() => {
    if (lastSseEventTime > 0 && Date.now() - lastSseEventTime > SSE_HEARTBEAT_TIMEOUT_MS) {
      stopHeartbeatCheck()
      disconnectStream()
      scheduleReconnect()
    }
  }, 10_000)
}

const disconnectStream = () => {
  stopHeartbeatCheck()
  clearReconnectTimer()
  clearMessageRefreshTimer()
  clearRightPanelWorkspaceRefreshTimer()
  resetPendingRightPanelArtifactRefresh()
  clearPendingStreamLogs()
  if (detailRefreshDebounceTimer) {
    clearTimeout(detailRefreshDebounceTimer)
    detailRefreshDebounceTimer = null
  }
  if (sidebarRecentTasksDebounceTimer) {
    clearTimeout(sidebarRecentTasksDebounceTimer)
    sidebarRecentTasksDebounceTimer = null
  }

  if (streamAbortController) {
    streamAbortController.abort()
    streamAbortController = null
  }

  streamConnected.value = false
}

const scheduleReconnect = () => {
  if (reconnectTimer || !taskId.value) {
    return
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void connectStream()
  }, 2000)
}

const connectStream = async () => {
  if (!taskId.value) {
    return
  }

  disconnectStream()
  const currentTaskId = taskId.value
  const reconnectCursor = getLastLogCursor()

  await syncIncrementalLogs(currentTaskId, reconnectCursor)

  if (taskId.value !== currentTaskId) {
    return
  }

  streamAbortController = new AbortController()

  try {
    streamConnected.value = true
    lastSseEventTime = Date.now()
    startHeartbeatCheck()

    await openSseStream(`/tasks/${taskId.value}/stream`, undefined, {
      signal: streamAbortController.signal,
      onOpen: async () => {
        await syncIncrementalLogs(currentTaskId, reconnectCursor)
      },
      onEvent: (event) => {
        lastSseEventTime = Date.now()

        if (event.event === 'heartbeat') {
          return
        }

        if (event.event === 'task-workspace-change') {
          try {
            const payload = JSON.parse(event.data) as TaskWorkspaceChange
            if (payload.changes.length > 0 || payload.truncated) {
              scheduleRightPanelWorkspaceRefresh(
                payload.truncated ? null : payload.changes.map((change) => change.path),
              )
            }
          } catch {
            // ignore malformed task-workspace-change payload
          }
          return
        }

        if (event.event && event.event !== 'task-log') {
          return
        }

        try {
          const payload = JSON.parse(event.data) as TaskLog
          queueTaskLog(payload)
        } catch {
          // ignore malformed task-log payload
        }
      },
      onError: () => {
        streamConnected.value = false
        scheduleReconnect()
      },
    })

    streamConnected.value = false
    scheduleReconnect()
  } catch (error) {
    streamConnected.value = false

    if (error instanceof Error && error.name === 'AbortError') {
      return
    }

    scheduleReconnect()
  }
}

const refreshMessages = async () => {
  if (!taskId.value) {
    return
  }

  try {
    messages.value = await tasksApi.messages(taskId.value)
  } catch {
    messages.value = logs.value.filter(isAgentOutputLog).map(mapLogToMessage)
  }
}

const syncIncrementalLogs = async (
  currentTaskId: string,
  cursor: { since: string; afterId: string } | null,
) => {
  if (!cursor) {
    return
  }

  try {
    const incrementalLogs = await tasksApi.logs(currentTaskId, {
      since: cursor.since,
      afterId: cursor.afterId,
      limit: 300,
    })

    if (taskId.value !== currentTaskId) {
      return
    }

    for (const log of incrementalLogs) {
      applyTaskLog(log)
    }
  } catch {
    // ignore reconnect catch-up failures and rely on subsequent reconnects
  }
}

const refreshAccessContext = async (projectId: string) => {
  try {
    await accessStore.loadContext(projectId ? { projectId } : {})
  } catch (error) {
    void error
    accessStore.clear()
  }
}

const resetTaskState = () => {
  detail.value = null
  environment.value = null
  logs.value = []
  messages.value = []
  selectedWorkflowNodeId.value = null
  lastWorkflowAutoSyncSignature.value = null
  rightPanelArtifactRefreshPaths.value = []
  clearPendingStreamLogs()
}

const loadInitialTaskData = async () => {
  if (!taskId.value) {
    return
  }

  const requestId = ++detailRequestId
  loading.value = true

  try {
    const [detailResponse, environmentResponse, logResponse, messageResponse] = await Promise.all([
      tasksApi.detailWithNodes(taskId.value),
      tasksApi.environment(taskId.value),
      tasksApi.logs(taskId.value, { limit: 300 }),
      tasksApi.messages(taskId.value),
    ])

    if (requestId !== detailRequestId) {
      return
    }

    await refreshAccessContext(detailResponse.task.projectId || queryProjectId.value)

    if (requestId !== detailRequestId) {
      return
    }

    detail.value = detailResponse
    environment.value = environmentResponse
    logs.value = [...logResponse].sort((left, right) => {
      const leftAt = new Date(left.createdAt).getTime()
      const rightAt = new Date(right.createdAt).getTime()
      return leftAt - rightAt
    })
    messages.value = messageResponse
  } catch (error) {
    if (requestId === detailRequestId) {
      message.error(toErrorMessage(error, '加载任务详情失败'))
    }
  } finally {
    if (requestId === detailRequestId) {
      loading.value = false
    }
  }
}

const refreshEnvironment = async () => {
  if (!taskId.value) {
    return
  }

  try {
    environment.value = await tasksApi.environment(taskId.value)
  } catch (error) {
    message.error(toErrorMessage(error, '加载执行环境失败'))
  }
}

const refreshTaskDetail = async () => {
  if (!taskId.value) {
    return
  }

  const requestId = ++detailRequestId

  try {
    const [detailResponse, environmentResponse] = await Promise.all([
      tasksApi.detailWithNodes(taskId.value),
      tasksApi.environment(taskId.value),
    ])

    if (requestId !== detailRequestId) {
      return
    }

    detail.value = detailResponse
    environment.value = environmentResponse
  } catch (error) {
    if (requestId === detailRequestId) {
      message.error(toErrorMessage(error, '加载任务详情失败'))
    }
  }
}

const executeTask = async () => {
  if (!taskId.value || !canExecute.value) {
    if (!isEnvironmentReady.value) {
      message.warning('请先启动执行环境')
    }
    return
  }

  actionLoading.value = true

  try {
    detail.value = await tasksApi.execute(taskId.value)
    bumpRightPanelRefresh([])
  } catch (error) {
    message.error(toErrorMessage(error, '执行任务失败'))
  } finally {
    actionLoading.value = false
  }
}

const startEnvironment = async () => {
  if (!taskId.value || !canStartEnvironment.value) {
    return
  }

  actionLoading.value = true

  try {
    environment.value = {
      ...(environment.value ?? {
        status: 'starting',
        stage: 'workspace_preparing',
        stageLabel: '准备任务工作区',
        message: '开始准备任务执行环境',
        updatedAt: new Date().toISOString(),
        runtime: null,
        preview: {
          status: 'provisioning',
          url: null,
        },
        steps: buildEnvironmentSteps('starting', 'workspace_preparing', '开始准备任务执行环境'),
      }),
      status: 'starting',
      stage: 'workspace_preparing',
      stageLabel: '准备任务工作区',
      message: '开始准备任务执行环境',
      updatedAt: new Date().toISOString(),
      preview:
        environment.value?.preview?.status === 'ready'
          ? environment.value.preview
          : {
              status: 'provisioning',
              url: null,
            },
      steps: buildEnvironmentSteps('starting', 'workspace_preparing', '开始准备任务执行环境'),
    }
    environment.value = await tasksApi.startEnvironment(taskId.value)
    await refreshTaskDetail()
  } catch (error) {
    message.error(toErrorMessage(error, '启动执行环境失败'))
    await refreshEnvironment()
  } finally {
    actionLoading.value = false
  }
}

const completeTask = async () => {
  if (!taskId.value || !canCompleteTask.value) {
    return
  }

  if (!areAllNodesDone.value) {
    message.warning('请先完成所有节点后再完成任务')
    return
  }

  actionLoading.value = true

  try {
    detail.value = await tasksApi.complete(taskId.value)
    bumpRightPanelRefresh([])
    void refreshSidebarRecentTasks()
    message.success('任务已完成')
  } catch (error) {
    message.error(toErrorMessage(error, '完成任务失败'))
  } finally {
    actionLoading.value = false
  }
}

const resetSelectedWorkflowNode = async () => {
  const targetNodeId = selectedWorkflowNode.value?.id ?? null

  if (!taskId.value || !canResetSelectedWorkflowNode.value || !targetNodeId) {
    return
  }

  actionLoading.value = true

  try {
    clearPendingStreamLogs()

    const payload: ResetNodePayload = {
      nodeId: targetNodeId,
    }
    detail.value = await tasksApi.resetNode(taskId.value, payload)
    const [nextLogsResult, nextMessagesResult] = await Promise.allSettled([
      tasksApi.logs(taskId.value, { limit: 300 }),
      tasksApi.messages(taskId.value),
    ])
    if (nextLogsResult.status === 'fulfilled') {
      logs.value = nextLogsResult.value
    }
    if (nextMessagesResult.status === 'fulfilled') {
      messages.value = nextMessagesResult.value
    }
    bumpRightPanelRefresh([])
  } catch (error) {
    message.error(toErrorMessage(error, '重置失败'))
  } finally {
    actionLoading.value = false
  }
}

const approveNode = async (node: TaskNode) => {
  if (!taskId.value || !canManageReview.value) {
    return
  }

  actionLoading.value = true

  try {
    detail.value = await tasksApi.approve(taskId.value, {
      nodeId: node.id,
    })
    bumpRightPanelRefresh([])
  } catch (error) {
    message.error(toErrorMessage(error, '审批节点失败'))
  } finally {
    actionLoading.value = false
  }
}

const handleSelectWorkflowNode = (nodeId: string) => {
  selectedWorkflowNodeId.value = nodeId
}

const resolveAutoSelectedWorkflowNodeId = (nodes: TaskNode[]) => {
  const activeNode = nodes.find((node) => node.status === 'in_progress')
  if (activeNode) {
    return activeNode.id
  }

  const reviewNode = nodes.find((node) => node.status === 'in_review')
  if (reviewNode) {
    return reviewNode.id
  }

  const selectedNodeStillExists = selectedWorkflowNodeId.value
    ? nodes.some((node) => node.id === selectedWorkflowNodeId.value)
    : false

  if (selectedNodeStillExists) {
    return selectedWorkflowNodeId.value
  }

  return nodes[0]?.id || null
}

const syncWorkflowSelectionIfNeeded = async (force = false) => {
  const signature = workflowNodeStatusSignature.value
  if (!signature || sortedNodes.value.length === 0) {
    selectedWorkflowNodeId.value = null
    if (!signature) {
      lastWorkflowAutoSyncSignature.value = null
    }
    return
  }

  const shouldAutoSync =
    force ||
    lastWorkflowAutoSyncSignature.value === null ||
    lastWorkflowAutoSyncSignature.value !== signature

  if (!shouldAutoSync) {
    return
  }

  lastWorkflowAutoSyncSignature.value = signature

  const nextNodeId = resolveAutoSelectedWorkflowNodeId(sortedNodes.value)
  selectedWorkflowNodeId.value = nextNodeId

  if (!nextNodeId) {
    return
  }

  await nextTick()
  await workflowCardRef.value?.scrollToNode(nextNodeId)
}

const handleReply = async (replyMessage: string) => {
  if (!taskId.value || replyDisabled.value) {
    return
  }

  actionLoading.value = true

  try {
    detail.value = await tasksApi.reply(taskId.value, {
      message: replyMessage,
    })
    await refreshMessages()
    bumpRightPanelRefresh([])
  } catch (error) {
    message.error(toErrorMessage(error, '提交回复失败'))
  } finally {
    actionLoading.value = false
  }
}

const interruptExecution = async () => {
  if (!taskId.value || !canInterruptExecution.value) {
    return
  }

  actionLoading.value = true

  try {
    detail.value = await tasksApi.cancel(taskId.value)
    await refreshMessages()
    bumpRightPanelRefresh([])
  } catch (error) {
    message.error(toErrorMessage(error, '停止执行失败'))
  } finally {
    actionLoading.value = false
  }
}

const saveEdit = async (payload: TaskEditFormValue) => {
  if (!taskId.value || !hasButtonAccess('editTask')) {
    return
  }

  savingEdit.value = true

  try {
    detail.value = await tasksApi.update(taskId.value, {
      title: payload.title.trim(),
      prompt: payload.prompt.trim(),
      gitBranch: payload.gitBranch.trim(),
      configJson: {
        agentCliId: payload.agentCliId.trim() || undefined,
        agentCliConfigId: payload.agentCliConfigId.trim() || undefined,
      },
    })
    editOpen.value = false
    message.success('任务已更新')
  } catch (error) {
    message.error(toErrorMessage(error, '更新任务失败'))
  } finally {
    savingEdit.value = false
  }
}

const removeTask = async () => {
  if (!taskId.value || !canRemove.value) {
    return
  }

  removingTask.value = true

  try {
    await tasksApi.remove(taskId.value)
    deleteOpen.value = false
    message.success('任务已删除')
    void refreshSidebarRecentTasks()
    await router.push(taskListRoute.value)
  } catch (error) {
    message.error(toErrorMessage(error, '删除任务失败'))
  } finally {
    removingTask.value = false
  }
}

watch(
  [() => task.value?.mode, workflowNodeStatusSignature],
  async ([mode]) => {
    if (mode !== 'workflow') {
      selectedWorkflowNodeId.value = null
      lastWorkflowAutoSyncSignature.value = null
      return
    }

    await syncWorkflowSelectionIfNeeded()
  },
  {
    immediate: true,
  },
)

watch(
  () => taskId.value,
  async (nextTaskId, previousTaskId) => {
    if (!nextTaskId) {
      disconnectStream()
      detailRequestId += 1
      resetTaskState()
      loading.value = false
      return
    }

    if (nextTaskId !== previousTaskId) {
      disconnectStream()
      resetTaskState()
    }

    await loadInitialTaskData()
    await connectStream()
  },
  {
    immediate: true,
  },
)

watch(isRightPanelVisible, (visible) => {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(STORAGE_KEYS.taskDetailRightPanelVisible, String(visible))
})

onBeforeUnmount(() => {
  disconnectStream()
})

function startDrag(e: MouseEvent) {
  isDragging.value = true
  e.preventDefault()
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'

  const onMouseMove = (event: MouseEvent) => {
    if (!containerRef.value) return
    const rect = containerRef.value.getBoundingClientRect()
    const pct = ((event.clientX - rect.left) / rect.width) * 100
    leftPanelWidth.value = Math.min(Math.max(pct, 30), 70)
  }

  const onMouseUp = () => {
    isDragging.value = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div class="fade-up flex h-full min-h-0 w-full">
    <TaskEnvironmentGate
      v-if="!pageLoading && shouldShowEnvironmentGate && task"
      :title="task.title"
      :environment="environment"
      :action-loading="actionLoading"
      :can-start="canStartEnvironment"
      :format-date="formatDate"
      @start="startEnvironment"
      @refresh="loadInitialTaskData"
    />

    <section
      v-else-if="!pageLoading"
      ref="containerRef"
      class="flex h-full w-full min-w-0 overflow-hidden"
    >
      <div
        class="bg-background flex min-w-0 flex-col overflow-hidden"
        :class="{ 'transition-all duration-200': !isDragging }"
        :style="{
          flex: isRightPanelVisible ? '0 0 auto' : '1 1 0%',
          width: isRightPanelVisible ? `${leftPanelWidth}%` : undefined,
          minWidth: isRightPanelVisible ? '0' : '0',
          maxWidth: isRightPanelVisible ? `${leftPanelWidth}%` : undefined,
        }"
      >
        <div class="flex min-h-0 w-full flex-1 flex-col gap-2">
          <div
            v-if="detail?.goalSummary"
            class="border-border/60 bg-muted/30 text-foreground flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-xs"
          >
            <span class="text-muted-foreground">所属需求</span>
            <RouterLink
              :to="{ name: 'goal-detail', params: { goalId: detail.goalSummary.id } }"
              class="text-primary font-medium hover:underline"
            >
              {{ detail.goalSummary.title }}
            </RouterLink>
            <span class="text-muted-foreground">（{{ detail.goalSummary.status }}）</span>
          </div>

          <div class="flex min-h-0 w-full flex-1 flex-col">
            <WorkflowCard
              v-if="showWorkflowCard"
              ref="workflowCardRef"
              :nodes="sortedNodes"
              :selected-node-id="selectedWorkflowNodeId"
              @select-node="handleSelectWorkflowNode"
            />

            <ReviewCard
              v-if="showReviewCard"
              :node="currentReviewNode"
              :status-label-map="nodeStatusLabelMap"
              :can-manage-review="canManageReview"
              @approve-node="approveNode"
            />

            <TaskExecutionContextBar
              v-if="task"
              :mode="task.mode"
              :status="task.status"
              :status-label="taskStatusLabel"
              :status-class="taskStatusClass"
              :mode-label="taskModeLabel"
              :subtitle="contextSubtitle"
              :environment-status="environment?.status || null"
              :environment-status-label="environmentStatusLabel"
              :environment-status-class="environmentStatusClass"
              :environment-stage-label="environment?.stageLabel || ''"
              :action-loading="actionLoading"
              :can-start-environment="canStartEnvironment"
              :can-execute="canExecute"
              :can-complete-task="canCompleteTask"
              :can-reset="canResetSelectedWorkflowNode"
              :can-remove="canRemove"
              :right-panel-visible="isRightPanelVisible"
              @start-environment="startEnvironment"
              @execute="executeTask"
              @complete-task="completeTask"
              @reset="resetSelectedWorkflowNode"
              @refresh="loadInitialTaskData"
              @remove="deleteOpen = true"
              @toggle-right-panel="isRightPanelVisible = !isRightPanelVisible"
            />

            <ExecutionPanel
              :title="executionPanelTitle"
              :loading="pageLoading"
              :agent-cli-id="executionCliId"
              :task-status="task?.status || null"
              :task-status-label="taskStatusLabel"
              :task-status-class="taskStatusClass"
              :stream-connected="streamConnected"
              :messages="executionMessages"
              :format-date="formatDate"
            />

            <ReplyCard
              :disabled="replyDisabled"
              :placeholder="replyPlaceholder"
              :running="isCliRunning"
              :action-loading="actionLoading"
              :can-interrupt="canInterruptExecution"
              @submit="handleReply"
              @interrupt="interruptExecution"
            />
          </div>
        </div>
      </div>

      <div
        v-if="isRightPanelVisible"
        class="group relative h-full w-1.5 min-w-1.5 shrink-0 cursor-col-resize"
        @mousedown.prevent="startDrag"
      >
        <div
          class="bg-border/50 pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:bg-primary/50"
          :class="{ 'bg-primary/50': isDragging }"
        />
      </div>

      <RightPanelSection
        v-if="isRightPanelVisible"
        :task-id="taskId"
        :project-id="activeProjectId"
        :branch-name="task?.gitBranch || null"
        :base-branch="task?.gitBaseBranch || null"
        :refresh-token="rightPanelRefreshToken"
        :artifact-refresh-paths="rightPanelArtifactRefreshPaths"
        :logs="logs"
        default-right-tab="artifacts"
        :environment-status="environment?.status || null"
        :environment-preview="environment?.preview || null"
        :format-date="formatDate"
        :artifact-file-path="artifactFilePath"
        :artifact-open-nonce="artifactOpenNonce"
      />
    </section>

    <TaskDialogs
      v-model:edit-open="editOpen"
      v-model:delete-open="deleteOpen"
      :saving="savingEdit"
      :removing="removingTask"
      :edit-form="editForm"
      @save="saveEdit"
      @remove="removeTask"
    />

    <Teleport to="body">
      <div
        v-if="pageLoading"
        class="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-7 bg-black/5 backdrop-blur-md transition-opacity duration-300"
        role="status"
        aria-live="polite"
      >
        <svg
          class="size-9 animate-spin text-muted-foreground/50"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.15" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <p class="text-sm font-medium text-muted-foreground">正在加载任务</p>
      </div>
    </Teleport>
  </div>
</template>
