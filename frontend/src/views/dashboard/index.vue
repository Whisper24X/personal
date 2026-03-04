<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import type { Project } from '@/types/api/projects'
import type { Task } from '@/types/api/tasks'
import { STORAGE_KEYS } from '@/types/common/storage'
import { fetchAllPages } from '@/utils/pagination'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'DashboardView',
})

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const project = ref<Project | null>(null)
const tasks = ref<Task[]>([])

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

const completionRate = computed(() => {
  if (totalTaskCount.value === 0) {
    return '0.0%'
  }

  return `${((doneTaskCount.value / totalTaskCount.value) * 100).toFixed(1)}%`
})

const recentTasks = computed(() => {
  return [...tasks.value]
    .sort((left, right) => {
      const leftAt = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
      const rightAt = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime()
      return rightAt - leftAt
    })
    .slice(0, 5)
})

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

const loadProjectDashboardData = async () => {
  const projectId = activeProjectId.value

  if (!projectId) {
    project.value = null
    tasks.value = []
    return
  }

  loading.value = true

  try {
    const [projectResponse, taskResponse] = await Promise.all([
      projectsApi.detail(projectId),
      fetchAllPages((page, limit) => tasksApi.list({ projectId, page, limit })),
    ])

    project.value = projectResponse
    tasks.value = uniqueById(taskResponse)
  } catch (error) {
    project.value = null
    tasks.value = []
    message.error(toErrorMessage(error, '加载项目仪表盘数据失败'))
  } finally {
    loading.value = false
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
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">仪表盘</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目仪表盘</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        仅展示当前项目的信息与任务状态，不再包含全局系统数据。
      </p>
    </section>

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
        <section class="grid gap-4 md:grid-cols-2">
          <article class="panel-card p-4">
            <p class="text-sm font-semibold">项目概览</p>
            <div class="mt-3 grid gap-2 text-sm text-muted-foreground">
              <p>
                名称：
                <span class="font-semibold text-foreground">{{ project.name }}</span>
              </p>
              <p>
                项目 ID：
                <span class="font-mono text-foreground">{{ project.id }}</span>
              </p>
              <p>
                业务线 ID：
                <span class="font-mono text-foreground">{{ project.businessLineId }}</span>
              </p>
              <p>
                默认分支：
                <span class="font-mono text-foreground">{{ project.defaultBranch }}</span>
              </p>
              <p>
                Git 仓库：
                <span class="break-all font-mono text-foreground">{{ project.gitUrl }}</span>
              </p>
              <p>最近更新：{{ formatDate(project.updatedAt ?? project.createdAt) }}</p>
            </div>
            <p v-if="project.description" class="mt-3 text-sm text-muted-foreground">
              {{ project.description }}
            </p>
          </article>

          <article class="panel-card p-4">
            <p class="text-sm font-semibold">项目快捷入口</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <RouterLink
                :to="{ path: '/tasks', query: { projectId: project.id } }"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                任务
              </RouterLink>
              <RouterLink
                :to="{ path: '/kanban', query: { projectId: project.id } }"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                看板
              </RouterLink>
              <RouterLink
                :to="{ path: '/skills', query: { projectId: project.id } }"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                Skills
              </RouterLink>
              <RouterLink
                :to="{ path: '/mcp', query: { projectId: project.id } }"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                MCP
              </RouterLink>
              <RouterLink
                :to="{ path: '/git', query: { projectId: project.id } }"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                Git
              </RouterLink>
            </div>
          </article>
        </section>

        <section class="grid gap-4 md:grid-cols-4">
          <article class="panel-card p-4">
            <p class="text-xs text-muted-foreground">任务总数</p>
            <p class="mt-2 text-2xl font-semibold">{{ totalTaskCount }}</p>
          </article>
          <article class="panel-card p-4">
            <p class="text-xs text-muted-foreground">待执行</p>
            <p class="mt-2 text-2xl font-semibold">{{ todoTaskCount }}</p>
          </article>
          <article class="panel-card p-4">
            <p class="text-xs text-muted-foreground">执行中</p>
            <p class="mt-2 text-2xl font-semibold">{{ runningTaskCount }}</p>
          </article>
          <article class="panel-card p-4">
            <p class="text-xs text-muted-foreground">待处理</p>
            <p class="mt-2 text-2xl font-semibold">{{ reviewTaskCount }}</p>
          </article>
        </section>

        <section class="panel-card p-4">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold">完成率</p>
            <p class="text-xs text-muted-foreground">已完成 {{ doneTaskCount }} / {{ totalTaskCount }}</p>
          </div>
          <div class="mt-3 h-2 rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: completionRate }" />
          </div>
          <p class="mt-2 text-xs text-muted-foreground">{{ completionRate }}</p>
        </section>

        <section class="panel-card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold">最近任务</p>
            <div class="flex items-center gap-2">
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
                type="button"
                @click="loadProjectDashboardData"
              >
                刷新
              </button>
              <RouterLink
                :to="{ path: '/tasks', query: { projectId: project.id } }"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
              >
                查看全部
              </RouterLink>
            </div>
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
              <div>
                <p class="font-semibold">{{ task.title }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ formatDate(task.updatedAt ?? task.createdAt) }} · {{ task.mode }}</p>
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
