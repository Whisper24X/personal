import type { InjectionKey } from 'vue'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { useAccessStore } from '@app/stores/modules/access'
import { openSseStream } from '@/api/http'
import { tasksApi } from '@/api/tasks'
import type {
  ResetNodePayload,
  TaskDetail,
  TaskEnvironment,
  TaskEnvironmentStage,
  TaskEnvironmentStatus,
  TaskLog,
  TaskMessage,
  TaskNode,
  TaskWorkspaceChange,
} from '@/types/api/tasks'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { BUTTON_ACCESS_CONFIG, hasSomeAccess } from '@shared/constants/access-control'
import { toErrorMessage } from '@api/shared/to-error-message'
import { refreshSidebarRecentTasks } from '@shared/utils/sidebar-recent-tasks-refresh'
import {
  TASK_DETAIL_REFRESH_LOG_MESSAGES,
  NODE_STATUS_CHANGE_LOG_MESSAGES,
  cliLabelMap,
  environmentStatusClassMap,
  environmentStatusLabelMap,
  modeLabelMap,
  statusClassMap,
  statusLabelMap,
} from '@features/tasks/task-detail-ui.constants'
import {
  buildEnvironmentSteps,
  formatTaskDetailDate,
  isAgentOutputLog,
  logMessageMatchesAny,
  mapLogToMessage,
} from '@features/tasks/task-detail-log.helpers'
import type { TaskEditFormValue } from '@features/tasks/detail/TaskDialogs.vue'

export type TaskDetailPageContext = ReturnType<typeof useTaskDetailPage>

export const taskDetailPageInjectionKey = Symbol(
  'taskDetailPage',
) as InjectionKey<TaskDetailPageContext>

export function useTaskDetailPage() {
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
const approveConfirmationNodeId = ref<string | null>(null)
const editForm = reactive<TaskEditFormValue>({
  title: '',
  prompt: '',
  gitBranch: '',
  agentCliId: '',
  agentCliConfigId: '',
})

const message = useMessage()

const formatDate = formatTaskDetailDate

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

const currentFailedNode = computed(() => {
  if (selectedWorkflowNode.value?.status === 'failed') {
    return selectedWorkflowNode.value
  }

  return sortedNodes.value.find((node) => node.status === 'failed') ?? null
})

const currentTodoNode = computed(() => {
  return sortedNodes.value.find((node) => node.status === 'todo') ?? null
})

const replyFallbackDoneNode = computed(() => {
  const doneNodes = sortedNodes.value.filter((node) => node.status === 'done')
  const nodesWithSession = doneNodes.filter((node) => node.agentCliSessionId?.trim())
  const candidates = nodesWithSession.length > 0 ? nodesWithSession : doneNodes

  return [...candidates].sort((left, right) => right.nodeOrder - left.nodeOrder)[0] ?? null
})

const currentReplyTargetNode = computed(() => {
  return currentFailedNode.value ?? currentReviewNode.value ?? currentTodoNode.value ?? replyFallbackDoneNode.value
})

const currentActionNode = computed(() => {
  if (
    selectedWorkflowNode.value &&
    (selectedWorkflowNode.value.status === 'in_review' || selectedWorkflowNode.value.status === 'failed')
  ) {
    return selectedWorkflowNode.value
  }

  return currentFailedNode.value ?? currentReviewNode.value
})

const showApproveConfirmation = computed(() => {
  return (
    currentActionNode.value?.status === 'in_review' &&
    currentActionNode.value.id === approveConfirmationNodeId.value
  )
})

const showReviewCard = computed(() => {
  return task.value?.mode === 'workflow' && currentActionNode.value !== null
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

const hasFailedNode = computed(() => {
  return sortedNodes.value.some((node) => node.status === 'failed')
})

const canContinueReplyTargetNode = computed(() => {
  return Boolean(currentReplyTargetNode.value?.agentCliSessionId?.trim())
})

const canExecute = computed(() => {
  if (!task.value || !hasButtonAccess('executeTask') || !isEnvironmentReady.value) {
    return false
  }

  if (task.value.status === 'done' || hasRunningNode.value || hasInReviewNode.value || hasFailedNode.value) {
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
    selectedWorkflowNode.value.status === 'failed' ||
    selectedWorkflowNode.value.status === 'done'
  )
})

const canTerminateEnvironment = computed(() => {
  const currentTask = task.value

  if (
    !currentTask ||
    currentTask.status === 'done' ||
    !hasButtonAccess('executeTask') ||
    actionLoading.value ||
    isCliRunning.value ||
    !isEnvironmentReady.value
  ) {
    return false
  }

  return true
})

const replyDisabled = computed(() => {
  return (
    !task.value ||
    actionLoading.value ||
    isCliRunning.value ||
    !canContinueReplyTargetNode.value ||
    task.value.status === 'todo' ||
    task.value.status === 'done'
  )
})

const replyPlaceholder = computed(() => {
  if (task.value?.status === 'done') {
    return '任务已完成，无法继续回复...'
  }

  if (hasFailedNode.value) {
    if (!canContinueReplyTargetNode.value) {
      return '当前失败节点无法继续对话，请重置后重新执行...'
    }

    return '补充说明后将继续执行失败节点...'
  }

  if (task.value?.status === 'todo') {
    return '任务尚未开始，请先执行后再回复...'
  }

  if (isCliRunning.value) {
    return '任务执行中，暂不可回复...'
  }

  if (!canContinueReplyTargetNode.value) {
    return '当前节点无法继续对话，请重置后重新执行...'
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
      (node) =>
        node.status === 'in_progress' ||
        node.status === 'failed' ||
        node.status === 'in_review',
    )
    const tail = cur?.name ? ` · 当前：${cur.name}` : ''
    return `共 ${n} 个节点${tail}`
  }
  return executionPanelTitle.value
})

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
  const nextFailedStage = payload.failedStage

  if (
    typeof nextStatus !== 'string' ||
    typeof nextStage !== 'string' ||
    (nextFailedStage !== null &&
      nextFailedStage !== undefined &&
      typeof nextFailedStage !== 'string') ||
    (nextMessage !== null && nextMessage !== undefined && typeof nextMessage !== 'string')
  ) {
    return
  }

  const runtime = environment.value?.runtime ?? null
  const preview = environment.value?.preview ?? { status: 'unavailable', url: null }
  environment.value = {
    status: nextStatus as TaskEnvironmentStatus,
    stage: nextStage as TaskEnvironmentStage,
    failedStage:
      typeof nextFailedStage === 'string' ? (nextFailedStage as TaskEnvironmentStage) : null,
    stageLabel:
      nextStage === 'failed'
        ? '执行环境启动失败'
        : nextStage === 'stopped'
          ? '执行环境已释放'
          : buildEnvironmentSteps(
              nextStatus as TaskEnvironmentStatus,
              nextStage as TaskEnvironmentStage,
              typeof nextMessage === 'string' ? nextMessage : null,
              typeof nextFailedStage === 'string'
                ? (nextFailedStage as TaskEnvironmentStage)
                : null,
            ).find((step) => step.key === nextStage)?.label || '执行环境',
    message: typeof nextMessage === 'string' ? nextMessage : null,
    updatedAt: log.createdAt,
    runtime,
    preview,
    steps: buildEnvironmentSteps(
      nextStatus as TaskEnvironmentStatus,
      nextStage as TaskEnvironmentStage,
      typeof nextMessage === 'string' ? nextMessage : null,
      typeof nextFailedStage === 'string'
        ? (nextFailedStage as TaskEnvironmentStage)
        : null,
    ),
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
  if (logMessageMatchesAny(payload, NODE_STATUS_CHANGE_LOG_MESSAGES)) {
    bumpRightPanelRefresh([])
  }
  if (logMessageMatchesAny(payload, TASK_DETAIL_REFRESH_LOG_MESSAGES)) {
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
  approveConfirmationNodeId.value = null
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

const terminateEnvironment = async () => {
  if (!taskId.value || !canTerminateEnvironment.value) {
    return
  }

  actionLoading.value = true

  try {
    clearPendingStreamLogs()
    environment.value = await tasksApi.terminateEnvironment(taskId.value)
    bumpRightPanelRefresh([])
    message.success('执行环境已释放')
  } catch (error) {
    message.error(toErrorMessage(error, '终止执行环境失败'))
    await refreshEnvironment()
  } finally {
    actionLoading.value = false
  }
}

const submitApproveNode = async (node: TaskNode) => {
  if (!taskId.value) {
    return
  }

  detail.value = await tasksApi.approve(taskId.value, {
    nodeId: node.id,
  })
  approveConfirmationNodeId.value = null
  bumpRightPanelRefresh([])
}

const approveNode = async (node: TaskNode) => {
  if (!taskId.value || !canManageReview.value || actionLoading.value) {
    return
  }

  actionLoading.value = true

  try {
    approveConfirmationNodeId.value = null

    if (node.configJson?.requiresArtifact === true) {
      const artifactTree = await tasksApi.gitArtifactsTree(taskId.value, {
        nodeId: node.id,
      })

      if ((artifactTree.files?.length ?? 0) === 0) {
        approveConfirmationNodeId.value = node.id
        return
      }
    }

    await submitApproveNode(node)
  } catch (error) {
    message.error(toErrorMessage(error, '审批节点失败'))
  } finally {
    actionLoading.value = false
  }
}

const confirmApproveNode = async (node: TaskNode) => {
  if (
    !taskId.value ||
    !canManageReview.value ||
    actionLoading.value ||
    approveConfirmationNodeId.value !== node.id
  ) {
    return
  }

  actionLoading.value = true

  try {
    await submitApproveNode(node)
  } catch (error) {
    message.error(toErrorMessage(error, '审批节点失败'))
  } finally {
    actionLoading.value = false
  }
}

const cancelApproveConfirmation = () => {
  approveConfirmationNodeId.value = null
}

const handleSelectWorkflowNode = (nodeId: string) => {
  approveConfirmationNodeId.value = null
  selectedWorkflowNodeId.value = nodeId
}

const resolveAutoSelectedWorkflowNodeId = (nodes: TaskNode[]) => {
  const sortedByOrder = [...nodes].sort((left, right) => left.nodeOrder - right.nodeOrder)
  const findLastNodeIdByStatus = (status: TaskNode['status']) => {
    for (let index = sortedByOrder.length - 1; index >= 0; index -= 1) {
      if (sortedByOrder[index]?.status === status) {
        return sortedByOrder[index]?.id ?? null
      }
    }

    return null
  }

  const findFirstNodeIdByStatus = (status: TaskNode['status']) => {
    for (let index = 0; index < sortedByOrder.length; index += 1) {
      if (sortedByOrder[index]?.status === status) {
        return sortedByOrder[index]?.id ?? null
      }
    }

    return null
  }

  const prioritizedNodeId =
    findLastNodeIdByStatus('in_progress') ||
    findLastNodeIdByStatus('failed') ||
    findLastNodeIdByStatus('in_review') ||
    findFirstNodeIdByStatus('todo') ||
    findLastNodeIdByStatus('done')

  if (prioritizedNodeId) {
    return prioritizedNodeId
  }

  const selectedNodeStillExists = selectedWorkflowNodeId.value
    ? nodes.some((node) => node.id === selectedWorkflowNodeId.value)
    : false

  if (selectedNodeStillExists) {
    return selectedWorkflowNodeId.value
  }

  return null
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

return reactive({
    SSE_HEARTBEAT_TIMEOUT_MS,
    accessStore,
    actionLoading,
    activeProjectId,
    applyTaskLog,
    approveNode,
    approveConfirmationNodeId,
    areAllNodesDone,
    artifactFilePath,
    artifactOpenNonce,
    bumpRightPanelRefresh,
    canCompleteTask,
    canExecute,
    canInterruptExecution,
    canManageReview,
    canRemove,
    canResetSelectedWorkflowNode,
    canStartEnvironment,
    canTerminateEnvironment,
    clearMessageRefreshTimer,
    clearPendingStreamLogs,
    clearReconnectTimer,
    clearRightPanelWorkspaceRefreshTimer,
    clearStreamLogFlushTimer,
    confirmApproveNode,
    completeTask,
    connectStream,
    containerRef,
    contextSubtitle,
    currentActionNode,
    currentFailedNode,
    currentReviewNode,
    deleteOpen,
    detail,
    detailRefreshDebounceTimer,
    detailRequestId,
    disconnectStream,
    editForm,
    editOpen,
    environment,
    environmentStatus,
    environmentStatusClass,
    environmentStatusLabel,
    executeTask,
    executionCliId,
    executionMessages,
    executionPanelTitle,
    flushPendingStreamLogs,
    formatDate,
    getLastLogCursor,
    handleReply,
    handleSelectWorkflowNode,
    hasButtonAccess,
    hasFailedNode,
    hasInReviewNode,
    hasRunningNode,
    hasTodoNode,
    heartbeatCheckTimer,
    interruptExecution,
    isCliRunning,
    isDragging,
    isEnvironmentReady,
    isRightPanelVisible,
    lastSseEventTime,
    lastWorkflowAutoSyncSignature,
    leftPanelWidth,
    loadInitialTaskData,
    loading,
    logs,
    message,
    messageRefreshDebounceTimer,
    messages,
    pageLoading,
    pendingRightPanelArtifactRefreshPaths,
    pendingRightPanelArtifactRefreshUnknown,
    pendingStreamLogs,
    queryProjectId,
    queueTaskLog,
    reconnectTimer,
    refreshAccessContext,
    refreshEnvironment,
    refreshMessages,
    refreshTaskDetail,
    removeTask,
    removingTask,
    replyDisabled,
    replyPlaceholder,
    resetPendingRightPanelArtifactRefresh,
    resetSelectedWorkflowNode,
    resetTaskState,
    resolveAutoSelectedWorkflowNodeId,
    resolveStoredRightPanelVisible,
    rightPanelArtifactRefreshPaths,
    rightPanelRefreshToken,
    rightPanelWorkspaceRefreshDebounceTimer,
    route,
    router,
    cancelApproveConfirmation,
    saveEdit,
    savingEdit,
    scheduleReconnect,
    scheduleRefreshMessages,
    scheduleRefreshTaskDetail,
    scheduleRightPanelWorkspaceRefresh,
    selectedWorkflowNode,
    selectedWorkflowNodeId,
    showApproveConfirmation,
    shouldShowEnvironmentGate,
    showReviewCard,
    showWorkflowCard,
    sidebarRecentTasksDebounceTimer,
    sortedNodes,
    startDrag,
    startEnvironment,
    startHeartbeatCheck,
    stopHeartbeatCheck,
    streamAbortController,
    streamConnected,
    streamLogFlushTimer,
    syncIncrementalLogs,
    syncWorkflowSelectionIfNeeded,
    task,
    taskConfig,
    taskId,
    taskListRoute,
    taskModeLabel,
    taskStatusClass,
    taskStatusLabel,
    terminateEnvironment,
    updateEnvironmentFromLog,
    upsertLog,
    workflowCardRef,
    workflowNodeStatusSignature,
  })
}
