<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { artifactsApi } from '@/api/artifacts'
import ArtifactPreviewPanel from '@/components/tasks/ArtifactPreviewPanel.vue'
import { openSseStream } from '@/api/http'
import { tasksApi } from '@/api/tasks'
import type { ArtifactPreview } from '@/types/api/artifacts'
import type { Task, TaskArtifact, TaskArtifactType, TaskDetail, TaskLog, TaskNode } from '@/types/api/tasks'

const route = useRoute()
const taskId = computed(() => String(route.params.id ?? ''))

const loading = ref(false)
const actionLoading = ref(false)
const uploadingArtifact = ref(false)
const downloadingArtifactId = ref<string | null>(null)
const errorMessage = ref('')

const detail = ref<TaskDetail | null>(null)
const logs = ref<TaskLog[]>([])
const artifacts = ref<TaskArtifact[]>([])
const previewLoading = ref(false)
const previewErrorMessage = ref('')
const selectedPreviewArtifact = ref<TaskArtifact | null>(null)
const artifactPreview = ref<ArtifactPreview | null>(null)

const closeArtifactPreview = () => {
  previewLoading.value = false
  previewErrorMessage.value = ''
  selectedPreviewArtifact.value = null
  artifactPreview.value = null
}

const followTail = ref(true)
const wrapLines = ref(false)
const logKeyword = ref('')
const streamConnected = ref(false)

const logViewport = ref<HTMLDivElement | null>(null)

const artifactForm = reactive({
  taskNodeId: '',
  artifactType: 'report' as TaskArtifactType,
  name: '',
  content: '',
  downloadUrl: '',
})

let streamAbortController: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

const statusLabelMap: Record<Task['status'], string> = {
  todo: '待执行',
  in_progress: '执行中',
  in_review: '待处理',
  done: '已完成',
}

const statusClassMap: Record<Task['status'], string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

const task = computed(() => detail.value?.task ?? null)

const sortedNodes = computed(() => {
  if (!detail.value) {
    return [] as TaskNode[]
  }

  return [...detail.value.nodes].sort((left, right) => left.nodeOrder - right.nodeOrder)
})

const visibleLogs = computed(() => {
  const keyword = logKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return logs.value
  }

  return logs.value.filter((log) => {
    return log.message.toLowerCase().includes(keyword) || log.level.toLowerCase().includes(keyword)
  })
})

const canExecute = computed(() => {
  if (!task.value) {
    return false
  }

  return task.value.status === 'todo' || task.value.status === 'in_review'
})

const canCancel = computed(() => {
  return task.value?.status === 'in_progress'
})

const canCleanupWorktree = computed(() => {
  return Boolean(task.value?.gitWorktreePath)
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

const logLevelClass = (level: TaskLog['level']) => {
  if (level === 'error') return 'text-red-600 dark:text-red-300'
  if (level === 'warn') return 'text-amber-600 dark:text-amber-300'
  if (level === 'debug') return 'text-violet-600 dark:text-violet-300'
  return 'text-muted-foreground'
}

const upsertLog = (nextLog: TaskLog) => {
  const existedIndex = logs.value.findIndex((log) => log.id === nextLog.id)

  if (existedIndex >= 0) {
    logs.value[existedIndex] = nextLog
    return
  }

  logs.value.push(nextLog)
  logs.value.sort((left, right) => {
    const leftAt = new Date(left.createdAt).getTime()
    const rightAt = new Date(right.createdAt).getTime()
    return leftAt - rightAt
  })
}

const clearReconnectTimer = () => {
  if (!reconnectTimer) {
    return
  }

  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

const disconnectStream = () => {
  clearReconnectTimer()

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
  const since = lastLog?.createdAt
  const afterId = lastLog?.id

  try {
    streamConnected.value = true

    await openSseStream(
      `/tasks/${taskId.value}/stream`,
      {
        since,
        afterId,
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
          } catch (error) {
            void error
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

const loadTaskData = async () => {
  if (!taskId.value) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  closeArtifactPreview()

  try {
    const [detailResponse, logResponse, artifactResponse] = await Promise.all([
      tasksApi.detailWithNodes(taskId.value),
      tasksApi.logs(taskId.value, { limit: 200 }),
      tasksApi.artifacts(taskId.value),
    ])

    detail.value = detailResponse
    logs.value = [...logResponse].sort((left, right) => {
      const leftAt = new Date(left.createdAt).getTime()
      const rightAt = new Date(right.createdAt).getTime()
      return leftAt - rightAt
    })
    artifacts.value = artifactResponse
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载任务详情失败'
  } finally {
    loading.value = false
  }
}

const refreshTaskDetail = async () => {
  if (!taskId.value) {
    return
  }

  detail.value = await tasksApi.detailWithNodes(taskId.value)
}

const refreshArtifacts = async () => {
  if (!taskId.value) {
    return
  }

  artifacts.value = await tasksApi.artifacts(taskId.value)
}

const executeTask = async () => {
  if (!taskId.value) {
    return
  }

  actionLoading.value = true
  errorMessage.value = ''

  try {
    detail.value = await tasksApi.execute(taskId.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '执行任务失败'
  } finally {
    actionLoading.value = false
  }
}

const cancelTask = async () => {
  if (!taskId.value) {
    return
  }

  actionLoading.value = true
  errorMessage.value = ''

  try {
    detail.value = await tasksApi.cancel(taskId.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '取消任务失败'
  } finally {
    actionLoading.value = false
  }
}

const cleanupTaskWorktree = async () => {
  if (!taskId.value) {
    return
  }

  actionLoading.value = true
  errorMessage.value = ''

  try {
    detail.value = await tasksApi.cleanupWorktree(taskId.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '清理工作区失败'
  } finally {
    actionLoading.value = false
  }
}

const retryNode = async (node: TaskNode) => {
  if (!taskId.value) {
    return
  }

  actionLoading.value = true
  errorMessage.value = ''

  try {
    detail.value = await tasksApi.retry(taskId.value, {
      nodeId: node.id,
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '重试节点失败'
  } finally {
    actionLoading.value = false
  }
}

const approveNode = async (node: TaskNode) => {
  if (!taskId.value) {
    return
  }

  actionLoading.value = true
  errorMessage.value = ''

  try {
    detail.value = await tasksApi.approve(taskId.value, {
      nodeId: node.id,
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '审批节点失败'
  } finally {
    actionLoading.value = false
  }
}

const createArtifact = async () => {
  if (!taskId.value || !artifactForm.name.trim()) {
    return
  }

  uploadingArtifact.value = true
  errorMessage.value = ''

  try {
    await tasksApi.createArtifact(taskId.value, {
      taskNodeId: artifactForm.taskNodeId || undefined,
      artifactType: artifactForm.artifactType,
      name: artifactForm.name.trim(),
      content: artifactForm.content.trim() || undefined,
      downloadUrl: artifactForm.downloadUrl.trim() || undefined,
    })

    artifactForm.taskNodeId = ''
    artifactForm.artifactType = 'report'
    artifactForm.name = ''
    artifactForm.content = ''
    artifactForm.downloadUrl = ''

    await refreshArtifacts()
    await refreshTaskDetail()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '上传产物失败'
  } finally {
    uploadingArtifact.value = false
  }
}

const mergeArtifact = (artifactId: string, payload: { downloadUrl?: string | null; content?: string | null }) => {
  artifacts.value = artifacts.value.map((artifact) => {
    if (artifact.id !== artifactId) {
      return artifact
    }

    return {
      ...artifact,
      ...(payload.downloadUrl !== undefined ? { downloadUrl: payload.downloadUrl } : {}),
      ...(payload.content !== undefined ? { content: payload.content } : {}),
    }
  })
}

const openExternalUrl = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const downloadTextContent = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(objectUrl)
}

const resolveArtifactData = async (artifact: TaskArtifact): Promise<TaskArtifact> => {
  if (artifact.downloadUrl || artifact.content) {
    return artifact
  }

  const response = await artifactsApi.download(artifact.id)

  mergeArtifact(artifact.id, {
    downloadUrl: response.downloadUrl,
    content: response.content,
  })

  return {
    ...artifact,
    downloadUrl: response.downloadUrl ?? artifact.downloadUrl ?? null,
    content: response.content ?? artifact.content ?? null,
  }
}

const openArtifactPreview = async (artifact: TaskArtifact) => {
  downloadingArtifactId.value = artifact.id
  previewLoading.value = true
  previewErrorMessage.value = ''
  selectedPreviewArtifact.value = artifact
  artifactPreview.value = null

  try {
    artifactPreview.value = await artifactsApi.preview(artifact.id)
  } catch (error) {
    previewErrorMessage.value = error instanceof Error ? error.message : '产物预览失败'
  } finally {
    previewLoading.value = false
    downloadingArtifactId.value = null
  }
}

const downloadArtifact = async (artifact: TaskArtifact) => {
  downloadingArtifactId.value = artifact.id
  errorMessage.value = ''

  try {
    const resolvedArtifact = await resolveArtifactData(artifact)

    if (resolvedArtifact.downloadUrl) {
      openExternalUrl(resolvedArtifact.downloadUrl)
      return
    }

    if (resolvedArtifact.content) {
      downloadTextContent(resolvedArtifact.name, resolvedArtifact.content)
      return
    }

    errorMessage.value = '产物下载不可用'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '产物下载失败'
  } finally {
    downloadingArtifactId.value = null
  }
}

watch(
  () => visibleLogs.value.length,
  async () => {
    if (!followTail.value) {
      return
    }

    await nextTick()

    const viewport = logViewport.value
    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight
  },
)

watch(
  () => taskId.value,
  async () => {
    await loadTaskData()
    await connectStream()
  },
)

onMounted(async () => {
  await loadTaskData()
  await connectStream()
})

onBeforeUnmount(() => {
  disconnectStream()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <RouterLink to="/tasks" class="hover:text-foreground hover:underline">任务列表</RouterLink>
        <span>/</span>
        <span class="font-mono">{{ taskId }}</span>
      </div>

      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-2">
          <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">{{ task?.title ?? '任务详情' }}</h1>
          <div class="flex flex-wrap items-center gap-2">
            <span v-if="task" class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold" :class="statusClassMap[task.status]">
              {{ statusLabelMap[task.status] }}
            </span>
            <span class="text-xs text-muted-foreground">任务 ID：{{ task?.id ?? '-' }}</span>
            <span class="text-xs text-muted-foreground">•</span>
            <span class="text-xs text-muted-foreground">项目：{{ task?.projectId ?? '-' }}</span>
            <span class="text-xs text-muted-foreground">•</span>
            <span class="text-xs text-muted-foreground">模式：{{ task?.mode ?? '-' }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="actionLoading || !canExecute"
            type="button"
            @click="executeTask"
          >
            执行
          </button>
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="actionLoading || !canCancel"
            type="button"
            @click="cancelTask"
          >
            取消
          </button>
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="actionLoading || !canCleanupWorktree"
            type="button"
            @click="cleanupTaskWorktree"
          >
            清理工作区
          </button>
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
            type="button"
            @click="loadTaskData"
          >
            刷新
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    </section>

    <section v-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <div class="space-y-6">
        <div class="panel-card overflow-hidden">
          <div class="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-semibold">实时日志</p>
              <p class="text-xs text-muted-foreground">
                SSE 状态：
                <span :class="streamConnected ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'">
                  {{ streamConnected ? '已连接' : '未连接' }}
                </span>
              </p>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                v-model="logKeyword"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring sm:w-56"
                placeholder="搜索日志"
                type="search"
              />
              <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input v-model="followTail" class="h-4 w-4" type="checkbox" />
                自动跟随
              </label>
              <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input v-model="wrapLines" class="h-4 w-4" type="checkbox" />
                自动换行
              </label>
            </div>
          </div>

          <div
            ref="logViewport"
            class="h-[420px] overflow-auto p-5 font-mono text-xs leading-relaxed"
            :class="wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'"
          >
            <div
              v-for="log in visibleLogs"
              :key="log.id"
              class="flex gap-3 rounded-md px-1 py-0.5 hover:bg-background/60"
            >
              <span class="w-52 shrink-0 text-muted-foreground">{{ formatDate(log.createdAt) }}</span>
              <span class="w-14 shrink-0 font-semibold" :class="logLevelClass(log.level)">
                {{ log.level.toUpperCase() }}
              </span>
              <span class="min-w-0 flex-1 text-foreground/90">{{ log.message }}</span>
            </div>

            <div v-if="visibleLogs.length === 0" class="text-muted-foreground">暂无日志。</div>
          </div>
        </div>

        <div class="panel-card overflow-hidden">
          <div class="border-b border-border px-5 py-4">
            <p class="text-sm font-semibold">执行节点</p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="border-b border-border bg-background/60">
                <tr class="text-xs font-semibold text-muted-foreground">
                  <th class="px-5 py-3">节点</th>
                  <th class="px-5 py-3">类型</th>
                  <th class="px-5 py-3">状态</th>
                  <th class="px-5 py-3">尝试次数</th>
                  <th class="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="node in sortedNodes" :key="node.id" class="transition hover:bg-background/70">
                  <td class="px-5 py-4">
                    <p class="font-semibold">#{{ node.nodeOrder }} {{ node.name }}</p>
                    <p v-if="node.errorMessage" class="mt-1 text-xs text-destructive">{{ node.errorMessage }}</p>
                  </td>
                  <td class="px-5 py-4 text-muted-foreground">{{ node.nodeType }}</td>
                  <td class="px-5 py-4">
                    <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="statusClassMap[node.status]">
                      {{ statusLabelMap[node.status] }}
                    </span>
                  </td>
                  <td class="px-5 py-4 text-muted-foreground">{{ node.attempt }}</td>
                  <td class="px-5 py-4">
                    <div class="flex justify-end gap-2">
                      <button
                        v-if="node.status === 'in_review'"
                        class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="actionLoading"
                        type="button"
                        @click="retryNode(node)"
                      >
                        重试
                      </button>
                      <button
                        v-if="node.status === 'in_review'"
                        class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="actionLoading"
                        type="button"
                        @click="approveNode(node)"
                      >
                        审批通过
                      </button>
                    </div>
                  </td>
                </tr>

                <tr v-if="sortedNodes.length === 0">
                  <td class="px-5 py-6 text-sm text-muted-foreground" colspan="5">暂无节点信息。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="panel-card p-5">
          <p class="text-sm font-semibold">执行摘要</p>
          <dl class="mt-4 grid gap-3 text-xs">
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">任务 ID</dt>
              <dd class="font-mono text-foreground">{{ task?.id ?? '-' }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">创建时间</dt>
              <dd class="text-foreground">{{ formatDate(task?.createdAt) }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">更新时间</dt>
              <dd class="text-foreground">{{ formatDate(task?.updatedAt) }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">工作分支</dt>
              <dd class="text-foreground">{{ task?.branch ?? '-' }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">基线分支</dt>
              <dd class="text-foreground">{{ task?.gitBaseBranch ?? '-' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-muted-foreground">工作区路径</dt>
              <dd class="max-w-[240px] truncate text-right font-mono text-foreground" :title="task?.gitWorktreePath ?? '-'">
                {{ task?.gitWorktreePath ?? '-' }}
              </dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">清理时间</dt>
              <dd class="text-foreground">{{ formatDate(task?.sandboxCleanupAt ?? undefined) }}</dd>
            </div>
          </dl>
        </div>

        <div
          v-if="task?.gitWorktreePath"
          class="panel-card border border-amber-500/40 bg-amber-500/10 p-5 text-amber-900 dark:text-amber-200"
        >
          <p class="text-sm font-semibold">Sandbox 提示</p>
          <p class="mt-2 text-xs leading-relaxed">
            当前任务使用目录级隔离（MVP）：仅允许白名单目录、执行目录权限收敛，并在清理前进行路径归属校验；并非容器级强隔离。
          </p>
        </div>

        <div class="panel-card p-5">
          <p class="text-sm font-semibold">上传产物</p>
          <form class="mt-4 space-y-3" @submit.prevent="createArtifact">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">名称</span>
              <input
                v-model="artifactForm.name"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如 report.md"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">类型</span>
              <select
                v-model="artifactForm.artifactType"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="report">report</option>
                <option value="diff">diff</option>
                <option value="file">file</option>
                <option value="preview">preview</option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">关联节点（可选）</span>
              <select
                v-model="artifactForm.taskNodeId"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="">不关联节点</option>
                <option v-for="node in sortedNodes" :key="node.id" :value="node.id">
                  #{{ node.nodeOrder }} {{ node.name }}
                </option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">下载地址（可选）</span>
              <input
                v-model="artifactForm.downloadUrl"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">内容（可选）</span>
              <textarea
                v-model="artifactForm.content"
                class="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
              />
            </label>

            <button
              class="h-9 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="uploadingArtifact"
              type="submit"
            >
              {{ uploadingArtifact ? '上传中...' : '上传产物' }}
            </button>
          </form>
        </div>

        <div class="panel-card p-5">
          <p class="text-sm font-semibold">产物列表</p>
          <ul class="mt-4 space-y-3 text-sm">
            <li
              v-for="artifact in artifacts"
              :key="artifact.id"
              class="rounded-xl border border-border bg-background/60 p-4 transition hover:bg-background/85"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-semibold">{{ artifact.name }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ artifact.artifactType }} · {{ formatDate(artifact.createdAt) }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <button
                    class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="downloadingArtifactId === artifact.id"
                    type="button"
                    @click="openArtifactPreview(artifact)"
                  >
                    {{ downloadingArtifactId === artifact.id ? '处理中...' : '预览' }}
                  </button>
                  <button
                    class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="downloadingArtifactId === artifact.id"
                    type="button"
                    @click="downloadArtifact(artifact)"
                  >
                    下载
                  </button>
                </div>
              </div>

              <p v-if="artifact.downloadUrl" class="mt-2 break-all text-xs text-muted-foreground">
                下载地址：{{ artifact.downloadUrl }}
              </p>
              <pre
                v-if="artifact.content"
                class="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-background p-2 text-xs text-foreground"
              >{{ artifact.content }}</pre>
            </li>

            <li v-if="artifacts.length === 0" class="rounded-xl border border-border bg-background/60 px-3 py-3 text-sm text-muted-foreground">
              暂无产物。
            </li>
          </ul>
        </div>

        <ArtifactPreviewPanel
          :artifact="selectedPreviewArtifact"
          :preview="artifactPreview"
          :loading="previewLoading"
          :error-message="previewErrorMessage"
          @close="closeArtifactPreview"
        />
      </div>
    </section>
  </div>
</template>
