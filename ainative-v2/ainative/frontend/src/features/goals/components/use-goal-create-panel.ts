import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { useAccessStore } from '@app/stores/modules/access'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { goalsApi } from '@/api/goals'
import { gitApi } from '@/api/git'
import { projectsApi } from '@/api/projects'
import { BUTTON_ACCESS_CONFIG, hasSomeAccess } from '@shared/constants/access-control'
import type { Project } from '@/types/api/projects'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { toErrorMessage } from '@api/shared/to-error-message'
import { goalInputDirRelativePath } from '@features/goals/utils/goal-doc-paths'
import {
  createOrUpdateProjectDoc,
  sanitizeGoalInputBasename,
} from '@shared/utils/project-doc-upload'
import type { GoalSourceDocType } from '@/types/api/goals'
import { fetchAllPages } from '@shared/utils/pagination'
import { buildBranchOptions } from '@shared/utils/git-branch-options'
import { randomUuid } from '@shared/utils/random-uuid'
import {
  buildConfiguredCliTools,
  groupAgentToolConfigsBySupportedTool,
  resolvePreferredAgentCliConfigId,
  resolvePreferredAgentCliToolId,
} from '@shared/utils/agent-cli-defaults'
import {
  TASK_CREATE_HEADLINES,
  TASK_CREATE_SUPPORTED_CLI_TOOLS,
  TASK_HEADLINE_ROTATE_INTERVAL_MS,
  type TaskCreateSupportedCliToolId,
} from '@shared/constants/task-goal-create-ui'

export type GoalCreatePanelProps = {
  projectId?: string
}

export type GoalCreatePanelContext = ReturnType<typeof useGoalCreatePanel>

export function useGoalCreatePanel(props: GoalCreatePanelProps) {
  const route = useRoute()
  const router = useRouter()
  const message = useMessage()
  const accessStore = useAccessStore()

  const loading = ref(false)
  const loadingAgentConfigs = ref(false)
  let latestBranchRequestId = 0
  const loadingBranches = ref(false)
  const branchOptions = ref<string[]>([])
  const submitting = ref(false)
  const currentHeadline = ref(TASK_CREATE_HEADLINES[0] ?? '我能为你做什么？')
  let headlineTimer: ReturnType<typeof setInterval> | null = null
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const selectedFiles = ref<File[]>([])

  const projects = ref<Project[]>([])
  const configuredCliTools = ref<Array<{ id: TaskCreateSupportedCliToolId; label: string }>>([])
  const agentToolConfigs = ref<AgentToolConfig[]>([])
  const agentConfigsByTool = ref<Partial<Record<TaskCreateSupportedCliToolId, AgentToolConfig[]>>>(
    {},
  )

  const form = reactive({
    projectId: '',
    title: '',
    summary: '',
    gitBaseBranch: '',
    agentCliId: '' as TaskCreateSupportedCliToolId | '',
    agentCliConfigId: '',
  })

  const configuredCliToolOptions = computed(() =>
    configuredCliTools.value.map((tool) => ({ label: tool.label, value: tool.id })),
  )

  const agentToolConfigOptions = computed(() =>
    agentToolConfigs.value.map((config) => ({ label: config.name, value: config.id })),
  )

  const gitBaseBranchOptions = computed(() =>
    branchOptions.value.map((branch) => ({ label: branch, value: branch })),
  )

  const canSubmit = computed(() => {
    return (
      Boolean(form.projectId?.trim()) &&
      Boolean(form.title?.trim()) &&
      Boolean(form.gitBaseBranch?.trim()) &&
      Boolean(form.agentCliId) &&
      Boolean(form.agentCliConfigId) &&
      hasSomeAccess(BUTTON_ACCESS_CONFIG.createTask.capabilities, (capability) =>
        accessStore.hasCapability(capability),
      )
    )
  })

  const resolveQueryProjectId = () =>
    typeof route.query.projectId === 'string' ? route.query.projectId : ''

  const resolveStoredProjectId = () =>
    typeof window === 'undefined'
      ? ''
      : (localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? '')

  /** 与 TaskCreatePanel 一致：props / URL query / 侧栏持久化的当前项目 */
  const resolveProjectIdFromContext = () =>
    props.projectId || resolveQueryProjectId() || resolveStoredProjectId()

  const syncProjectFromContext = () => {
    const projectId = resolveProjectIdFromContext()
    if (projectId) {
      form.projectId = projectId
    }
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

  const mapWorkspaceProject = (
    businessLineId: string,
    workspaceProject: Awaited<ReturnType<typeof businessLinesApi.getWorkspaceProject>>,
  ): Project | null => {
    if (!workspaceProject.enabled || !workspaceProject.projectId) {
      return null
    }

    return {
      id: workspaceProject.projectId,
      businessLineId: workspaceProject.businessLineId ?? businessLineId,
      name: workspaceProject.name ?? 'AINative Workspace',
      slug: '_managed',
      description: workspaceProject.description ?? null,
      gitUrl: workspaceProject.gitUrl ?? '',
      defaultBranch: workspaceProject.defaultBranch ?? 'master',
      repositoryProvisioningStatus:
        (workspaceProject.repositoryProvisioningStatus as Project['repositoryProvisioningStatus']) ??
        'ready',
      repositoryProvisioningError: workspaceProject.repositoryProvisioningError ?? null,
      repositoryProvisionedAt: workspaceProject.repositoryProvisionedAt ?? null,
      configJson: workspaceProject.configJson ?? null,
    }
  }

  const isWorkspaceManagedProject = (project: Project | null | undefined) => {
    return project?.configJson?.workspaceManaged === true
  }

  function docTypeForGoalSourceFile(file: File): GoalSourceDocType {
    const name = file.name.toLowerCase()
    if (name.endsWith('.zip')) {
      return 'prototype'
    }
    if (name.endsWith('.md') || name.endsWith('.markdown')) {
      return 'requirement'
    }
    return 'requirement'
  }

  function isZipFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.zip')
  }

  const openFilePicker = () => {
    fileInputRef.value?.click()
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

  const isTaskCreateSupportedCliToolId = (toolId: string): toolId is TaskCreateSupportedCliToolId =>
    TASK_CREATE_SUPPORTED_CLI_TOOLS.some((tool) => tool.id === toolId)

  const loadBranchesForProject = async (projectId: string) => {
    const requestId = ++latestBranchRequestId
    const project = await ensureProjectLoaded(projectId)
    const projectDefaultBranch = project?.defaultBranch?.trim() || ''

    if (!projectId) {
      branchOptions.value = []
      form.gitBaseBranch = ''
      return
    }

    loadingBranches.value = true
    try {
      const branchData =
        isWorkspaceManagedProject(project) && project?.businessLineId
          ? await gitApi.workspaceBranches(project.businessLineId)
          : await gitApi.branches(projectId)
      if (requestId !== latestBranchRequestId) {
        return
      }
      const apiDefaultBranch = branchData.defaultBranch?.trim() || ''
      const nextBranchOptions = buildBranchOptions({
        localBranches: branchData.localBranches,
        remoteBranches: branchData.remoteBranches,
        preferredBranches: [apiDefaultBranch, projectDefaultBranch],
      })
      branchOptions.value = nextBranchOptions
      const currentBaseBranch = form.gitBaseBranch.trim()
      const fallbackBaseBranch =
        nextBranchOptions.find((branch) => branch === apiDefaultBranch) ??
        nextBranchOptions.find((branch) => branch === projectDefaultBranch) ??
        nextBranchOptions[0] ??
        (apiDefaultBranch || projectDefaultBranch)
      form.gitBaseBranch =
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
      if (!fallbackBranches.includes(form.gitBaseBranch.trim())) {
        form.gitBaseBranch = fallbackBranches[0] ?? ''
      }
      message.error(toErrorMessage(error, '加载项目分支失败'))
    } finally {
      if (requestId === latestBranchRequestId) {
        loadingBranches.value = false
      }
    }
  }

  const syncAgentToolConfigsForSelectedTool = () => {
    if (!form.agentCliId) {
      agentToolConfigs.value = []
      form.agentCliConfigId = ''
      return
    }
    const configs = agentConfigsByTool.value[form.agentCliId] ?? []
    agentToolConfigs.value = configs
    form.agentCliConfigId = resolvePreferredAgentCliConfigId(
      configs,
      form.agentCliConfigId,
    )
  }

  const loadConversationCliOptions = async (projectId: string) => {
    const project = await ensureProjectLoaded(projectId)
    if (!project?.businessLineId) {
      configuredCliTools.value = []
      agentConfigsByTool.value = {}
      agentToolConfigs.value = []
      form.agentCliId = ''
      form.agentCliConfigId = ''
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
      form.agentCliId = resolvePreferredAgentCliToolId({
        currentToolId: form.agentCliId,
        defaultToolId: businessLine?.defaultAgentCliToolId,
        configuredTools: configuredCliTools.value,
      })
      syncAgentToolConfigsForSelectedTool()
    } catch (error) {
      configuredCliTools.value = []
      agentConfigsByTool.value = {}
      agentToolConfigs.value = []
      form.agentCliId = ''
      form.agentCliConfigId = ''
      message.error(toErrorMessage(error, '加载 Agent CLI 配置失败'))
    } finally {
      loadingAgentConfigs.value = false
    }
  }

  const refreshAccessContext = async (projectId: string) => {
    try {
      await accessStore.loadContext(projectId ? { projectId } : {})
    } catch {
      accessStore.clear()
    }
  }

  /**
   * 与 TaskCreatePanel.loadProjectsForForm 相同：优先拉当前上下文单个项目详情，
   * 失败时再退回全量列表以解析 projectId。
   */
  const loadProjectsForForm = async () => {
    const preferredId = form.projectId.trim() || resolveProjectIdFromContext().trim()
    const activeBusinessLineId =
      localStorage.getItem(STORAGE_KEYS.lastActiveBusinessLineId)?.trim() ?? ''

    if (activeBusinessLineId) {
      try {
        const workspaceProject = mapWorkspaceProject(
          activeBusinessLineId,
          await businessLinesApi.getWorkspaceProject(activeBusinessLineId),
        )
        if (workspaceProject) {
          projects.value = [workspaceProject]
          form.projectId = workspaceProject.id
          return
        }
      } catch {
        // Workspace project resolution is best-effort; legacy project loading remains a fallback.
      }
    }

    if (preferredId) {
      try {
        const project = await projectsApi.detail(preferredId)
        projects.value = [project]
        form.projectId = project.id
        return
      } catch {
        // detail 不可用时退回全量列表
      }
    }

    const projectResponse = await fetchAllPages((page, limit) => projectsApi.list({ page, limit }))
    projects.value = projectResponse
    const contextProjectId = resolveProjectIdFromContext()
    const hasContext = projectResponse.some((p) => p.id === contextProjectId)
    if (hasContext) {
      form.projectId = contextProjectId
    } else if (
      !form.projectId ||
      !projectResponse.some((project) => project.id === form.projectId)
    ) {
      form.projectId = ''
    }
  }

  const loadPageData = async () => {
    loading.value = true
    try {
      await loadProjectsForForm()
      await refreshAccessContext(form.projectId)
      await loadConversationCliOptions(form.projectId)
      await loadBranchesForProject(form.projectId)
    } catch (error) {
      message.error(toErrorMessage(error, '加载失败'))
    } finally {
      loading.value = false
    }
  }

  const submit = async () => {
    if (submitting.value) {
      return
    }

    if (
      !hasSomeAccess(BUTTON_ACCESS_CONFIG.createTask.capabilities, (capability) =>
        accessStore.hasCapability(capability),
      )
    ) {
      message.error('当前项目暂无创建需求权限')
      return
    }
    const projectIdForSubmit = form.projectId.trim() || resolveProjectIdFromContext().trim()
    if (!projectIdForSubmit) {
      message.error('请先在左侧栏选择项目后再创建需求')
      return
    }
    if (!form.title.trim()) {
      message.error('请填写目标')
      return
    }
    if (!form.gitBaseBranch.trim()) {
      message.error('请选择 Git 基准分支')
      return
    }
    if (!form.agentCliId || !form.agentCliConfigId) {
      message.error('请先在业务线配置 Agent CLI，并选择 CLI 与配置')
      return
    }

    submitting.value = true
    try {
      const project = projects.value.find((item) => item.id === projectIdForSubmit)
      const isWorkspaceGoal = isWorkspaceManagedProject(project) && Boolean(project?.businessLineId)
      const goal = await goalsApi.create({
        ...(isWorkspaceGoal
          ? { businessLineId: project!.businessLineId }
          : { projectId: projectIdForSubmit }),
        title: form.title.trim(),
        gitBaseBranch: form.gitBaseBranch.trim(),
        summary: form.summary.trim() || undefined,
        agentCliId: form.agentCliId,
        agentCliConfigId: form.agentCliConfigId,
      })

      const files = selectedFiles.value
      let uploadFailCount = 0
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file) {
          continue
        }
        const relativePath = `${goalInputDirRelativePath(goal.id)}/${randomUuid()}-${sanitizeGoalInputBasename(file.name)}`
        try {
          await createOrUpdateProjectDoc(projectIdForSubmit, relativePath, file)
          await goalsApi.addSourceDoc(goal.id, {
            projectDocPath: relativePath,
            docType: docTypeForGoalSourceFile(file),
            sortOrder: i,
          })
          if (isZipFile(file)) {
            try {
              const unpackResult = await goalsApi.unpackInputZip(goal.id, {
                projectDocPath: relativePath,
              })
              if (unpackResult.extractedFileCount === 0) {
                uploadFailCount += 1
                message.warning('压缩包内没有可登记的有效文件，请更换后重试')
              }
            } catch (unpackError) {
              uploadFailCount += 1
              message.error(toErrorMessage(unpackError, '压缩包处理失败'))
            }
          }
        } catch {
          uploadFailCount += 1
        }
      }

      if (files.length === 0) {
        message.success('已创建需求')
      } else if (uploadFailCount === 0) {
        message.success('已创建需求，已关联资料')
      } else if (uploadFailCount === files.length) {
        message.warning('需求已创建，但资料未能上传，请稍后在项目知识库或详情中补充')
      } else {
        message.warning(
          `需求已创建，有 ${uploadFailCount} 个文件未能关联，其余已保存；可在知识库或稍后重试`,
        )
      }

      selectedFiles.value = []
      await router.push({ name: 'goal-detail', params: { goalId: goal.id } })
    } catch (error) {
      message.error(toErrorMessage(error, '创建需求失败'))
    } finally {
      submitting.value = false
    }
  }

  watch(
    () => form.projectId,
    async (projectId, prev) => {
      if (projectId === prev) return
      await refreshAccessContext(projectId)
      await loadConversationCliOptions(projectId)
      await loadBranchesForProject(projectId)
    },
  )

  watch(
    () => form.agentCliId,
    (id, prev) => {
      if (id === prev) return
      syncAgentToolConfigsForSelectedTool()
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

  onMounted(() => {
    pickRandomHeadline()
    headlineTimer = setInterval(() => {
      pickRandomHeadline()
    }, TASK_HEADLINE_ROTATE_INTERVAL_MS)
    syncProjectFromContext()
    void loadPageData()
  })

  onBeforeUnmount(() => {
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
    canSubmit,
    configuredCliToolOptions,
    configuredCliTools,
    currentHeadline,
    fileInputRef,
    form,
    gitBaseBranchOptions,
    isTaskCreateSupportedCliToolId,
    latestBranchRequestId,
    loadBranchesForProject,
    loadConversationCliOptions,
    loadPageData,
    loadProjectsForForm,
    loading,
    loadingAgentConfigs,
    loadingBranches,
    message,
    onFilesSelected,
    openFilePicker,
    pickRandomHeadline,
    projects,
    refreshAccessContext,
    removeFile,
    resolveProjectIdFromContext,
    resolveQueryProjectId,
    resolveStoredProjectId,
    route,
    router,
    selectedFiles,
    submit,
    submitting,
    syncAgentToolConfigsForSelectedTool,
    syncProjectFromContext,
  })
}
