<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { useAccessStore } from '@/stores/modules/access'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { gitApi } from '@/api/git'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { workflowApi } from '@/api/workflow'
import AppSelect from '@/components/core/select'
import type { Project } from '@/types/api/projects'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { STORAGE_KEYS } from '@/types/common/storage'
import { BUTTON_ACCESS_CONFIG, hasSomeAccess } from '@/constants/access-control'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'
import { buildBranchOptions } from '@/utils/git-branch-options'
import { requestSidebarRecentTasksRefresh } from '@/hooks/useSidebarRecentTasks'
import { initialTitleFromPrompt } from '@/utils/task-title-placeholder'
import { refreshSidebarRecentTasks } from '@/utils/sidebar-recent-tasks-refresh'

type SupportedCliToolId = 'claude-code' | 'codex' | 'gemini-cli' | 'cursor-agent' | 'opencode'

const SUPPORTED_CLI_TOOLS: Array<{ id: SupportedCliToolId; label: string }> = [
  { id: 'cursor-agent', label: 'Cursor Agent' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'opencode', label: 'Opencode' },
]

const TASK_HEADLINES = [
  '我能为你做什么？',
  '告诉我目标，我来帮你推进。',
  '给我一句描述，我帮你拆解成可执行任务。',
  '从一个想法开始，把它落地成结果。',
  '想清楚方向后，剩下的交给我。',
  '输入你的需求，我们马上开始。',
]
const HEADLINE_ROTATE_INTERVAL_MS = 30000
const TASK_CREATE_SELECT_PANEL_Z_INDEX = 130
const TASK_CREATE_SELECT_PANEL_PLACEMENT = 'top' as const
const PROJECT_DETAIL_FALLBACK_TIMEOUT_MS = 5000

const props = withDefaults(
  defineProps<{
    projectId?: string
  }>(),
  {
    projectId: '',
  },
)

const emit = defineEmits<{
  (event: 'created', taskId: string): void
}>()

defineOptions({
  name: 'TaskCreatePanel',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()
const accessStore = useAccessStore()

const loading = ref(false)
const loadingTemplates = ref(false)
const loadingAgentConfigs = ref(false)
const loadingBranches = ref(false)
const submitting = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const currentHeadline = ref(TASK_HEADLINES[0] ?? '我能为你做什么？')
const initializingProjectDependencies = ref(false)
let headlineTimer: ReturnType<typeof setInterval> | null = null
let latestBranchRequestId = 0

const projects = ref<Project[]>([])
const templates = ref<WorkflowTemplate[]>([])
const configuredCliTools = ref<Array<{ id: SupportedCliToolId; label: string }>>([])
const agentToolConfigs = ref<AgentToolConfig[]>([])
const agentConfigsByTool = ref<Partial<Record<SupportedCliToolId, AgentToolConfig[]>>>({})
const branchOptions = ref<string[]>([])
const selectedFiles = ref<File[]>([])

const createForm = reactive({
  projectId: '',
  mode: 'conversation' as 'conversation' | 'workflow',
  workflowTemplateId: '',
  agentCliId: '' as SupportedCliToolId | '',
  agentCliConfigId: '',
  gitBaseBranch: '',
  prompt: '',
})

const configuredCliToolOptions = computed(() => {
  return configuredCliTools.value.map((tool) => ({
    label: tool.label,
    value: tool.id,
  }))
})

const agentToolConfigOptions = computed(() => {
  return agentToolConfigs.value.map((config) => ({
    label: config.name,
    value: config.id,
  }))
})

const workflowTemplateOptions = computed(() => {
  return templates.value.map((template) => ({
    label: template.name,
    value: template.id,
  }))
})

const gitBaseBranchOptions = computed(() => {
  return branchOptions.value.map((branch) => ({
    label: branch,
    value: branch,
  }))
})

const canCreateTask = computed(() => {
  return (
    Boolean(createForm.projectId) &&
    hasSomeAccess(BUTTON_ACCESS_CONFIG.createTask.capabilities, (capability) =>
      accessStore.hasCapability(capability),
    )
  )
})

const resolveQueryProjectId = () => {
  return typeof route.query.projectId === 'string' ? route.query.projectId : ''
}

const resolveStoredProjectId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const resolveProjectIdFromContext = () => {
  return props.projectId || resolveQueryProjectId() || resolveStoredProjectId()
}

const syncProjectFromContext = () => {
  const projectId = resolveProjectIdFromContext()
  if (projectId) {
    createForm.projectId = projectId
  }
}

const withRequestTimeout = <T,>(promise: Promise<T>, timeoutMs: number) => {
  return new Promise<T | null>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      resolve(null)
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

const resetCreateForm = (projectId?: string) => {
  const nextProjectId = projectId || createForm.projectId || projects.value[0]?.id || ''
  const nextProject = projects.value.find((item) => item.id === nextProjectId)

  createForm.projectId = nextProjectId
  createForm.mode = 'conversation'
  createForm.workflowTemplateId = ''
  createForm.agentCliId = configuredCliTools.value[0]?.id ?? ''
  createForm.agentCliConfigId = ''
  createForm.gitBaseBranch = nextProject?.defaultBranch?.trim() || ''
  createForm.prompt = ''
  selectedFiles.value = []
  syncAgentToolConfigsForSelectedTool()
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const showValidationError = (text: string) => {
  message.error(text)
}

const isSupportedCliToolId = (toolId: string): toolId is SupportedCliToolId => {
  return SUPPORTED_CLI_TOOLS.some((tool) => tool.id === toolId)
}

const syncAgentToolConfigsForSelectedTool = () => {
  if (!createForm.agentCliId) {
    agentToolConfigs.value = []
    createForm.agentCliConfigId = ''
    return
  }

  const configs = agentConfigsByTool.value[createForm.agentCliId] ?? []
  agentToolConfigs.value = configs

  if (!configs.some((config) => config.id === createForm.agentCliConfigId)) {
    const defaultConfig = configs.find((config) => config.isDefault)
    createForm.agentCliConfigId = defaultConfig?.id ?? configs[0]?.id ?? ''
  }
}

const loadBranchesForProject = async (projectId: string) => {
  const requestId = ++latestBranchRequestId
  const project = projects.value.find((item) => item.id === projectId)
  const projectDefaultBranch = project?.defaultBranch?.trim() || ''

  if (!projectId) {
    branchOptions.value = []
    createForm.gitBaseBranch = ''
    return
  }

  loadingBranches.value = true

  try {
    const branchData = await gitApi.branches(projectId)

    if (requestId !== latestBranchRequestId) {
      return
    }

    const nextBranchOptions = buildBranchOptions({
      localBranches: branchData.localBranches,
      remoteBranches: branchData.remoteBranches,
      preferredBranches: [projectDefaultBranch, branchData.defaultBranch],
    })

    branchOptions.value = nextBranchOptions

    const currentBaseBranch = createForm.gitBaseBranch.trim()
    const fallbackBaseBranch =
      nextBranchOptions.find((branch) => branch === projectDefaultBranch) ??
      nextBranchOptions[0] ??
      projectDefaultBranch

    createForm.gitBaseBranch =
      nextBranchOptions.find((branch) => branch === currentBaseBranch) ?? fallbackBaseBranch ?? ''
  } catch (error) {
    if (requestId !== latestBranchRequestId) {
      return
    }

    const fallbackBranches = buildBranchOptions({
      localBranches: [],
      remoteBranches: [],
      preferredBranches: [projectDefaultBranch],
    })

    branchOptions.value = fallbackBranches

    if (!fallbackBranches.includes(createForm.gitBaseBranch.trim())) {
      createForm.gitBaseBranch = fallbackBranches[0] ?? ''
    }

    message.error(toErrorMessage(error, '加载项目分支失败'))
  } finally {
    if (requestId === latestBranchRequestId) {
      loadingBranches.value = false
    }
  }
}

const loadTemplatesForProject = async (projectId: string) => {
  if (!projectId) {
    templates.value = []
    createForm.workflowTemplateId = ''
    return
  }

  loadingTemplates.value = true
  try {
    const availableTemplates = await fetchAllPages((page, limit) =>
      workflowApi.list({
        page,
        limit,
        isActive: true,
        scope: 'project',
        projectId,
      }),
    )

    templates.value = availableTemplates

    const hasSelectedTemplate = availableTemplates.some(
      (template) => template.id === createForm.workflowTemplateId,
    )

    if (!hasSelectedTemplate) {
      createForm.workflowTemplateId =
        createForm.mode === 'workflow' ? (availableTemplates[0]?.id ?? '') : ''
    }
  } catch (error) {
    templates.value = []
    createForm.workflowTemplateId = ''
    message.error(toErrorMessage(error, '加载项目工作流模板失败'))
  } finally {
    loadingTemplates.value = false
  }
}

const loadConversationCliOptions = async (projectId: string) => {
  const project = projects.value.find((item) => item.id === projectId)
  if (!project?.businessLineId) {
    configuredCliTools.value = []
    agentConfigsByTool.value = {}
    agentToolConfigs.value = []
    createForm.agentCliId = ''
    createForm.agentCliConfigId = ''
    return
  }

  loadingAgentConfigs.value = true
  try {
    const configs = await businessLinesApi.listAgentToolConfigs(project.businessLineId)
    const groupedConfigs: Partial<Record<SupportedCliToolId, AgentToolConfig[]>> = {}

    for (const config of configs) {
      if (!isSupportedCliToolId(config.toolId)) {
        continue
      }

      const list = groupedConfigs[config.toolId] ?? []
      list.push(config)
      groupedConfigs[config.toolId] = list
    }

    agentConfigsByTool.value = groupedConfigs
    configuredCliTools.value = SUPPORTED_CLI_TOOLS.filter(
      (tool) => (groupedConfigs[tool.id]?.length ?? 0) > 0,
    )

    if (!configuredCliTools.value.some((tool) => tool.id === createForm.agentCliId)) {
      createForm.agentCliId = configuredCliTools.value[0]?.id ?? ''
    }

    syncAgentToolConfigsForSelectedTool()
  } catch (error) {
    configuredCliTools.value = []
    agentConfigsByTool.value = {}
    agentToolConfigs.value = []
    createForm.agentCliId = ''
    createForm.agentCliConfigId = ''
    message.error(toErrorMessage(error, '加载 Agent CLI 配置失败'))
  } finally {
    loadingAgentConfigs.value = false
  }
}

const loadProjectDependencies = async (projectId: string) => {
  const parallel: Promise<unknown>[] = [
    loadConversationCliOptions(projectId),
    loadBranchesForProject(projectId),
  ]

  if (createForm.mode === 'workflow') {
    parallel.push(loadTemplatesForProject(projectId))
  }

  await Promise.all(parallel)
}

const refreshAccessContext = async (projectId: string) => {
  try {
    await accessStore.loadContext(projectId ? { projectId } : {})
  } catch (error) {
    void error
    accessStore.clear()
  }
}

/**
 * 优先用当前上下文的单个项目详情（与侧栏一致），避免拉全量项目分页。
 * 无有效 projectId 或 detail 失败时再退回 list。
 */
const loadProjectsForForm = async () => {
  const preferredId = createForm.projectId.trim() || resolveProjectIdFromContext().trim()

  if (preferredId) {
    try {
      const project = await withRequestTimeout(
        projectsApi.detail(preferredId),
        PROJECT_DETAIL_FALLBACK_TIMEOUT_MS,
      )
      if (project) {
        projects.value = [project]
        createForm.projectId = project.id
        return
      }
    } catch {
      // detail 不可用（如临时网络错误）时退回全量列表，与旧行为一致
    }
  }

  const projectResponse = await fetchAllPages((page, limit) => projectsApi.list({ page, limit }))
  projects.value = projectResponse

  const contextProjectId = resolveProjectIdFromContext()
  const hasContextProject = projectResponse.some((project) => project.id === contextProjectId)

  if (hasContextProject) {
    createForm.projectId = contextProjectId
  } else if (
    !createForm.projectId ||
    !projectResponse.some((project) => project.id === createForm.projectId)
  ) {
    createForm.projectId = ''
  }
}

const loadPageData = async () => {
  loading.value = true
  initializingProjectDependencies.value = true
  try {
    await loadProjectsForForm()
    await refreshAccessContext(createForm.projectId)
    void loadProjectDependencies(createForm.projectId)
  } catch (error) {
    message.error(toErrorMessage(error, '加载任务页面失败'))
  } finally {
    initializingProjectDependencies.value = false
    loading.value = false
  }
}

const openFilePicker = () => {
  fileInputRef.value?.click()
}

const onFilesSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const incomingFiles = Array.from(input.files ?? [])

  if (incomingFiles.length === 0) {
    return
  }

  const merged = [...selectedFiles.value]
  for (const file of incomingFiles) {
    const duplicated = merged.some(
      (item) =>
        item.name === file.name &&
        item.size === file.size &&
        item.lastModified === file.lastModified,
    )
    if (!duplicated) {
      merged.push(file)
    }
  }

  selectedFiles.value = merged
  input.value = ''
}

const removeFile = (index: number) => {
  selectedFiles.value = selectedFiles.value.filter((_, fileIndex) => fileIndex !== index)
}

const pickRandomHeadline = () => {
  if (TASK_HEADLINES.length === 0) {
    currentHeadline.value = '我能为你做什么？'
    return
  }

  if (TASK_HEADLINES.length === 1) {
    currentHeadline.value = TASK_HEADLINES[0] ?? '我能为你做什么？'
    return
  }

  let nextHeadline = currentHeadline.value
  while (nextHeadline === currentHeadline.value) {
    const index = Math.floor(Math.random() * TASK_HEADLINES.length)
    nextHeadline = TASK_HEADLINES[index] ?? currentHeadline.value
  }
  currentHeadline.value = nextHeadline
}

const createTask = async () => {
  const contextProjectId = resolveProjectIdFromContext()
  const projectIdForSubmit = contextProjectId || createForm.projectId

  if (
    !hasSomeAccess(BUTTON_ACCESS_CONFIG.createTask.capabilities, (capability) =>
      accessStore.hasCapability(capability),
    )
  ) {
    showValidationError('当前项目暂无创建任务权限')
    return
  }

  if (!projectIdForSubmit) {
    showValidationError('请先在左侧栏选择项目后再创建任务')
    return
  }

  if (!createForm.prompt.trim()) {
    showValidationError('请填写提示词')
    return
  }

  if (createForm.mode === 'conversation') {
    if (!createForm.agentCliId) {
      showValidationError('当前业务线没有可用的 Agent CLI 配置，请先在业务线设置中配置')
      return
    }

    if (!createForm.agentCliConfigId) {
      showValidationError('请选择 Agent CLI 配置')
      return
    }
  }

  if (createForm.mode === 'workflow' && !createForm.workflowTemplateId) {
    showValidationError('请选择工作流模板')
    return
  }

  submitting.value = true

  try {
    const project = projects.value.find((item) => item.id === projectIdForSubmit)
    const promptTrimmed = createForm.prompt.trim()
    const initialTitle = initialTitleFromPrompt(promptTrimmed)

    const task = await tasksApi.create({
      projectId: projectIdForSubmit,
      mode: createForm.mode,
      title: initialTitle,
      prompt: promptTrimmed,
      gitBaseBranch: createForm.gitBaseBranch.trim() || project?.defaultBranch?.trim() || undefined,
      configJson: {
        ...(createForm.mode === 'workflow'
          ? {
              workflowTemplateId: createForm.workflowTemplateId || undefined,
            }
          : {
              agentCliId: createForm.agentCliId || undefined,
              agentCliConfigId: createForm.agentCliConfigId || undefined,
            }),
        attachments: selectedFiles.value.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          lastModified: file.lastModified,
        })),
      },
    })

    requestSidebarRecentTasksRefresh()
    message.success('创建任务成功，正在跳转详情')
    resetCreateForm(projectIdForSubmit)
    emit('created', task.id)
    void refreshSidebarRecentTasks()
    await router.push({
      name: 'task-detail',
      params: { id: task.id },
      query: { projectId: projectIdForSubmit },
    })
  } catch (error) {
    message.error(toErrorMessage(error, '创建任务失败'))
  } finally {
    submitting.value = false
  }
}

watch(
  () => createForm.projectId,
  async (projectId, previousProjectId) => {
    if (projectId === previousProjectId || initializingProjectDependencies.value) {
      return
    }

    await refreshAccessContext(projectId)
    await loadProjectDependencies(projectId)
  },
)

watch(
  () => route.query.projectId,
  () => {
    syncProjectFromContext()
  },
)

watch(
  () => props.projectId,
  () => {
    syncProjectFromContext()
  },
)

watch(
  () => createForm.agentCliId,
  (agentCliId, previousCliToolId) => {
    if (agentCliId === previousCliToolId) {
      return
    }

    syncAgentToolConfigsForSelectedTool()
  },
)

watch(
  () => createForm.mode,
  async (mode) => {
    if (mode === 'conversation') {
      createForm.workflowTemplateId = ''
      syncAgentToolConfigsForSelectedTool()
      return
    }

    await loadTemplatesForProject(createForm.projectId)

    if (!createForm.workflowTemplateId && templates.value.length > 0) {
      createForm.workflowTemplateId = templates.value[0]?.id ?? ''
    }

    createForm.agentCliConfigId = ''
  },
)

watch(
  () => createForm.workflowTemplateId,
  (templateId) => {
    if (templateId) {
      createForm.mode = 'workflow'
    }
  },
)

onMounted(() => {
  pickRandomHeadline()
  headlineTimer = setInterval(() => {
    pickRandomHeadline()
  }, HEADLINE_ROTATE_INTERVAL_MS)
  void loadPageData()
})

onBeforeUnmount(() => {
  if (headlineTimer !== null) {
    clearInterval(headlineTimer)
    headlineTimer = null
  }
})
</script>

<template>
  <div
    class="fade-up flex min-h-[calc(var(--app-viewport-height)-8rem)] items-center justify-center px-4 py-8 sm:px-8"
  >
    <div class="w-full max-w-[1120px]">
      <div v-if="loading" class="py-24 text-center text-sm text-muted-foreground">加载中...</div>

      <template v-else>
        <header class="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div
            class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground/80"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" />
            </svg>
          </div>
          <Transition name="headline-fade" mode="out-in">
            <h1
              :key="currentHeadline"
              class="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
            >
              {{ currentHeadline }}
            </h1>
          </Transition>
        </header>

        <form
          class="overflow-hidden rounded-3xl border border-border bg-card/90 shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
          @submit.prevent="createTask"
        >
          <div class="px-5 pt-5 sm:px-6 sm:pt-6">
            <textarea
              v-model="createForm.prompt"
              class="min-h-[360px] w-full resize-none border-0 bg-transparent px-1 text-lg text-foreground outline-none placeholder:text-muted-foreground"
              :placeholder="
                createForm.mode === 'conversation' ? '分配任务，或直接提出问题' : '解决复杂需求...'
              "
            />
          </div>

          <div v-if="selectedFiles.length > 0" class="mx-5 mb-2 flex flex-wrap gap-2 sm:mx-6">
            <span
              v-for="(file, index) in selectedFiles"
              :key="`${file.name}-${file.size}-${file.lastModified}`"
              class="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
            >
              <span class="max-w-[220px] truncate">{{ file.name }}</span>
              <span class="text-muted-foreground">{{ formatFileSize(file.size) }}</span>
              <button
                type="button"
                class="rounded-full text-muted-foreground transition hover:text-foreground"
                aria-label="移除文件"
                @click="removeFile(index)"
              >
                ×
              </button>
            </span>
          </div>

          <div class="overflow-x-auto border-t border-border px-4 py-3 sm:px-5">
            <div class="flex min-w-full w-max flex-nowrap items-center gap-2 [&>*]:shrink-0">
              <input
                ref="fileInputRef"
                type="file"
                multiple
                class="hidden"
                @change="onFilesSelected"
              />

              <button
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground/80 transition hover:bg-muted"
                aria-label="添加文件"
                @click="openFilePicker"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>

              <div
                class="inline-flex h-11 items-center rounded-full border border-border bg-background p-1"
              >
                <button
                  type="button"
                  class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                  :class="
                    createForm.mode === 'conversation'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/80 hover:text-foreground'
                  "
                  @click="createForm.mode = 'conversation'"
                >
                  对话
                </button>
                <button
                  type="button"
                  class="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                  :class="
                    createForm.mode === 'workflow'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/80 hover:text-foreground'
                  "
                  @click="createForm.mode = 'workflow'"
                >
                  工作流
                </button>
              </div>

              <template v-if="createForm.mode === 'conversation'">
                <AppSelect
                  v-model="createForm.agentCliId"
                  aria-label="Agent CLI"
                  :block="false"
                  :options="configuredCliToolOptions"
                  :disabled="loadingAgentConfigs || configuredCliTools.length === 0"
                  :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <path d="M4 17 10 11 4 5" />
                      <path d="M12 19h8" />
                    </svg>
                  </template>
                </AppSelect>

                <AppSelect
                  v-model="createForm.agentCliConfigId"
                  aria-label="Agent CLI 配置"
                  :block="false"
                  :options="agentToolConfigOptions"
                  :disabled="loadingAgentConfigs || agentToolConfigs.length === 0"
                  :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[120px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </template>
                </AppSelect>
              </template>

              <template v-else>
                <AppSelect
                  v-model="createForm.workflowTemplateId"
                  aria-label="工作流模板"
                  :block="false"
                  :options="workflowTemplateOptions"
                  :disabled="loadingTemplates || templates.length === 0"
                  :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                  :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
                  size="lg"
                  trigger-class="min-w-[160px] rounded-full border-border bg-background pl-3 pr-3 text-sm font-medium shadow-none"
                >
                  <template #prefix>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-foreground/70"
                      aria-hidden="true"
                    >
                      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                      <path d="M12 8v8" />
                      <path d="m9 11 3-3 3 3" />
                      <path d="m9 13 3 3 3-3" />
                    </svg>
                  </template>
                </AppSelect>
              </template>

              <AppSelect
                v-model="createForm.gitBaseBranch"
                aria-label="分支"
                :block="false"
                :options="gitBaseBranchOptions"
                :disabled="loadingBranches || branchOptions.length === 0"
                :panel-z-index="TASK_CREATE_SELECT_PANEL_Z_INDEX"
                :panel-placement="TASK_CREATE_SELECT_PANEL_PLACEMENT"
                size="lg"
                trigger-class="w-[92px] rounded-full border-border bg-background pl-2.5 pr-2.5 text-sm font-medium shadow-none"
              >
                <template #prefix>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-foreground/70"
                    aria-hidden="true"
                  >
                    <path d="M6 3v12" />
                    <path d="M18 9v12" />
                    <path d="m3 6 3-3 3 3" />
                    <path d="m15 18 3 3 3-3" />
                  </svg>
                </template>
              </AppSelect>

              <button
                type="submit"
                class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="submitting || !canCreateTask"
                aria-label="创建任务"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m12 19 0-14" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.headline-fade-enter-active,
.headline-fade-leave-active {
  transition: opacity 0.45s ease;
}

.headline-fade-enter-from,
.headline-fade-leave-to {
  opacity: 0;
}
</style>
