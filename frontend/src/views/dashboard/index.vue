<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { notificationsApi } from '@/api/notifications'
import { observabilityApi } from '@/api/observability'
import { projectsApi } from '@/api/projects'
import { queueApi } from '@/api/queue'
import { tasksApi } from '@/api/tasks'
import type { ObservabilityAlert, ObservabilityMetrics } from '@/types/api/observability'
import type { Project } from '@/types/api/projects'
import type { QueueStats } from '@/types/api/queue'
import type { Task } from '@/types/api/tasks'
import { fetchAllPages } from '@/utils/pagination'

defineOptions({
  name: 'DashboardView',
})

const loading = ref(false)
const errorMessage = ref('')
const monitoringMessage = ref('')

const projects = ref<Project[]>([])
const tasks = ref<Task[]>([])
const unreadNotifications = ref(0)
const observabilityMetrics = ref<ObservabilityMetrics | null>(null)
const queueStats = ref<QueueStats | null>(null)

const runningTaskCount = computed(() => tasks.value.filter((task) => task.status === 'in_progress').length)
const reviewTaskCount = computed(() => tasks.value.filter((task) => task.status === 'in_review').length)
const doneTaskCount = computed(() => tasks.value.filter((task) => task.status === 'done').length)

const recentTasks = computed(() => {
  return [...tasks.value]
    .sort((left, right) => {
      const leftAt = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
      const rightAt = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime()
      return rightAt - leftAt
    })
    .slice(0, 5)
})

const projectCount = computed(() => observabilityMetrics.value?.totalProjects ?? projects.value.length)
const runningCount = computed(() => observabilityMetrics.value?.runningTasks ?? runningTaskCount.value)
const queueLength = computed(() => queueStats.value?.global.queued ?? observabilityMetrics.value?.queueLength ?? reviewTaskCount.value)
const maxConcurrency = computed(() => queueStats.value?.global.maxConcurrency ?? observabilityMetrics.value?.maxConcurrency ?? 0)
const saturationRate = computed(() => queueStats.value?.global.saturationRate ?? observabilityMetrics.value?.concurrencyUsage ?? 0)
const availableSlots = computed(() => {
  if (queueStats.value) {
    return queueStats.value.global.availableSlots
  }

  if (maxConcurrency.value > 0) {
    return Math.max(maxConcurrency.value - runningCount.value, 0)
  }

  return 0
})

const saturationLabel = computed(() => `${saturationRate.value.toFixed(2)}%`)
const saturationBarWidth = computed(() => `${Math.min(Math.max(saturationRate.value, 0), 100)}%`)
const alertItems = computed<ObservabilityAlert[]>(() => observabilityMetrics.value?.alerts ?? [])

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

const uniqueById = <T extends { id: string }>(items: T[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

const loadAllProjects = async () => {
  const records = await fetchAllPages((page, limit) => projectsApi.list({ page, limit }))
  return uniqueById(records)
}

const loadAllTasks = async () => {
  const records = await fetchAllPages((page, limit) => tasksApi.list({ page, limit }))
  return uniqueById(records)
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

const loadMonitoringData = async () => {
  monitoringMessage.value = ''

  const [metricsResult, queueResult] = await Promise.allSettled([observabilityApi.metrics(), queueApi.stats()])

  observabilityMetrics.value = metricsResult.status === 'fulfilled' ? metricsResult.value : null
  queueStats.value = queueResult.status === 'fulfilled' ? queueResult.value : null

  if (metricsResult.status === 'rejected' && queueResult.status === 'rejected') {
    monitoringMessage.value = '可观测指标暂不可用（可能需要管理员权限）。'
    return
  }

  if (metricsResult.status === 'rejected') {
    monitoringMessage.value = getErrorMessage(metricsResult.reason, '可观测指标加载失败')
  } else if (queueResult.status === 'rejected') {
    monitoringMessage.value = getErrorMessage(queueResult.reason, '队列指标加载失败')
  }
}

const loadDashboardData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [projectResponse, taskResponse, unreadEvents] = await Promise.all([
      loadAllProjects(),
      loadAllTasks(),
      notificationsApi.events({ unreadOnly: true, limit: 100 }),
    ])

    projects.value = projectResponse
    tasks.value = taskResponse
    unreadNotifications.value = unreadEvents.length

    await loadMonitoringData()
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '加载仪表盘数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadDashboardData()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">仪表盘</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目仪表盘</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        展示项目与任务的实时统计，帮助快速定位当前执行状态。
      </p>
      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    </section>

    <section class="grid gap-4 md:grid-cols-4">
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">项目总数</p>
        <p class="mt-2 text-2xl font-semibold">{{ projectCount }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">运行中任务</p>
        <p class="mt-2 text-2xl font-semibold">{{ runningCount }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">队列中任务</p>
        <p class="mt-2 text-2xl font-semibold">{{ queueLength }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">未读通知</p>
        <p class="mt-2 text-2xl font-semibold">{{ unreadNotifications }}</p>
      </article>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <article class="panel-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">并发与队列</p>
          <p class="text-xs text-muted-foreground">更新时间：{{ formatDate(observabilityMetrics?.generatedAt ?? queueStats?.generatedAt) }}</p>
        </div>

        <div class="mt-3 grid gap-2 text-sm">
          <p class="text-muted-foreground">最大并发：{{ maxConcurrency }}</p>
          <p class="text-muted-foreground">当前运行：{{ runningCount }}</p>
          <p class="text-muted-foreground">可用槽位：{{ availableSlots }}</p>
        </div>

        <div class="mt-4">
          <div class="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>并发饱和度</span>
            <span>{{ saturationLabel }}</span>
          </div>
          <div class="h-2 rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: saturationBarWidth }" />
          </div>
        </div>

        <p v-if="monitoringMessage" class="mt-3 text-xs text-muted-foreground">{{ monitoringMessage }}</p>
      </article>

      <article class="panel-card p-4">
        <p class="text-sm font-semibold">系统告警</p>
        <div v-if="alertItems.length > 0" class="mt-3 space-y-2 text-sm">
          <div
            v-for="alert in alertItems"
            :key="alert.code"
            class="rounded-lg border px-3 py-2"
            :class="
              alert.level === 'error'
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : alert.level === 'warn'
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-border bg-background/70 text-muted-foreground'
            "
          >
            <p class="font-semibold">{{ alert.code }}</p>
            <p class="mt-1 text-xs">{{ alert.message }}</p>
          </div>
        </div>
        <p v-else class="mt-3 text-sm text-muted-foreground">暂无异常告警。</p>
      </article>
    </section>

    <section class="panel-card p-5">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">最近任务</p>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
            type="button"
            @click="loadDashboardData"
          >
            刷新
          </button>
          <RouterLink
            to="/tasks"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
          >
            查看全部
          </RouterLink>
        </div>
      </div>

      <div v-if="loading" class="mt-4 text-sm text-muted-foreground">加载中...</div>

      <div v-else class="mt-4 space-y-2 text-sm">
        <RouterLink
          v-for="task in recentTasks"
          :key="task.id"
          :to="`/tasks/${task.id}`"
          class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
        >
          <div>
            <p class="font-semibold">{{ task.title }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatDate(task.updatedAt) }} · {{ task.mode }}</p>
          </div>
          <span
            class="rounded-full px-2 py-1 text-xs font-semibold"
            :class="
              task.status === 'done'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : task.status === 'in_progress'
                  ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
                  : task.status === 'in_review'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground'
            "
          >
            {{ task.status }}
          </span>
        </RouterLink>

        <div v-if="recentTasks.length === 0" class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          暂无任务，前往任务页创建第一条任务。
        </div>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <article class="panel-card p-4">
        <p class="text-sm font-semibold">完成情况</p>
        <p class="mt-2 text-xs text-muted-foreground">已完成任务：{{ doneTaskCount }} / {{ tasks.length }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-sm font-semibold">导航快捷入口</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <RouterLink to="/projects" class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
            项目管理
          </RouterLink>
          <RouterLink to="/workflow" class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
            工作流模板
          </RouterLink>
          <RouterLink
            :to="{ path: '/dashboard', query: { settings: 'account' } }"
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            通知设置
          </RouterLink>
        </div>
      </article>
    </section>
  </div>
</template>
