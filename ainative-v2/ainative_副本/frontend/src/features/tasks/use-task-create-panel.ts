import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { useAccessStore } from '@app/stores/modules/access'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { gitApi } from '@/api/git'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { workflowApi } from '@/api/workflow'
import type { Project } from '@/types/api/projects'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { BUTTON_ACCESS_CONFIG, hasSomeAccess } from '@shared/constants/access-control'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'
import { buildBranchOptions } from '@shared/utils/git-branch-options'
import { requestSidebarRecentTasksRefresh } from '@features/layout'
import { initialTitleFromPrompt } from '@shared/utils/task-title-placeholder'
import { refreshSidebarRecentTasks } from '@shared/utils/sidebar-recent-tasks-refresh'
import {
  buildConfiguredCliTools,
  groupAgentToolConfigsBySupportedTool,
  resolvePreferredAgentCliConfigId,
  resolvePreferredAgentCliToolId,
} from '@shared/utils/agent-cli-defaults'
import {
  TASK_CREATE_HEADLINES,
  TASK_CREATE_PROJECT_DETAIL_FALLBACK_TIMEOUT_MS,
  TASK_CREATE_SUPPORTED_CLI_TOOLS,
  TASK_HEADLINE_ROTATE_INTERVAL_MS,
  type TaskCreateSupportedCliToolId,
} from './task-create-panel.constants'
import { addProjectRepositoryProvisioningChangedListener } from '@shared/utils/project-repository-provisioning-event'

export type TaskCreatePanelProps = {
  projectId?: string
}

export type TaskCreatePanelEmit = {
  (event: 'created', taskId: string): void
  /** 首次 loadPageData 结束（成功或失败），用于入口按钮关闭 loading */
  (event: 'initialReady'): void
}

export type TaskCreatePanelContext = ReturnType<typeof useTaskCreatePanel>

export function useTaskCreatePanel(
  props: TaskCreatePanelProps,
  emit: TaskCreatePanelEmit,
) {
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
const currentHeadline = ref(TASK_CREATE_HEADLINES[0] ?? '我能为你做什么？')
const initializingProjectDependencies = ref(false)
let headlineTimer: ReturnType<typeof setInterval> | null = null
let latestBranchRequestId = 0
let removeProjectProvisioningChangedListener: (() => void) | null = null
const repositoryProvisioningRefreshInFlight = ref(false)

const projects = ref<Project[]>([])
const templates = ref<WorkflowTemplate[]>([])
const configuredCliTools = ref<Array<{ id: TaskCreateSupportedCliToolId; label: string }>>([])
const agentToolConfigs = ref<AgentToolConfig[]>([])
const agentConfigsByTool = ref<Partial<Record<TaskCreateSupportedCliToolId, AgentToolConfig[]>>>({})
const branchOptions = ref<string[]>([])
const selectedFiles = ref<File[]>([])

const createForm = reactive({
  projectId: '',
  mode: 'conversation' as 'conversation' | 'workflow',
  workflowTemplateId: '',
  agentCliId: '' as TaskCreateSupportedCliToolId | '',
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
  const project = projects.value.find((item) => item.id === createForm.projectId)
  const repositoryReady =
    !project?.repositoryProvisioningStatus ||
    project.repositoryProvisioningStatus === 'ready'

  return (
    Boolean(createForm.projectId) &&
    repositoryReady &&
    hasSomeAccess(BUTTON_ACCESS_CONFIG.createTask.capabilities, (capability) =>
      accessStore.hasCapability(capability),
    )
  )
})

const selectedProject = computed(() => {
  return projects.value.find((item) => item.id === createForm.projectId) ?? null
})

const repositoryProvisioningHint = computed(() => {
  const project = selectedProject.value
  if (!project) {
    return ''
  }
  if (project.repositoryProvisioningStatus === 'pending') {
    return '项目仓库准备中，请稍后再创建任务'
  }
  if (project.repositoryProvisioningStatus === 'failed') {
    const detail = project.repositoryProvisioningError?.trim()
    return detail
      ? `项目仓库准备失败：${detail}`
      : '项目仓库准备失败，请在项目设置中重试仓库准备'
  }
  return ''
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

const replaceProjectInList = (project: Project) => {
  const existingIndex = projects.value.findIndex((item) => item.id === project.id)
  if (existingIndex < 0) {
    projects.value = [...projects.value, project]
    return
  }

  projects.value = projects.value.map((item, index) => (index === existingIndex ? project : item))
}

const ensureProjectLoaded = async (projectId: string) => {
  if (!projectId) {
    return null
  }

  const existingProject = projects.value.find((item) => item.id === projectId)
  if (existingProject) {
    return existingProject
  }

  const latestProject = await projectsApi.detail(projectId)
  replaceProjectInList(latestProject)
  return latestProject
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

const isTaskCreateSupportedCliToolId = (toolId: string): toolId is TaskCreateSupportedCliToolId => {
  return TASK_CREATE_SUPPORTED_CLI_TOOLS.some((tool) => tool.id === toolId)
}

const syncAgentToolConfigsForSelectedTool = () => {
  if (!createForm.agentCliId) {
    agentToolConfigs.value = []
    createForm.agentCliConfigId = ''
    return
  }

  const configs = agentConfigsByTool.value[createForm.agentCliId] ?? []
  agentToolConfigs.value = configs

  createForm.agentCliConfigId = resolvePreferredAgentCliConfigId(
    configs,
    createForm.agentCliConfigId,
  )
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
  const project = await ensureProjectLoaded(projectId)
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
    const [configs, businessLine] = await Promise.all([
      businessLinesApi.listAgentToolConfigs(project.businessLineId),
      businessLinesApi.detail(project.businessLineId).catch(() => null),
    ])
    const groupedConfigs = groupAgentToolConfigsBySupportedTool(
      configs,
      isTaskCreateSupportedCliToolId,
    )

    agentConfigsByTool.value = groupedConfigs
    configuredCliTools.value = buildConfiguredCliTools(
      TASK_CREATE_SUPPORTED_CLI_TOOLS,
      groupedConfigs,
    )
    createForm.agentCliId = resolvePreferredAgentCliToolId({
      currentToolId: createForm.agentCliId,
      defaultToolId: businessLine?.defaultAgentCliToolId,
      configuredTools: configuredCliTools.value,
    })

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
  const project = await ensureProjectLoaded(projectId)
  const repositoryReady =
    !project?.repositoryProvisioningStatus ||
    project.repositoryProvisioningStatus === 'ready'
  const parallel: Promise<unknown>[] = [loadConversationCliOptions(projectId)]

  if (repositoryReady) {
    parallel.push(loadBranchesForProject(projectId))
  } else {
    branchOptions.value = []
    createForm.gitBaseBranch = project?.defaultBranch?.trim() || ''
  }

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
        TASK_CREATE_PROJECT_DETAIL_FALLBACK_TIMEOUT_MS,
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
    emit('initialReady')
  }
}

const refreshSelectedProjectProvisioningStatus = async (
  projectId: string,
) => {
  if (repositoryProvisioningRefreshInFlight.value) {
    return
  }

  repositoryProvisioningRefreshInFlight.value = true
  try {
    const latestProject = await projectsApi.detail(projectId)
    replaceProjectInList(latestProject)

    if (
      latestProject.id === createForm.projectId &&
      latestProject.repositoryProvisioningStatus === 'ready'
    ) {
      await loadProjectDependencies(projectId)
    }
  } catch {
    // Ignore intermittent stream-driven refresh errors.
  } finally {
    repositoryProvisioningRefreshInFlight.value = false
  }
}

const handleRepositoryProvisioningChanged = async (detail: {
  projectId: string
}) => {
  const projectId = createForm.projectId.trim()
  if (!projectId || projectId !== detail.projectId) {
    return
  }
  await refreshSelectedProjectProvisioningStatus(projectId)
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
  if (TASK_CREATE_HEADLINES.length === 0) {
    currentHeadline.value = '我能为你做什么？'
    return
  }

  if (TASK_CREATE_HEADLINES.length === 1) {
    currentHeadline.value = TASK_CREATE_HEADLINES[0] ?? '我能为你做什么？'
    return
  }

  let nextHeadline = currentHeadline.value
  while (nextHeadline === currentHeadline.value) {
    const index = Math.floor(Math.random() * TASK_CREATE_HEADLINES.length)
    nextHeadline = TASK_CREATE_HEADLINES[index] ?? currentHeadline.value
  }
  currentHeadline.value = nextHeadline
}

const createTask = async () => {
  if (submitting.value) {
    return
  }

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

  const selected = projects.value.find((item) => item.id === projectIdForSubmit)
  if (selected?.repositoryProvisioningStatus === 'pending') {
    showValidationError('项目仓库准备中，请稍后再创建任务')
    return
  }
  if (selected?.repositoryProvisioningStatus === 'failed') {
    const detail = selected.repositoryProvisioningError?.trim()
    showValidationError(
      detail
        ? `项目仓库准备失败：${detail}`
        : '项目仓库准备失败，请在项目设置中重试仓库准备',
    )
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
    window.dispatchEvent(new Event('git-sync-updated'))
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
  removeProjectProvisioningChangedListener =
    addProjectRepositoryProvisioningChangedListener(
      handleRepositoryProvisioningChanged,
    )
  pickRandomHeadline()
  headlineTimer = setInterval(() => {
    pickRandomHeadline()
  }, TASK_HEADLINE_ROTATE_INTERVAL_MS)
  void loadPageData()
})

onBeforeUnmount(() => {
  if (removeProjectProvisioningChangedListener) {
    removeProjectProvisioningChangedListener()
    removeProjectProvisioningChangedListener = null
  }
  if (headlineTimer !== null) {
    clearInterval(headlineTimer)
    headlineTimer = null
  }
})


  return reactive({
    accessStore,
    agentConfigsByTool,
    agentToolConfigOptions,
    agentToolConfigs,
    branchOptions,
    canCreateTask,
    configuredCliToolOptions,
    configuredCliTools,
    createForm,
    createTask,
    currentHeadline,
    fileInputRef,
    formatFileSize,
    gitBaseBranchOptions,
    initializingProjectDependencies,
    isTaskCreateSupportedCliToolId,
    latestBranchRequestId,
    loadBranchesForProject,
    loadConversationCliOptions,
    loadPageData,
    loadProjectDependencies,
    loadProjectsForForm,
    loadTemplatesForProject,
    loading,
    loadingAgentConfigs,
    loadingBranches,
    loadingTemplates,
    message,
    onFilesSelected,
    openFilePicker,
    pickRandomHeadline,
    projects,
    repositoryProvisioningHint,
    refreshAccessContext,
    removeFile,
    resetCreateForm,
    resolveProjectIdFromContext,
    resolveQueryProjectId,
    resolveStoredProjectId,
    route,
    router,
    selectedFiles,
    showValidationError,
    submitting,
    syncAgentToolConfigsForSelectedTool,
    syncProjectFromContext,
    templates,
    withRequestTimeout,
    workflowTemplateOptions,
  })
}
