<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { workflowApi } from '@/api/workflow'
import type { Project } from '@/types/api/projects'
import type { Task } from '@/types/api/tasks'
import type { WorkflowTemplate, WorkflowTemplateVersion } from '@/types/api/workflow'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

defineOptions({
  name: 'TasksView',
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadingMore = ref(false)
const submitting = ref(false)
const validationMessage = ref('')
const message = useMessage()

const projects = ref<Project[]>([])
const tasks = ref<Task[]>([])
const templates = ref<WorkflowTemplate[]>([])
const templateVersions = ref<WorkflowTemplateVersion[]>([])
const taskPage = ref(1)
const taskHasNextPage = ref(false)

const filters = reactive({
  projectId: '',
  status: '',
})

const createForm = reactive({
  projectId: '',
  mode: 'conversation' as 'conversation' | 'workflow',
  workflowTemplateId: '',
  workflowTemplateVersion: '' as number | '',
  title: '',
  description: '',
  acceptanceCriteriaText: '',
  branch: 'main',
  environment: 'default',
})

const taskStatusOptions: Array<{ label: string; value: '' | Task['status'] }> = [
  { label: '全部状态', value: '' },
  { label: '待执行', value: 'todo' },
  { label: '执行中', value: 'in_progress' },
  { label: '待处理', value: 'in_review' },
  { label: '已完成', value: 'done' },
]

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

const selectedTemplate = computed(() => {
  return templates.value.find((template) => template.id === createForm.workflowTemplateId) ?? null
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
  })
}

const syncFiltersFromQuery = () => {
  const queryProjectId = typeof route.query.projectId === 'string' ? route.query.projectId : ''
  const queryStatus = typeof route.query.status === 'string' ? route.query.status : ''
  if (queryProjectId) {
    filters.projectId = queryProjectId
    createForm.projectId = queryProjectId
  }

  if (queryStatus && taskStatusOptions.some((option) => option.value === queryStatus)) {
    filters.status = queryStatus
  }
}

const loadTemplateVersions = async (templateId: string) => {
  if (!templateId) {
    templateVersions.value = []
    createForm.workflowTemplateVersion = ''
    return
  }

  try {
    const versions = await workflowApi.versions(templateId)
    templateVersions.value = versions

    const latestVersion = versions[0]
    createForm.workflowTemplateVersion = latestVersion ? latestVersion.version : ''
  } catch (error) {
    templateVersions.value = []
    createForm.workflowTemplateVersion = ''
    message.error(toErrorMessage(error, '加载模板版本失败'))
  }
}

const loadTemplatesForProject = async (projectId: string) => {
  if (!projectId) {
    templates.value = []
    templateVersions.value = []
    createForm.workflowTemplateId = ''
    createForm.workflowTemplateVersion = ''
    return
  }

  try {
    const availableTemplates = await fetchAllPages((page, limit) =>
      workflowApi.list({
        page,
        limit,
        isActive: true,
        projectId,
      }),
    )

    templates.value = availableTemplates

    if (!availableTemplates.some((template) => template.id === createForm.workflowTemplateId)) {
      createForm.workflowTemplateId = ''
      createForm.workflowTemplateVersion = ''
      templateVersions.value = []
    }
  } catch (error) {
    templates.value = []
    templateVersions.value = []
    createForm.workflowTemplateId = ''
    createForm.workflowTemplateVersion = ''
    message.error(toErrorMessage(error, '加载可用模板失败'))
  }
}

const loadTaskList = async (reset = true) => {
  const nextPage = reset ? 1 : taskPage.value + 1

  if (reset) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await tasksApi.list({
      page: nextPage,
      limit: 50,
      projectId: filters.projectId || undefined,
      status: filters.status || undefined,
    })

    if (reset) {
      tasks.value = response.data
    } else {
      const existingTaskIds = new Set(tasks.value.map((task) => task.id))
      tasks.value = tasks.value.concat(
        response.data.filter((task) => !existingTaskIds.has(task.id)),
      )
    }

    taskPage.value = nextPage
    taskHasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载任务列表失败'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadPageData = async () => {
  loading.value = true

  try {
    const [projectResponse, taskResponse] = await Promise.all([
      fetchAllPages((page, limit) => projectsApi.list({ page, limit })),
      tasksApi.list({
        page: 1,
        limit: 50,
        projectId: filters.projectId || undefined,
        status: filters.status || undefined,
      }),
    ])

    projects.value = projectResponse
    tasks.value = taskResponse.data
    taskPage.value = 1
    taskHasNextPage.value = taskResponse.hasNextPage

    if (!createForm.projectId) {
      createForm.projectId = projectResponse[0]?.id ?? ''
    }

    await loadTemplatesForProject(createForm.projectId)
  } catch (error) {
    message.error(toErrorMessage(error, '加载任务页面失败'))
  } finally {
    loading.value = false
  }
}

const createTask = async () => {
  if (!createForm.projectId || !createForm.title.trim()) {
    validationMessage.value = '项目和任务标题不能为空'
    return
  }

  if (createForm.mode === 'workflow' && !createForm.workflowTemplateId) {
    validationMessage.value = '工作流模式下必须选择模板'
    return
  }

  submitting.value = true
  validationMessage.value = ''

  try {
    const acceptanceCriteria = createForm.acceptanceCriteriaText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    await tasksApi.create({
      projectId: createForm.projectId,
      mode: createForm.mode,
      workflowTemplateId: createForm.workflowTemplateId || undefined,
      workflowTemplateVersion:
        createForm.workflowTemplateVersion === '' ? undefined : Number(createForm.workflowTemplateVersion),
      title: createForm.title.trim(),
      description: createForm.description.trim() || undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      branch: createForm.branch.trim() || undefined,
      environment: createForm.environment.trim() || undefined,
    })

    createForm.title = ''
    createForm.description = ''
    createForm.acceptanceCriteriaText = ''
    createForm.branch = 'main'
    createForm.environment = 'default'

    await loadTaskList()
    message.success('创建任务成功')
  } catch (error) {
    message.error(toErrorMessage(error, '创建任务失败'))
  } finally {
    submitting.value = false
  }
}

watch(
  () => createForm.workflowTemplateId,
  async (templateId) => {
    const currentTemplate = templates.value.find((template) => template.id === templateId)

    if (currentTemplate) {
      createForm.mode = currentTemplate.mode
    }

    await loadTemplateVersions(templateId)
  },
)

watch(
  () => createForm.projectId,
  async (projectId, previousProjectId) => {
    if (projectId === previousProjectId) {
      return
    }

    await loadTemplatesForProject(projectId)
  },
)

watch(
  () => createForm.mode,
  (mode) => {
    if (mode === 'conversation') {
      createForm.workflowTemplateId = ''
      createForm.workflowTemplateVersion = ''
      templateVersions.value = []
    }
  },
)

const applyFilters = async () => {
  await loadTaskList(true)
  await router.replace({
    query: {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
  })
}

onMounted(() => {
  syncFiltersFromQuery()
  void loadPageData()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">任务管理</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">任务列表与创建</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        支持选择项目和模板创建任务，并按状态筛选查看执行进展。
      </p>
    </section>

    <section class="panel-card p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-semibold">新建任务</p>
        <div class="flex flex-wrap items-center gap-2">
          <select
            v-model="filters.projectId"
            class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="">全部项目</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>

          <select
            v-model="filters.status"
            class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option v-for="option in taskStatusOptions" :key="option.value || 'all'" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="applyFilters"
          >
            筛选
          </button>
        </div>
      </div>

      <form class="grid gap-3 md:grid-cols-2" @submit.prevent="createTask">
        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">项目</span>
          <select
            v-model="createForm.projectId"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">模式</span>
          <select
            v-model="createForm.mode"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="conversation">conversation</option>
            <option value="workflow">workflow</option>
          </select>
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">任务标题</span>
          <input
            v-model="createForm.title"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="例如：实现项目成员权限校验"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">任务描述</span>
          <input
            v-model="createForm.description"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <template v-if="createForm.mode === 'workflow'">
          <label class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">工作流模板</span>
            <select
              v-model="createForm.workflowTemplateId"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="">请选择模板</option>
              <option v-for="template in templates" :key="template.id" :value="template.id">
                {{ template.name }}
              </option>
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">模板版本</span>
            <select
              v-model="createForm.workflowTemplateVersion"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              :disabled="!selectedTemplate"
            >
              <option value="">自动选择最新</option>
              <option v-for="version in templateVersions" :key="version.id" :value="version.version">
                v{{ version.version }}
              </option>
            </select>
          </label>
        </template>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">分支</span>
          <input
            v-model="createForm.branch"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold text-muted-foreground">环境</span>
          <input
            v-model="createForm.environment"
            class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            type="text"
          />
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-semibold text-muted-foreground">验收标准（每行一条）</span>
          <textarea
            v-model="createForm.acceptanceCriteriaText"
            class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="例如：\n- 任务可成功执行\n- 日志流实时可见"
          />
        </label>

        <div class="md:col-span-2 flex justify-end">
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? '创建中...' : '创建任务' }}
          </button>
        </div>
      </form>

      <p v-if="validationMessage" class="mt-3 text-sm text-destructive">{{ validationMessage }}</p>
    </section>

    <section class="panel-card overflow-hidden">
      <div class="border-b border-border px-5 py-4">
        <p class="text-sm font-semibold">任务列表</p>
      </div>

      <div v-if="loading" class="p-5 text-sm text-muted-foreground">加载中...</div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-left text-sm">
          <thead class="border-b border-border bg-background/60">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-5 py-3">任务</th>
              <th class="px-5 py-3">项目</th>
              <th class="px-5 py-3">模式</th>
              <th class="px-5 py-3">状态</th>
              <th class="px-5 py-3">更新时间</th>
              <th class="px-5 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="task in tasks" :key="task.id" class="transition hover:bg-background/70">
              <td class="px-5 py-4">
                <p class="font-semibold">{{ task.title }}</p>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{{ task.id }}</p>
              </td>
              <td class="px-5 py-4 text-muted-foreground">
                {{ projects.find((project) => project.id === task.projectId)?.name ?? task.projectId }}
              </td>
              <td class="px-5 py-4 text-muted-foreground">{{ task.mode }}</td>
              <td class="px-5 py-4">
                <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="statusClassMap[task.status]">
                  {{ statusLabelMap[task.status] }}
                </span>
              </td>
              <td class="px-5 py-4 text-muted-foreground">{{ formatDate(task.updatedAt) }}</td>
              <td class="px-5 py-4 text-right">
                <RouterLink
                  :to="`/tasks/${task.id}`"
                  class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                >
                  详情
                </RouterLink>
              </td>
            </tr>

            <tr v-if="tasks.length === 0">
              <td class="px-5 py-6 text-sm text-muted-foreground" colspan="6">暂无任务，先创建一条任务开始执行。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && taskHasNextPage" class="border-t border-border px-5 py-4">
        <button
          class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loadingMore"
          type="button"
          @click="loadTaskList(false)"
        >
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </section>
  </div>
</template>
