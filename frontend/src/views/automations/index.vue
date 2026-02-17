<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { notificationsApi } from '@/api/notifications'
import { observabilityApi } from '@/api/observability'
import { queueApi } from '@/api/queue'
import { tasksApi } from '@/api/tasks'
import { workflowApi } from '@/api/workflow'
import type { NotificationEvent, NotificationSetting } from '@/types/api/notifications'
import type { ObservabilityMetrics } from '@/types/api/observability'
import type { QueueStats } from '@/types/api/queue'
import type { Task } from '@/types/api/tasks'
import type { WorkflowTemplate } from '@/types/api/workflow'

const loading = ref(false)
const markingEventId = ref('')
const errorMessage = ref('')
const monitoringMessage = ref('')

const reviewTasks = ref<Task[]>([])
const activeTemplates = ref<WorkflowTemplate[]>([])
const unreadEvents = ref<NotificationEvent[]>([])
const notificationSetting = ref<NotificationSetting | null>(null)
const queueStats = ref<QueueStats | null>(null)
const observabilityMetrics = ref<ObservabilityMetrics | null>(null)

const runningTaskCount = computed(() => queueStats.value?.global.running ?? observabilityMetrics.value?.runningTasks ?? 0)
const queuedTaskCount = computed(() => queueStats.value?.global.queued ?? observabilityMetrics.value?.queueLength ?? 0)
const inReviewTaskCount = computed(
  () => observabilityMetrics.value?.statusCounts.inReview ?? reviewTasks.value.length,
)
const unreadEventCount = computed(() => unreadEvents.value.length)

const saturationRate = computed(() => queueStats.value?.global.saturationRate ?? observabilityMetrics.value?.concurrencyUsage ?? 0)
const maxConcurrency = computed(() => queueStats.value?.global.maxConcurrency ?? observabilityMetrics.value?.maxConcurrency ?? 0)
const availableSlots = computed(() => queueStats.value?.global.availableSlots ?? null)
const staleRunning = computed(() => queueStats.value?.global.staleRunning ?? observabilityMetrics.value?.staleRunning ?? 0)
const dispatchLagSeconds = computed(
  () => queueStats.value?.global.dispatchLagSeconds ?? observabilityMetrics.value?.dispatchLagSeconds ?? null,
)

const queueProjectRows = computed(() => {
  if (!queueStats.value) {
    return []
  }

  return [...queueStats.value.projects]
    .filter((project) => project.queued > 0 || project.running > 0 || project.inReview > 0)
    .sort((left, right) => {
      const leftWeight = left.queued * 10 + left.running * 3 + left.inReview * 2
      const rightWeight = right.queued * 10 + right.running * 3 + right.inReview * 2

      if (leftWeight !== rightWeight) {
        return rightWeight - leftWeight
      }

      return left.projectName.localeCompare(right.projectName)
    })
    .slice(0, 8)
})

const channelRows = computed(() => {
  const setting = notificationSetting.value
  return [
    {
      key: 'email',
      label: '邮件',
      enabled: setting?.emailEnabled ?? false,
      detail: '任务 done / in_review 时外发',
    },
    {
      key: 'webhook',
      label: 'Webhook',
      enabled: setting?.webhookEnabled ?? false,
      detail: setting?.webhookUrl?.trim() || '未配置 URL',
    },
    {
      key: 'in-app',
      label: '应用内通知',
      enabled: setting?.inAppEnabled ?? false,
      detail: '在设置页查看并标记已读',
    },
  ]
})

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatSeconds = (value: number | null) => {
  if (value === null || value < 0) {
    return '-'
  }

  if (value < 60) {
    return `${value}s`
  }

  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}m ${seconds}s`
}

const loadMonitoringData = async () => {
  monitoringMessage.value = ''

  const [queueResult, metricsResult] = await Promise.allSettled([queueApi.stats(), observabilityApi.metrics()])

  queueStats.value = queueResult.status === 'fulfilled' ? queueResult.value : null
  observabilityMetrics.value = metricsResult.status === 'fulfilled' ? metricsResult.value : null

  if (queueResult.status === 'rejected' && metricsResult.status === 'rejected') {
    monitoringMessage.value = '调度监控不可用（可能需要管理员权限）'
    return
  }

  if (queueResult.status === 'rejected') {
    monitoringMessage.value = getErrorMessage(queueResult.reason, '队列指标加载失败')
  } else if (metricsResult.status === 'rejected') {
    monitoringMessage.value = getErrorMessage(metricsResult.reason, '可观测指标加载失败')
  }
}

const loadPageData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [reviewTaskResponse, templateResponse, settingResponse, unreadEventResponse] = await Promise.all([
      tasksApi.list({ page: 1, limit: 100, status: 'in_review' }),
      workflowApi.list({ page: 1, limit: 100, isActive: true }),
      notificationsApi.setting(),
      notificationsApi.events({ unreadOnly: true, limit: 20 }),
    ])

    reviewTasks.value = reviewTaskResponse.data
    activeTemplates.value = templateResponse.data
    notificationSetting.value = settingResponse
    unreadEvents.value = unreadEventResponse

    await loadMonitoringData()
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '加载自动化页面失败')
  } finally {
    loading.value = false
  }
}

const markEventRead = async (eventId: string) => {
  if (!eventId || markingEventId.value) {
    return
  }

  markingEventId.value = eventId

  try {
    await notificationsApi.markRead(eventId)
    unreadEvents.value = unreadEvents.value.filter((event) => event.id !== eventId)
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '标记通知已读失败')
  } finally {
    markingEventId.value = ''
  }
}

onMounted(() => {
  void loadPageData()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">自动化</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">自动化与调度</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        对接任务、队列、模板与通知接口，集中查看当前自动化执行态势。
      </p>
      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    </section>

    <section class="grid gap-4 md:grid-cols-4">
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">运行中任务</p>
        <p class="mt-2 text-2xl font-semibold">{{ runningTaskCount }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">排队任务</p>
        <p class="mt-2 text-2xl font-semibold">{{ queuedTaskCount }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">待处理任务</p>
        <p class="mt-2 text-2xl font-semibold">{{ inReviewTaskCount }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">未读通知</p>
        <p class="mt-2 text-2xl font-semibold">{{ unreadEventCount }}</p>
      </article>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <article class="panel-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">调度概览</p>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadPageData"
          >
            刷新
          </button>
        </div>

        <div v-if="loading" class="mt-3 text-sm text-muted-foreground">加载中...</div>

        <div v-else class="mt-3 grid gap-2 text-sm text-muted-foreground">
          <p>最大并发：{{ maxConcurrency }}</p>
          <p>可用槽位：{{ availableSlots === null ? '-' : availableSlots }}</p>
          <p>并发饱和：{{ saturationRate.toFixed(2) }}%</p>
          <p>分发延迟：{{ formatSeconds(dispatchLagSeconds) }}</p>
          <p>过期租约：{{ staleRunning }}</p>
        </div>

        <p v-if="monitoringMessage" class="mt-3 text-xs text-muted-foreground">{{ monitoringMessage }}</p>
      </article>

      <article class="panel-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">通知通道状态</p>
          <RouterLink
            to="/settings"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          >
            前往设置
          </RouterLink>
        </div>

        <ul class="mt-3 space-y-2 text-sm">
          <li
            v-for="channel in channelRows"
            :key="channel.key"
            class="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2"
          >
            <div>
              <p class="font-semibold">{{ channel.label }}</p>
              <p class="text-xs text-muted-foreground">{{ channel.detail }}</p>
            </div>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="channel.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
            >
              {{ channel.enabled ? '启用' : '关闭' }}
            </span>
          </li>
        </ul>
      </article>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <article class="panel-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">排队项目（Top）</p>
          <RouterLink
            to="/tasks"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          >
            查看任务
          </RouterLink>
        </div>

        <div class="mt-3 space-y-2 text-sm">
          <div
            v-for="project in queueProjectRows"
            :key="project.projectId"
            class="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2"
          >
            <div>
              <p class="font-semibold">{{ project.projectName }}</p>
              <p class="text-xs text-muted-foreground">并发上限 {{ project.maxConcurrency }}</p>
            </div>
            <p class="text-xs text-muted-foreground">运行 {{ project.running }} · 排队 {{ project.queued }} · 待处理 {{ project.inReview }}</p>
          </div>

          <div v-if="queueProjectRows.length === 0" class="rounded-xl border border-dashed border-border bg-background/30 px-3 py-4 text-xs text-muted-foreground">
            暂无排队项目。
          </div>
        </div>
      </article>

      <article class="panel-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">待处理任务</p>
          <p class="text-xs text-muted-foreground">共 {{ reviewTasks.length }} 条</p>
        </div>

        <div class="mt-3 space-y-2 text-sm">
          <RouterLink
            v-for="task in reviewTasks.slice(0, 8)"
            :key="task.id"
            :to="`/tasks/${task.id}`"
            class="block rounded-xl border border-border bg-background/60 px-3 py-2 transition hover:bg-background"
          >
            <p class="font-semibold">{{ task.title }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ task.mode }} · {{ formatDate(task.updatedAt ?? task.createdAt) }}</p>
          </RouterLink>

          <div v-if="reviewTasks.length === 0" class="rounded-xl border border-dashed border-border bg-background/30 px-3 py-4 text-xs text-muted-foreground">
            当前没有待处理任务。
          </div>
        </div>
      </article>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <article class="panel-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">启用模板</p>
          <RouterLink
            to="/workflow"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          >
            管理模板
          </RouterLink>
        </div>

        <div class="mt-3 space-y-2 text-sm">
          <div
            v-for="template in activeTemplates.slice(0, 8)"
            :key="template.id"
            class="rounded-xl border border-border bg-background/60 px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold">{{ template.name }}</p>
              <span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                v{{ template.latestVersion }}
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{{ template.mode }} · 节点 {{ template.nodesJson.length }}</p>
          </div>

          <div v-if="activeTemplates.length === 0" class="rounded-xl border border-dashed border-border bg-background/30 px-3 py-4 text-xs text-muted-foreground">
            暂无启用模板，请先在工作流页面创建并发布。
          </div>
        </div>
      </article>

      <article class="panel-card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">未读通知</p>
          <p class="text-xs text-muted-foreground">仅展示前 8 条</p>
        </div>

        <div class="mt-3 space-y-2 text-sm">
          <div
            v-for="event in unreadEvents.slice(0, 8)"
            :key="event.id"
            class="rounded-xl border border-border bg-background/60 px-3 py-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="font-semibold">{{ event.title }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ event.content }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ formatDate(event.createdAt) }}</p>
              </div>
              <button
                class="rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="markingEventId === event.id"
                type="button"
                @click="markEventRead(event.id)"
              >
                {{ markingEventId === event.id ? '处理中...' : '标记已读' }}
              </button>
            </div>
          </div>

          <div v-if="unreadEvents.length === 0" class="rounded-xl border border-dashed border-border bg-background/30 px-3 py-4 text-xs text-muted-foreground">
            暂无未读通知。
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
