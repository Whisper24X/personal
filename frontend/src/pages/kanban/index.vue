<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import TaskCreateModal from '@features/tasks/TaskCreateModal.vue'
import type { Project } from '@/types/api/projects'
import type { Task, TaskStatus } from '@/types/api/tasks'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { fetchAllPages } from '@shared/utils/pagination'
import { toErrorMessage } from '@api/shared/to-error-message'

defineOptions({
  name: 'KanbanView',
})

type KanbanColumnConfig = {
  key: TaskStatus
  name: string
  emptyText: string
  labelClass: string
  countClass: string
}

const loading = ref(false)
const message = useMessage()
const route = useRoute()

const projects = ref<Project[]>([])
const tasks = ref<Task[]>([])
const selectedProjectId = ref('')
const createTaskModalOpen = ref(false)

const filters = reactive({
  keyword: '',
})

const columnConfig: KanbanColumnConfig[] = [
  {
    key: 'todo',
    name: '待执行',
    emptyText: '暂无待执行任务',
    labelClass: 'text-slate-700 dark:text-slate-300',
    countClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
  {
    key: 'in_progress',
    name: '处理中',
    emptyText: '暂无处理中任务',
    labelClass: 'text-sky-700 dark:text-sky-300',
    countClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    key: 'in_review',
    name: '待完成',
    emptyText: '暂无待完成任务',
    labelClass: 'text-amber-700 dark:text-amber-300',
    countClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    key: 'done',
    name: '已完成',
    emptyText: '暂无已完成任务',
    labelClass: 'text-emerald-700 dark:text-emerald-300',
    countClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
]

const modeLabelMap: Record<Task['mode'], string> = {
  conversation: '对话',
  workflow: '工作流',
}

const projectNameMap = computed(() => {
  return new Map(projects.value.map((project) => [project.id, project.name]))
})

const normalizedKeyword = computed(() => filters.keyword.trim().toLowerCase())

const filteredTasks = computed(() => {
  return tasks.value.filter((task) => {
    if (!normalizedKeyword.value) {
      return true
    }

    const searchText = [
      task.title,
      task.prompt ?? '',
      task.id,
      projectNameMap.value.get(task.projectId) ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return searchText.includes(normalizedKeyword.value)
  })
})

const groupedColumns = computed(() => {
  return columnConfig.map((column) => {
    const items = filteredTasks.value
      .filter((task) => task.status === column.key)
      .sort((left, right) => {
        const leftAt = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
        const rightAt = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime()
        return rightAt - leftAt
      })

    return {
      ...column,
      items,
    }
  })
})

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

const uniqueById = <T extends { id: string }>(items: T[]) => {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

const resolveQueryProjectId = () => {
  const queryProjectId = route.query.projectId
  if (typeof queryProjectId === 'string') {
    return queryProjectId
  }
  if (Array.isArray(queryProjectId)) {
    return queryProjectId[0] ?? ''
  }
  return ''
}

const resolveStoredProjectId = () => {
  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const resolveProjectIdFromContext = () => {
  return resolveQueryProjectId() || resolveStoredProjectId()
}

const syncSelectedProjectId = () => {
  selectedProjectId.value = resolveProjectIdFromContext()
}

const loadAllProjects = async () => {
  const records = await fetchAllPages((page, limit) => projectsApi.list({ page, limit }))
  return uniqueById(records)
}

const loadTasks = async () => {
  syncSelectedProjectId()

  if (!selectedProjectId.value) {
    tasks.value = []
    return
  }

  const records = await fetchAllPages((page, limit) =>
    tasksApi.list({
      page,
      limit,
      projectId: selectedProjectId.value,
    }),
  )
  tasks.value = uniqueById(records)
}

const loadPageData = async () => {
  loading.value = true

  try {
    const [projectResponse] = await Promise.all([loadAllProjects(), loadTasks()])

    projects.value = projectResponse
  } catch (error) {
    message.error(toErrorMessage(error, '加载看板数据失败'))
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  loading.value = true

  try {
    await loadTasks()
  } catch (error) {
    message.error(toErrorMessage(error, '筛选任务失败'))
  } finally {
    loading.value = false
  }
}

const resetFilters = async () => {
  filters.keyword = ''
  await applyFilters()
}

const openCreateTaskModal = () => {
  createTaskModalOpen.value = true
}

const taskDetailTo = (task: Task) => {
  const projectId = selectedProjectId.value || task.projectId
  return {
    name: 'task-detail' as const,
    params: {
      id: task.id,
    },
    query: {
      projectId,
    },
  }
}

onMounted(() => {
  syncSelectedProjectId()
  void loadPageData()
})

watch(
  () => route.query.projectId,
  async (projectId, previousProjectId) => {
    const nextProjectId = Array.isArray(projectId) ? (projectId[0] ?? '') : (projectId ?? '')
    const previousId = Array.isArray(previousProjectId) ? (previousProjectId[0] ?? '') : (previousProjectId ?? '')

    if (nextProjectId === previousId) {
      return
    }

    loading.value = true
    try {
      await loadTasks()
    } catch (error) {
      message.error(toErrorMessage(error, '切换项目后刷新看板失败'))
    } finally {
      loading.value = false
    }
  },
)
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="panel-card p-5">
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="filters.keyword"
          class="h-10 min-w-64 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          placeholder="搜索任务标题 / 描述 / ID"
          type="text"
        />

        <button
          class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
          type="button"
          @click="applyFilters"
        >
          搜索
        </button>

        <button
          class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
          type="button"
          @click="resetFilters"
        >
          重置
        </button>

        <button
          class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
          type="button"
          @click="loadPageData"
        >
          刷新
        </button>

        <button
          class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          :disabled="!selectedProjectId"
          @click="openCreateTaskModal"
        >
          新建任务
        </button>
      </div>

    </section>

    <section v-if="loading" class="panel-card p-5 text-sm text-muted-foreground">加载中...</section>

    <section v-else-if="!selectedProjectId" class="panel-card p-5 text-sm text-muted-foreground">
      请先在左侧项目菜单中选择项目，再查看对应任务看板。
    </section>

    <section v-else class="grid gap-4 xl:grid-cols-4">
      <article v-for="column in groupedColumns" :key="column.key" class="panel-card p-4">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <h2 class="text-sm font-semibold" :class="column.labelClass">{{ column.name }}</h2>
          <span class="rounded-full px-2 py-1 text-[10px] font-semibold" :class="column.countClass">
            {{ column.items.length }}
          </span>
        </div>

        <div class="mt-3 space-y-2">
          <RouterLink
            v-for="item in column.items"
            :key="item.id"
            :to="taskDetailTo(item)"
            class="flex min-h-20 flex-col rounded-xl border border-border bg-background/75 px-3 py-2 text-sm transition hover:bg-background"
          >
            <p class="min-w-0 break-words font-semibold leading-5 line-clamp-2" :title="item.title">
              {{ item.title }}
            </p>
            <div class="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span class="min-w-0 truncate">{{ modeLabelMap[item.mode] }}</span>
              <span class="shrink-0 whitespace-nowrap">{{ formatDate(item.updatedAt ?? item.createdAt) }}</span>
            </div>
          </RouterLink>

          <div
            v-if="column.items.length === 0"
            class="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-border bg-background/30 px-3 text-xs text-muted-foreground"
          >
            {{ column.emptyText }}
          </div>
        </div>
      </article>
    </section>

    <TaskCreateModal
      v-model:open="createTaskModalOpen"
      :project-id="selectedProjectId"
    />
  </div>
</template>
