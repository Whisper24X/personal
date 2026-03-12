<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import type { Project } from '@/types/api/projects'
import type { Task } from '@/types/api/tasks'
import { STORAGE_KEYS } from '@/types/common/storage'
import { HttpError } from '@/utils/http/error'
import { fetchAllPages } from '@/utils/pagination'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'DashboardView',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const refreshing = ref(false)
const project = ref<Project | null>(null)
const tasks = ref<Task[]>([])

type DashboardMetaItem = {
  label: string
  value: string
  monospace?: boolean
  breakAll?: boolean
}

type DashboardMetric = {
  label: string
  value: number
}

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

const hasProjectId = computed(() => Boolean(activeProjectId.value))
const totalTaskCount = computed(() => tasks.value.length)
const todoTaskCount = computed(() => tasks.value.filter((task) => task.status === 'todo').length)
const runningTaskCount = computed(() => tasks.value.filter((task) => task.status === 'in_progress').length)
const reviewTaskCount = computed(() => tasks.value.filter((task) => task.status === 'in_review').length)
const doneTaskCount = computed(() => tasks.value.filter((task) => task.status === 'done').length)

const completionRateValue = computed(() => {
  if (totalTaskCount.value === 0) {
    return 0
  }

  return Number(((doneTaskCount.value / totalTaskCount.value) * 100).toFixed(1))
})

const completionRate = computed(() => `${completionRateValue.value.toFixed(1)}%`)

const recentTasks = computed(() => {
  return [...tasks.value]
    .sort((left, right) => {
      const leftAt = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
      const rightAt = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime()
      return rightAt - leftAt
    })
    .slice(0, 5)
})

const projectMetaItems = computed<DashboardMetaItem[]>(() => {
  if (!project.value) {
    return []
  }

  return [
    {
      label: '项目 ID',
      value: project.value.id,
      monospace: true,
    },
    {
      label: '业务线 ID',
      value: project.value.businessLineId,
      monospace: true,
    },
    {
      label: '默认分支',
      value: project.value.defaultBranch || '-',
      monospace: true,
    },
    {
      label: 'Git 仓库',
      value: project.value.gitUrl || '-',
      monospace: true,
      breakAll: true,
    },
  ]
})

const taskMetrics = computed<DashboardMetric[]>(() => [
  {
    label: '待执行',
    value: todoTaskCount.value,
  },
  {
    label: '执行中',
    value: runningTaskCount.value,
  },
  {
    label: '待处理',
    value: reviewTaskCount.value,
  },
  {
    label: '已完成',
    value: doneTaskCount.value,
  },
])

const uniqueById = <T extends { id: string }>(items: T[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

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
  })
}

const loadProjectDashboardData = async (options: { keepContent?: boolean } = {}) => {
  const projectId = activeProjectId.value

  if (!projectId) {
    loading.value = false
    refreshing.value = false
    project.value = null
    tasks.value = []
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
    const [projectResponse, taskResponse] = await Promise.all([
      projectsApi.detail(projectId),
      fetchAllPages((page, limit) => tasksApi.list({ projectId, page, limit })),
    ])

    project.value = projectResponse
    tasks.value = uniqueById(taskResponse)
  } catch (error) {
    if (options.keepContent && previousProject) {
      project.value = previousProject
      tasks.value = previousTasks
    } else {
      project.value = null
      tasks.value = []
    }

    message.error(toErrorMessage(error, '加载项目仪表盘数据失败'))

    if (error instanceof HttpError && (error.status === 404 || error.status === 403)) {
      project.value = null
      tasks.value = []
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
  <div class="space-y-5 fade-up">
    <section v-if="!hasProjectId" class="panel-card p-5">
      <p class="text-sm font-semibold">未选择项目</p>
      <p class="mt-2 text-sm text-muted-foreground">
        当前 URL 缺少 <code>projectId</code>，请使用 <code>?projectId=&lt;uuid&gt;</code> 访问，或先在侧栏选择项目。
      </p>
    </section>

    <template v-else>
      <section v-if="loading" class="panel-card p-5">
        <p class="text-sm text-muted-foreground">加载中...</p>
      </section>

      <section v-else-if="!project" class="panel-card p-5">
        <p class="text-sm font-semibold">项目不可用</p>
        <p class="mt-2 text-sm text-muted-foreground">未找到对应项目，或当前账号没有该项目访问权限。</p>
      </section>

      <template v-else>
        <section class="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(20rem,1fr)]">
          <article class="panel-card p-5">
            <div class="flex flex-col gap-4">
              <div v-if="refreshing" class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span class="text-primary">刷新中...</span>
              </div>

              <div class="space-y-2">
                <h2 class="text-2xl font-semibold tracking-tight md:text-3xl">{{ project.name }}</h2>
                <p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {{ project.description || '暂无项目描述。' }}
                </p>
              </div>

              <div class="rounded-2xl border border-border/80 bg-background/60">
                <div
                  v-for="(item, index) in projectMetaItems"
                  :key="item.label"
                  class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  :class="index < projectMetaItems.length - 1 ? 'border-b border-border/70' : ''"
                >
                  <p class="text-xs text-muted-foreground sm:w-24 sm:shrink-0 sm:pt-0.5">{{ item.label }}</p>
                  <p
                    class="text-sm text-foreground sm:flex-1 sm:text-right"
                    :class="[
                      item.monospace ? 'font-mono' : '',
                      item.breakAll ? 'break-all' : '',
                    ]"
                  >
                    {{ item.value }}
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article class="panel-card p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">执行概览</p>
                <p class="mt-2 text-4xl font-semibold tracking-tight">{{ completionRate }}</p>
                <p class="mt-1 text-sm text-muted-foreground">
                  已完成 {{ doneTaskCount }} / {{ totalTaskCount }} 个任务
                </p>
              </div>
              <span class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                完成率
              </span>
            </div>

            <div class="mt-4 h-2 rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary transition-all"
                :style="{ width: `${completionRateValue}%` }"
              />
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3">
              <article
                v-for="metric in taskMetrics"
                :key="metric.label"
                class="rounded-2xl border border-border/80 bg-background/60 px-4 py-3"
              >
                <div>
                  <p class="text-xs text-muted-foreground">{{ metric.label }}</p>
                  <p class="mt-1 text-2xl font-semibold">{{ metric.value }}</p>
                </div>
              </article>
            </div>
          </article>
        </section>

        <section class="panel-card p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold">最近任务</p>
              <p class="mt-1 text-xs text-muted-foreground">最近更新的 5 条任务，便于快速继续处理。</p>
            </div>
            <RouterLink
              :to="{ path: '/tasks', query: { projectId: project.id } }"
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
            >
              查看全部
            </RouterLink>
          </div>

          <div class="mt-4 space-y-2 text-sm">
            <RouterLink
              v-for="task in recentTasks"
              :key="task.id"
              :to="{
                name: 'task-detail',
                params: { id: task.id },
                query: { projectId: task.projectId },
              }"
              class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
            >
              <div class="min-w-0">
                <p class="font-semibold">{{ task.title }}</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  <span class="font-mono">{{ task.id }}</span>
                  <span class="mx-1.5">·</span>
                  <span>{{ formatDate(task.updatedAt ?? task.createdAt) }}</span>
                  <span class="mx-1.5">·</span>
                  <span>{{ task.mode }}</span>
                </p>
              </div>
              <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="statusClassMap[task.status]">
                {{ statusLabelMap[task.status] }}
              </span>
            </RouterLink>

            <div v-if="recentTasks.length === 0" class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              当前项目暂无任务。
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
