<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { useUserStore } from '@/stores/modules/user'
import type { Project } from '@/types/api/projects'
import type { Task, TaskStatusCounts } from '@/types/api/tasks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import ProjectProgressCard from './ProjectProgressCard.vue'
import { STORAGE_KEYS } from '@/types/common/storage'
import { HttpError } from '@/utils/http/error'
import { fetchAllPages } from '@/utils/pagination'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'DashboardView',
})

const RING_C = 264
const KANBAN_COL_LIMIT = 4

const route = useRoute()
const router = useRouter()
const message = useMessage()
const userStore = useUserStore()

const loading = ref(false)
const refreshing = ref(false)
const project = ref<Project | null>(null)
const tasks = ref<Task[]>([])
/** 来自 GET /tasks/stats（库内聚合）；失败时由当前拉取的任务列表推导 */
const taskStatusCounts = ref<TaskStatusCounts | null>(null)

const statusLabelMap: Record<Task['status'], string> = {
  todo: '待执行',
  in_progress: '执行中',
  in_review: '待处理',
  done: '已完成',
}

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const resolveStoredProjectId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const activeProjectId = computed(() => {
  return normalizeRouteParam(route.query.projectId) || resolveStoredProjectId()
})

const projectQuery = computed(() => ({
  projectId: activeProjectId.value,
}))

const hasProjectId = computed(() => Boolean(activeProjectId.value))
const totalTaskCount = computed(() => taskStatusCounts.value?.total ?? 0)
const todoTaskCount = computed(() => taskStatusCounts.value?.todo ?? 0)
const runningTaskCount = computed(() => taskStatusCounts.value?.in_progress ?? 0)
const reviewTaskCount = computed(() => taskStatusCounts.value?.in_review ?? 0)
const doneTaskCount = computed(() => taskStatusCounts.value?.done ?? 0)

const pendingCount = computed(() => todoTaskCount.value + reviewTaskCount.value)

const completionRateValue = computed(() => {
  if (totalTaskCount.value === 0) {
    return 0
  }

  return Number(((doneTaskCount.value / totalTaskCount.value) * 100).toFixed(1))
})

const completionRate = computed(() => `${completionRateValue.value.toFixed(1)}%`)

const ringDashOffset = computed(() => {
  const pct = completionRateValue.value / 100
  return RING_C * (1 - pct)
})

const displayName = computed(() => {
  const name = userStore.profile?.name?.trim()
  return name || '用户'
})

const welcomeClock = computed(() => {
  const d = new Date()
  return {
    date: d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    weekday: d.toLocaleDateString('zh-CN', { weekday: 'long' }),
  }
})

const uniqueById = <T extends { id: string }>(items: T[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

const deriveStatusCountsFromTasks = (projectId: string, list: Task[]): TaskStatusCounts => {
  let todo = 0
  let in_progress = 0
  let in_review = 0
  let done = 0
  for (const t of list) {
    if (t.status === 'todo') todo += 1
    else if (t.status === 'in_progress') in_progress += 1
    else if (t.status === 'in_review') in_review += 1
    else if (t.status === 'done') done += 1
  }
  return {
    projectId,
    todo,
    in_progress,
    in_review,
    done,
    total: list.length,
  }
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

const modeLabel = (mode: Task['mode']) => {
  return mode === 'workflow' ? '工作流' : '对话模式'
}

const tasksByColumn = computed(() => {
  const pick = (status: Task['status']) =>
    tasks.value.filter((t) => t.status === status).slice(0, KANBAN_COL_LIMIT)

  return {
    todo: pick('todo'),
    in_progress: pick('in_progress'),
    in_review: pick('in_review'),
    done: pick('done'),
  }
})

const statBarPct = (count: number) => {
  if (totalTaskCount.value === 0) {
    return 0
  }

  return Math.min(100, Math.round((count / totalTaskCount.value) * 100))
}

type StatCardItem = {
  label: string
  value: number
  barPct: number
  barClass: string
}

const statCards = computed<StatCardItem[]>(() => {
  const t = totalTaskCount.value
  return [
    {
      label: '任务总数',
      value: t,
      barPct: t > 0 ? 100 : 0,
      barClass: 'bg-primary',
    },
    {
      label: '执行中',
      value: runningTaskCount.value,
      barPct: statBarPct(runningTaskCount.value),
      barClass: 'bg-sky-500',
    },
    {
      label: '已完成',
      value: doneTaskCount.value,
      barPct: statBarPct(doneTaskCount.value),
      barClass: 'bg-emerald-500',
    },
    {
      label: '待执行',
      value: todoTaskCount.value,
      barPct: statBarPct(todoTaskCount.value),
      barClass: 'bg-slate-400 dark:bg-slate-500',
    },
    {
      label: '待处理',
      value: reviewTaskCount.value,
      barPct: statBarPct(reviewTaskCount.value),
      barClass: 'bg-amber-500',
    },
  ]
})

const loadProjectDashboardData = async (options: { keepContent?: boolean } = {}) => {
  const projectId = activeProjectId.value

  if (!projectId) {
    loading.value = false
    refreshing.value = false
    project.value = null
    tasks.value = []
    taskStatusCounts.value = null
    return
  }

  if (options.keepContent && project.value) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  const previousProject = project.value
  const previousTasks = tasks.value

  try {
    const [projectResponse, taskResponse, statsResponse] = await Promise.all([
      projectsApi.detail(projectId),
      fetchAllPages((page, limit) => tasksApi.list({ projectId, page, limit })),
      tasksApi.statusCounts(projectId).catch(() => null),
    ])

    const taskList = uniqueById(taskResponse)

    project.value = projectResponse
    tasks.value = taskList
    taskStatusCounts.value =
      statsResponse ?? deriveStatusCountsFromTasks(projectId, taskList)
  } catch (error) {
    if (options.keepContent && previousProject) {
      project.value = previousProject
      tasks.value = previousTasks
    } else {
      project.value = null
      tasks.value = []
      taskStatusCounts.value = null
    }

    message.error(toErrorMessage(error, '加载项目仪表盘数据失败'))

    if (error instanceof HttpError && (error.status === 404 || error.status === 403)) {
      project.value = null
      tasks.value = []
      taskStatusCounts.value = null
      localStorage.removeItem(STORAGE_KEYS.lastSelectedProjectId)
      if (route.query.projectId) {
        void router.replace({ path: route.path, query: {} })
      }
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

watch(
  activeProjectId,
  () => {
    void loadProjectDashboardData()
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-4 fade-up md:space-y-5">
    <Card v-if="!hasProjectId">
      <CardContent class="space-y-2 p-5">
        <CardTitle class="text-sm font-semibold">未选择项目</CardTitle>
        <CardDescription>
          当前 URL 缺少 <code>projectId</code>，请使用 <code>?projectId=&lt;uuid&gt;</code> 访问，或先在侧栏选择项目。
        </CardDescription>
      </CardContent>
    </Card>

    <template v-else>
      <Card v-if="loading">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>

      <Card v-else-if="!project">
        <CardContent class="space-y-2 p-5">
          <CardTitle class="text-sm font-semibold">项目不可用</CardTitle>
          <CardDescription>未找到对应项目，或当前账号没有该项目访问权限。</CardDescription>
        </CardContent>
      </Card>

      <template v-else>
        <!-- 欢迎条（对齐 ainative2v1.1 工作台） -->
        <Card
          class="border-primary/10 bg-gradient-to-br from-sky-50/90 via-background to-violet-50/80 shadow-sm dark:from-sky-950/25 dark:via-background dark:to-violet-950/20"
        >
          <CardContent class="p-5">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0 space-y-1">
                <p class="text-lg font-bold tracking-tight md:text-xl">
                  Hi, {{ displayName }}
                  <span aria-hidden="true">👋</span>
                </p>
                <p class="text-sm leading-relaxed text-muted-foreground">
                  <span class="font-semibold text-primary">{{ project.name }}</span>
                  项目有
                  <span class="font-bold text-primary">{{ pendingCount }}</span>
                  个任务等待处理，累计已完成
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ doneTaskCount }}</span>
                  个任务
                </p>
                <p v-if="refreshing" class="text-xs text-primary">刷新中...</p>
              </div>
              <div class="flex shrink-0 flex-col items-end text-[11px] text-muted-foreground">
                <div class="text-right">{{ welcomeClock.date }}</div>
                <div class="mt-0.5 text-right">{{ welcomeClock.weekday }}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 统计卡（5 列 + 底条，对齐原型；无计费接口时用状态维度替代 API/Token） -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card v-for="card in statCards" :key="card.label">
            <CardContent class="flex flex-col gap-0 p-4">
              <p class="text-xs font-medium text-muted-foreground">{{ card.label }}</p>
              <p class="mt-1 text-2xl font-bold tracking-tight md:text-[28px]">{{ card.value }}</p>
              <div class="mt-2.5 h-1 rounded-full bg-muted">
                <div
                  class="h-full rounded-full transition-[width] duration-500 ease-out"
                  :class="card.barClass"
                  :style="{ width: `${card.barPct}%` }"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- 任务看板（迷你四列） -->
        <Card class="gap-0 overflow-hidden p-0">
          <CardHeader
            class="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-border/80 py-3"
          >
            <CardTitle class="text-sm font-semibold">任务看板</CardTitle>
            <RouterLink
              :to="{ path: '/kanban', query: projectQuery }"
              class="inline-flex h-7 items-center rounded-md border border-border bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30"
            >
              全屏视图
            </RouterLink>
          </CardHeader>
          <CardContent class="p-0">
            <div
              class="grid grid-cols-1 divide-y divide-border/80 border-t border-border/60 md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4"
            >
            <div
              v-for="col in (
                [
                  { key: 'todo' as const, dot: 'bg-slate-400', head: 'text-muted-foreground' },
                  { key: 'in_progress' as const, dot: 'bg-sky-500', head: 'text-sky-700 dark:text-sky-300' },
                  { key: 'in_review' as const, dot: 'bg-amber-500', head: 'text-amber-700 dark:text-amber-300' },
                  { key: 'done' as const, dot: 'bg-emerald-500', head: 'text-emerald-700 dark:text-emerald-300' },
                ] as const
              )"
              :key="col.key"
              class="p-3 md:p-3.5"
            >
              <div
                class="mb-2 flex items-center gap-1.5 text-[11px] font-semibold"
                :class="col.head"
              >
                <span class="size-1.5 shrink-0 rounded-full" :class="col.dot" />
                {{ statusLabelMap[col.key] }}
                <span class="font-normal text-muted-foreground">
                  {{
                    col.key === 'todo'
                      ? todoTaskCount
                      : col.key === 'in_progress'
                        ? runningTaskCount
                        : col.key === 'in_review'
                          ? reviewTaskCount
                          : doneTaskCount
                  }}
                </span>
              </div>
              <div class="space-y-1.5">
                <RouterLink
                  v-for="task in tasksByColumn[col.key]"
                  :key="task.id"
                  :to="{
                    name: 'task-detail',
                    params: { id: task.id },
                    query: { projectId: task.projectId },
                  }"
                  class="block rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:border-border hover:bg-muted/50"
                  :class="{
                    'border-sky-500/25 bg-sky-500/5 dark:bg-sky-500/10': col.key === 'in_progress',
                    'border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10': col.key === 'in_review',
                    'border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10': col.key === 'done',
                  }"
                >
                  <p class="text-xs font-medium leading-snug">{{ task.title }}</p>
                  <p class="mt-0.5 text-[10px] text-muted-foreground">
                    {{ modeLabel(task.mode) }} · {{ formatDate(task.updatedAt ?? task.createdAt) }}
                  </p>
                </RouterLink>
                <p
                  v-if="tasksByColumn[col.key].length === 0"
                  class="rounded-lg border border-dashed border-border/70 px-2.5 py-3 text-center text-[11px] text-muted-foreground"
                >
                  暂无
                </p>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        <!-- 完成率环（统计来自 GET /tasks/stats） + 费用占位 -->
        <section class="grid gap-4 lg:grid-cols-2">
          <ProjectProgressCard
            :completion-rate-label="completionRate"
            :ring-circumference="RING_C"
            :ring-dash-offset="ringDashOffset"
            :done-count="doneTaskCount"
            :running-count="runningTaskCount"
            :todo-count="todoTaskCount"
            :review-count="reviewTaskCount"
          />

          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle class="text-sm font-semibold">费用明细</CardTitle>
              <span class="text-[11px] text-muted-foreground">本周</span>
            </CardHeader>
            <CardContent class="pt-0">
              <p class="text-sm leading-relaxed text-muted-foreground">
                暂无计费数据。接入用量统计后，可在此展示模型与工具调用费用（对齐原型布局占位）。
              </p>
            </CardContent>
          </Card>
        </section>
      </template>
    </template>
  </div>
</template>
