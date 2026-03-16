<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { useAccessStore } from '@/stores/modules/access'
import ExecutionPanel from '@/components/tasks/detail/ExecutionPanel.vue'
import ReplyCard from '@/components/tasks/detail/ReplyCard.vue'
import ReviewCard from '@/components/tasks/detail/ReviewCard.vue'
import RightPanelSection from '@/components/tasks/detail/RightPanelSection.vue'
import TaskCard from '@/components/tasks/detail/TaskCard.vue'
import TaskDialogs, { type TaskEditFormValue } from '@/components/tasks/detail/TaskDialogs.vue'
import WorkflowCard from '@/components/tasks/detail/WorkflowCard.vue'
import { openSseStream } from '@/api/http'
import { tasksApi } from '@/api/tasks'
import type { Task, TaskDetail, TaskLog, TaskMessage, TaskNode } from '@/types/api/tasks'
import { STORAGE_KEYS } from '@/types/common/storage'
import { BUTTON_ACCESS_CONFIG, hasSomeAccess } from '@/constants/access-control'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'TaskDetailView',
})

const route = useRoute()
const hasButtonAccess = (buttonKey: keyof typeof BUTTON_ACCESS_CONFIG) => {
  return hasSomeAccess(BUTTON_ACCESS_CONFIG[buttonKey].capabilities, (capability) => accessStore.hasCapability(capability))
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
const leftPanelWidth = ref(33.3333)
const isDragging = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const detail = ref<TaskDetail | null>(null)
const logs = ref<TaskLog[]>([])
const messages = ref<TaskMessage[]>([])
const selectedWorkflowNodeId = ref<string | null>(null)

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
let messageRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null

const statusLabelMap: Record<Task['status'], string> = {
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

const taskConfig = computed(() => task.value?.configJson ?? null)

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

const currentReviewNode = computed(() => {
  return sortedNodes.value.find((node) => node.status === 'in_review') ?? null
})

const canExecute = computed(() => {
  if (!task.value || !hasButtonAccess('executeTask')) {
    return false
  }

  return task.value.status === 'todo'
})

const canRemove = computed(() => {
  return hasButtonAccess('deleteTask')
})

const canManageReview = computed(() => {
  return hasButtonAccess('executeTask')
})

const isCliRunning = computed(() => {
  return task.value?.status === 'in_progress'
})

const canInterruptExecution = computed(() => {
  return isCliRunning.value && hasButtonAccess('cancelTask')
})

const replyDisabled = computed(() => {
  return !task.value || actionLoading.value || isCliRunning.value
})

const replyPlaceholder = computed(() => {
  if (task.value?.status === 'in_progress') {
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
    ? sortedNodes.value.find((node) => node.id === selectedWorkflowNodeId.value) ?? null
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
  const payloadRole = payload && typeof payload.messageRole === 'string' ? payload.messageRole : null

  if (payloadRole === 'user' || payloadRole === 'assistant' || payloadRole === 'system' || payloadRole === 'error') {
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
  } else {
    logs.value.push(nextLog)
  }

  logs.value.sort((left, right) => {
    const leftAt = new Date(left.createdAt).getTime()
    const rightAt = new Date(right.createdAt).getTime()
    return leftAt - rightAt
  })
}

const shouldRefreshTaskDetailForLog = (log: TaskLog) => {
  const refreshMessages = [
    'Node execution started',
    'Agent node completed; pending approval',
    'Agent node completed successfully',
    'Task completed; worktree preserved',
    'Agent node execution failed',
    'Node approved and marked as done',
  ]

  return refreshMessages.some((messageText) => log.message?.includes(messageText))
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

const disconnectStream = () => {
  clearReconnectTimer()
  clearMessageRefreshTimer()
  if (detailRefreshDebounceTimer) {
    clearTimeout(detailRefreshDebounceTimer)
    detailRefreshDebounceTimer = null
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

  streamAbortController = new AbortController()

  const lastLog = logs.value.length > 0 ? logs.value[logs.value.length - 1] : undefined

  try {
    streamConnected.value = true

    await openSseStream(
      `/tasks/${taskId.value}/stream`,
      {
        since: lastLog?.createdAt,
        afterId: lastLog?.id,
      },
      {
        signal: streamAbortController.signal,
        onEvent: (event) => {
          if (event.event && event.event !== 'task-log') {
            return
          }

          try {
            const payload = JSON.parse(event.data) as TaskLog
            upsertLog(payload)
            if (isAgentOutputLog(payload) || shouldRefreshTaskDetailForLog(payload)) {
              scheduleRefreshMessages()
            }
            if (shouldRefreshTaskDetailForLog(payload)) {
              if (detailRefreshDebounceTimer) clearTimeout(detailRefreshDebounceTimer)
              detailRefreshDebounceTimer = setTimeout(() => {
                detailRefreshDebounceTimer = null
                void loadTaskData()
              }, 300)
            }
          } catch {
            // ignore malformed task-log payload
          }
        },
        onError: () => {
          streamConnected.value = false
          scheduleReconnect()
        },
      },
    )

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
    messages.value = logs.value
      .filter(isAgentOutputLog)
      .map(mapLogToMessage)
  }
}

const refreshAccessContext = async (projectId: string) => {
  try {
    await accessStore.loadContext((projectId ? { projectId } : {}))
  } catch (error) {
    void error
    accessStore.clear()
  }
}

const loadTaskData = async () => {
  if (!taskId.value) {
    return
  }

  loading.value = true

  try {
    const [detailResponse, logResponse, messageResponse] = await Promise.all([
      tasksApi.detailWithNodes(taskId.value),
      tasksApi.logs(taskId.value, { limit: 300 }),
      tasksApi.messages(taskId.value),
    ])

    await refreshAccessContext(detailResponse.task.projectId || queryProjectId.value)

    detail.value = detailResponse
    logs.value = [...logResponse].sort((left, right) => {
      const leftAt = new Date(left.createdAt).getTime()
      const rightAt = new Date(right.createdAt).getTime()
      return leftAt - rightAt
    })
    messages.value = messageResponse
  } catch (error) {
    message.error(toErrorMessage(error, '加载任务详情失败'))
  } finally {
    loading.value = false
  }
}

const executeTask = async () => {
  if (!taskId.value || !canExecute.value) {
    return
  }

  actionLoading.value = true

  try {
    detail.value = await tasksApi.execute(taskId.value)
    rightPanelRefreshToken.value += 1
    message.success('任务已开始执行')
  } catch (error) {
    message.error(toErrorMessage(error, '执行任务失败'))
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
    rightPanelRefreshToken.value += 1
    message.success('节点审批已通过')
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
    rightPanelRefreshToken.value += 1
    message.success('回复已提交')
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
    rightPanelRefreshToken.value += 1
    message.success('任务已停止执行')
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
    await router.push(taskListRoute.value)
  } catch (error) {
    message.error(toErrorMessage(error, '删除任务失败'))
  } finally {
    removingTask.value = false
  }
}

watch(
  () => sortedNodes.value,
  (nodes) => {
    if (nodes.length === 0) {
      selectedWorkflowNodeId.value = null
      return
    }

    selectedWorkflowNodeId.value = resolveAutoSelectedWorkflowNodeId(nodes)
  },
  {
    immediate: true,
  },
)

watch(
  () => taskId.value,
  async () => {
    await loadTaskData()
    await connectStream()
  },
)

watch(isRightPanelVisible, (visible) => {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(STORAGE_KEYS.taskDetailRightPanelVisible, String(visible))
})

onMounted(async () => {
  await loadTaskData()
  await connectStream()
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
    leftPanelWidth.value = Math.min(Math.max(pct, 20), 80)
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
    <section
      v-if="loading"
      class="panel-card flex h-full w-full items-center justify-center p-6 text-sm text-muted-foreground"
    >
      加载中...
    </section>

    <section
      v-else
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
        <div class="flex min-h-0 w-full flex-1 flex-col">
          <TaskCard
            :task="task"
            :status-label="taskStatusLabel"
            :status-class="taskStatusClass"
            :mode-label="taskModeLabel"
            :branch-label="task?.gitBranch ?? '-'"
            :action-loading="actionLoading"
            :can-execute="canExecute"
            :can-remove="canRemove"
            :right-panel-visible="isRightPanelVisible"
            @execute="executeTask"
            @refresh="loadTaskData"
            @remove="deleteOpen = true"
            @toggle-right-panel="isRightPanelVisible = !isRightPanelVisible"
          />

          <WorkflowCard
            v-if="showWorkflowCard"
            :nodes="sortedNodes"
            :selected-node-id="selectedWorkflowNodeId"
            @select-node="handleSelectWorkflowNode"
          />

          <ReviewCard
            :node="currentReviewNode"
            :status-label-map="statusLabelMap"
            :can-manage-review="canManageReview"
            @approve-node="approveNode"
          />

          <ExecutionPanel
            :title="executionPanelTitle"
            :loading="loading"
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

      <div
        v-if="isRightPanelVisible"
        class="bg-border/50 h-full w-1 shrink-0 cursor-col-resize transition-colors hover:bg-primary/50"
        :class="{ 'bg-primary/50': isDragging }"
        @mousedown.prevent="startDrag"
      />

      <RightPanelSection
        v-if="isRightPanelVisible"
        :task-id="taskId"
        :project-id="activeProjectId"
        :branch-name="task?.gitBranch || null"
        :base-branch="task?.gitBaseBranch || null"
        :refresh-token="rightPanelRefreshToken"
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
  </div>
</template>
