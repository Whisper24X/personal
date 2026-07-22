import type { ComponentPublicInstance, InjectionKey } from 'vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { useAccessStore } from '@app/stores/modules/access'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import {
  createProjectContainerRuntimeFormState,
  useProjectContainerRuntimeForm,
} from '@shared/composables/useProjectContainerRuntimeForm'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { usersApi } from '@/api/users'
import { workflowApi } from '@/api/workflow'
import type { ProjectContext } from '@/types/api/project-context'
import type {
  Project,
  ProjectCustomRole,
  ProjectMember,
} from '@/types/api/projects'
import type { Task } from '@/types/api/tasks'
import type { User } from '@/types/api/users'
import type {
  WorkflowTemplate,
  WorkflowTemplateNode,
  WorkflowTemplateNodeInput,
} from '@/types/api/workflow'
import { SETTINGS_QUERY_KEY } from '@shared/types/common/settings'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { HttpError } from '@api/shared/error'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'
import {
  buildConfiguredCliTools,
  groupAgentToolConfigsBySupportedTool,
  resolvePreferredAgentCliConfigId,
} from '@shared/utils/agent-cli-defaults'
import {
  buildProjectRoleAssignmentOptions,
  isProjectDefaultRole,
  resolveRoleAssignmentKey,
} from '@shared/constants/access'
import { PROJECT_DETAIL_SUPPORTED_CLI_TOOLS } from '@features/projects/projects-detail-workflow.constants'
import {
  buildWorkflowNodesForSubmit,
  createEmptyWorkflowNodeInput,
  isProjectDetailSupportedCliToolId,
  normalizeWorkflowNodeInput,
  normalizeWorkflowNodes,
  resolveWorkflowNodeInputByContext,
  validateBusinessLineWorkflowTemplateForProjectCopy,
  validateWorkflowNodesPlain,
} from '@features/projects/projects-detail-workflow.helpers'
import type {
  ProjectDetailSupportedCliToolId,
  WorkflowTemplateNodeForm,
  WorkflowTemplateNodeInputForm,
} from '@features/projects/projects-detail-workflow.types'
import { PROJECT_WORKFLOW_SELECT_PANEL_Z_INDEX } from '@features/projects/projects-detail-workflow.constants'
import { getProjectIdFromRoute, loadStoredSelectedProjectId } from '@features/layout'
import {
  resolveProjectsDetailInitialTab,
  resolveProjectsDetailRouteTab,
  type ProjectsDetailTabKey,
} from '@features/projects/projects-detail-route.utils'

export type ProjectsDetailPageContext = ReturnType<typeof useProjectsDetailPage>

export const projectsDetailPageInjectionKey = Symbol(
  'projectsDetailPage',
) as InjectionKey<ProjectsDetailPageContext>

export function useProjectsDetailPage() {
const route = useRoute()
const router = useRouter()

const projectId = computed(() => {
  const fromRoute = getProjectIdFromRoute(route).trim()
  if (fromRoute) {
    return fromRoute
  }

  return loadStoredSelectedProjectId().trim()
})

type TabKey = ProjectsDetailTabKey

const workflowOnlyMode = computed(() => {
  return route.path === '/projects/workflows' || route.path.endsWith('/workflows')
})

const resolveInitialTab = (): TabKey => {
  return resolveProjectsDetailInitialTab({
    path: route.path,
    queryTab: route.query.tab,
  })
}

const tab = ref<TabKey>(resolveInitialTab())

const loading = ref(false)
const validationMessage = ref('')
const message = useMessage()
const accessStore = useAccessStore()

const project = ref<Project | null>(null)
const projectMembers = ref<ProjectMember[]>([])
const projectCustomRoles = ref<ProjectCustomRole[]>([])
const recentTasks = ref<Task[]>([])
const projectContext = ref<ProjectContext | null>(null)
const users = ref<User[]>([])
const contextLoading = ref(false)

const creatingMember = ref(false)
const updatingMemberId = ref<string | null>(null)
const removingMemberId = ref<string | null>(null)
const memberRemoveConfirmOpen = ref(false)
const memberRemoveTarget = ref<ProjectMember | null>(null)
const savingConfig = ref(false)
const memberFormModalOpen = ref(false)
const configFormModalOpen = ref(false)

const loadingWorkflowTemplates = ref(false)
const submittingWorkflowTemplate = ref(false)
const workflowCreateModalOpen = ref(false)
const workflowTemplateModalMode = ref<'create' | 'edit'>('create')
const editingWorkflowTemplateId = ref('')
const workflowTemplateActionId = ref('')
const workflowDeleteConfirmOpen = ref(false)
const workflowDeleteTarget = ref<WorkflowTemplate | null>(null)
const workflowValidationMessage = ref('')
const workflowTemplates = ref<WorkflowTemplate[]>([])
const workflowKeyword = ref('')
const workflowAddMenuOpen = ref(false)
const workflowAddMenuAnchorRef = ref<HTMLElement | null>(null)
const workflowCopyModalOpen = ref(false)
const workflowCopyKeyword = ref('')
const loadingBusinessLineWorkflowTemplates = ref(false)
const businessLineWorkflowTemplates = ref<WorkflowTemplate[]>([])
const copyingBusinessLineWorkflowTemplateId = ref('')
const copyWorkflowErrorMessage = ref('')
const workflowConfiguredCliTools = ref<Array<{ id: ProjectDetailSupportedCliToolId; label: string }>>([])
const loadingWorkflowConfiguredCliTools = ref(false)
const workflowNodeConfigsByTool = ref<Partial<Record<ProjectDetailSupportedCliToolId, AgentToolConfig[]>>>({})
const workflowNodeConfigLoadingByTool = ref<Partial<Record<ProjectDetailSupportedCliToolId, boolean>>>({})
const workflowDefaultAgentCliToolId = ref<ProjectDetailSupportedCliToolId | ''>('')
const workflowEditorActiveNodeIndex = ref(0)
const workflowCreateForm = ref<{
  name: string
  description: string
  nodes: WorkflowTemplateNodeForm[]
}>({
  name: '',
  description: '',
  nodes: [
    {
      nodeOrder: 1,
      name: 'step-1',
      type: 'agent',
      requiresApproval: false,
      requiresArtifact: false,
      input: {
        prompt: '',
        agentCliId: '',
        agentCliConfigId: '',
        loopEnabled: false,
        earlyExitMarkerEnabled: false,
        earlyExitMarkerFileName: '',
      },
    },
  ],
})

const memberRoleDrafts = ref<Record<string, string>>({})

const newMemberForm = reactive({
  userId: '',
  roleKey: '',
})

type SubRepoEntry = { url: string; prefix: string; branch: string }

const configForm = reactive({
  name: '',
  description: '',
  gitUrl: '',
  defaultBranch: 'main',
  agentAdapter: 'codex',
  gitRuntimeEnabled: false,
  repoLocalPath: '',
  repoCacheBaseDir: '',
  worktreeBaseDir: '',
  skills: '',
  mcp: '',
  maxConcurrency: '2',
  priority: 'normal',
  runnerCommand: '',
  runnerArgs: '',
  runnerTimeoutSeconds: '600',
  subRepos: [] as SubRepoEntry[],
  ...createProjectContainerRuntimeFormState(),
})

const {
  syncFromContainerRuntime,
  parseContainerEnvInput,
  parseRunnerOrchestrationInput,
  validateContainerRuntime,
  buildProjectConfigJson: buildContainerRuntimeConfigJson,
} = useProjectContainerRuntimeForm(configForm)

const containerEnvSummary = computed(() => {
  const parsedEnv = parseContainerEnvInput(configForm.containerEnv)
  const count = Object.keys(parsedEnv.env).length

  return count > 0 ? `${count} 项` : '跟随全局默认'
})

const containerServiceSummary = computed(() => {
  const parsedRunnerOrchestration = parseRunnerOrchestrationInput(
    configForm.containerRunnerOrchestration,
  )
  const services = parsedRunnerOrchestration.config?.services

  return Array.isArray(services) ? `${services.length} 个服务` : '跟随全局默认'
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

const statusLabelMap: Record<Task['status'], string> = {
  todo: '待执行',
  in_progress: '处理中',
  in_review: '待完成',
  done: '已完成',
}

const statusClassMap: Record<Task['status'], string> = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

const contextSourceLabelMap: Record<ProjectContext['source'], string> = {
  local_repository: '本地仓库',
  project_config: '项目配置',
  empty: '未找到上下文',
}

const formatContextLength = (length: number) => {
  if (length >= 1024 * 1024) {
    return `${(length / (1024 * 1024)).toFixed(2)} MB`
  }

  if (length >= 1024) {
    return `${(length / 1024).toFixed(1)} KB`
  }

  return `${length} B`
}

const tabClass = (key: TabKey) =>
  key === tab.value
    ? 'bg-background text-foreground shadow-sm'
    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'

const userMap = computed(() => {
  return new Map(users.value.map((user) => [user.id, user]))
})

const runningTaskCount = computed(() => {
  return recentTasks.value.filter((task) => task.status === 'in_progress').length
})

const doneTaskCount = computed(() => {
  return recentTasks.value.filter((task) => task.status === 'done').length
})

const workflowConfiguredCliToolIdSet = computed(() => {
  return new Set(workflowConfiguredCliTools.value.map((tool) => tool.id))
})

const workflowTemplateModalTitle = computed(() => {
  return workflowTemplateModalMode.value === 'edit' ? '编辑项目工作流模板' : '创建项目工作流模板'
})

const activeWorkflowCreateNode = computed(() => {
  return workflowCreateForm.value.nodes[workflowEditorActiveNodeIndex.value] ?? null
})

const workflowTemplateSubmitIdleText = computed(() => {
  return workflowTemplateModalMode.value === 'edit' ? '保存修改' : '创建模板'
})

const workflowTemplateSubmitLoadingText = computed(() => {
  return workflowTemplateModalMode.value === 'edit' ? '保存中...' : '创建中...'
})

const canManageProjectMembers = computed(() => {
  return accessStore.hasCapability('businessLine.member.updateRole')
})

const projectRoleOptions = computed(() => {
  return buildProjectRoleAssignmentOptions(projectCustomRoles.value)
})

const projectRoleSelectOptions = computed(() => {
  return projectRoleOptions.value.map((item) => ({
    label: item.label,
    value: item.key,
  }))
})

const preferredProjectRoleKey = computed(() => {
  const developerRole = projectCustomRoles.value.find((role) =>
    isProjectDefaultRole(role, 'developer'),
  )

  return (
    (developerRole ? `role:${developerRole.id}` : '') ||
    projectRoleOptions.value.find((item) => item.source === 'default')?.key ||
    projectRoleOptions.value[0]?.key ||
    ''
  )
})

const canAccessWorkflow = computed(() => {
  return accessStore.hasCapability('project.workflow.read')
})

const canUpdateProject = computed(() => {
  return accessStore.hasCapability('businessLine.project.update')
})

const availableTabs = computed<TabKey[]>(() => {
  const tabs: TabKey[] = ['overview', 'context']

  if (canManageProjectMembers.value) {
    tabs.push('members')
  }

  if (canAccessWorkflow.value) {
    tabs.push('workflow')
  }

  if (canUpdateProject.value) {
    tabs.push('config')
  }

  return tabs
})

watch(
  projectRoleOptions,
  (options) => {
    if (!options.some((item) => item.key === newMemberForm.roleKey)) {
      newMemberForm.roleKey = preferredProjectRoleKey.value
    }
  },
  { immediate: true },
)

const workflowCliToolSelectOptions = computed(() => {
  if (!loadingWorkflowConfiguredCliTools.value && workflowConfiguredCliTools.value.length === 0) {
    return [
      {
        label: '当前业务线暂无已配置 Agent CLI',
        value: '',
        disabled: true,
      },
    ]
  }

  return workflowConfiguredCliTools.value.map((tool) => ({
    label: tool.label,
    value: tool.id,
  }))
})

const filteredBusinessLineWorkflowTemplates = computed(() => {
  const keyword = workflowCopyKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return businessLineWorkflowTemplates.value
  }

  return businessLineWorkflowTemplates.value.filter((item) => {
    return (
      item.name.toLowerCase().includes(keyword) ||
      (item.description ?? '').toLowerCase().includes(keyword)
    )
  })
})

const displayUserName = (userId: string) => {
  const user = userMap.value.get(userId)
  if (!user) {
    return userId
  }

  return user.nickname?.trim() || user.username
}

const displayUserMeta = (userId: string) => {
  const user = userMap.value.get(userId)
  if (!user) {
    return ''
  }

  return user.username
}

const normalizeOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const resolveWorkflowNodeInput = (
  input: WorkflowTemplateNodeInput | WorkflowTemplateNodeInputForm | undefined,
): WorkflowTemplateNodeInputForm => {
  return resolveWorkflowNodeInputByContext(
    input,
    workflowConfiguredCliTools.value,
    workflowNodeConfigsByTool.value,
    workflowDefaultAgentCliToolId.value,
  )
}

const buildWorkflowNode = (nodeOrder: number): WorkflowTemplateNodeForm => ({
  nodeOrder,
  name: `step-${nodeOrder}`,
  type: 'agent',
  requiresApproval: true,
  requiresArtifact: false,
  maxLoops: 1,
  input: resolveWorkflowNodeInput(createEmptyWorkflowNodeInput()),
})

const validateWorkflowNodes = (nodes: WorkflowTemplateNode[]) => {
  return validateWorkflowNodesPlain(nodes, {
    configuredCliToolIdSet: workflowConfiguredCliToolIdSet.value as Set<ProjectDetailSupportedCliToolId>,
    hasConfiguredCliTools: workflowConfiguredCliTools.value.length > 0,
  })
}

const ensureWorkflowCreateNodeShape = () => {
  if (workflowCreateForm.value.nodes.length === 0) {
    workflowCreateForm.value.nodes = [buildWorkflowNode(1)]
  }

  workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
  syncWorkflowEditorActiveNodeIndex()
}

const resetWorkflowCreateForm = () => {
  workflowValidationMessage.value = ''
  workflowEditorActiveNodeIndex.value = 0
  workflowCreateForm.value = {
    name: '',
    description: '',
    nodes: [buildWorkflowNode(1)],
  }
}

const syncWorkflowEditorActiveNodeIndex = (preferredIndex = workflowEditorActiveNodeIndex.value) => {
  const maxIndex = workflowCreateForm.value.nodes.length - 1
  workflowEditorActiveNodeIndex.value = Math.min(Math.max(preferredIndex, 0), Math.max(maxIndex, 0))
}

const formatWorkflowNodeTabLabel = (node: WorkflowTemplateNodeForm, index: number) => {
  const normalizedName = node.name.trim()
  return normalizedName || `节点 ${index + 1}`
}

const buildWorkflowFormNodesFromTemplate = (
  template: WorkflowTemplate,
): WorkflowTemplateNodeForm[] => {
  const sourceNodes = template.nodesJson.length > 0 ? template.nodesJson : [buildWorkflowNode(1)]

  return normalizeWorkflowNodes(
    sourceNodes.map((node, index) => ({
      nodeOrder: node.nodeOrder || index + 1,
      name: node.name || `step-${index + 1}`,
      type: node.type || 'agent',
      requiresApproval: Boolean(node.requiresApproval),
      requiresArtifact: Boolean(node.requiresArtifact),
      maxLoops: (node.input as WorkflowTemplateNodeInput | undefined)?.maxLoops ?? 1,
      input: normalizeWorkflowNodeInput(node.input),
    })),
  )
}

const loadWorkflowConfiguredCliTools = async (businessLineId: string) => {
  if (!businessLineId) {
    workflowConfiguredCliTools.value = []
    workflowNodeConfigsByTool.value = {}
    workflowDefaultAgentCliToolId.value = ''
    return
  }

  loadingWorkflowConfiguredCliTools.value = true

  try {
    const [configs, businessLine] = await Promise.all([
      businessLinesApi.listAgentToolConfigs(businessLineId),
      businessLinesApi.detail(businessLineId).catch(() => null),
    ])
    if (businessLineId !== project.value?.businessLineId) {
      return
    }

    const groupedConfigs = groupAgentToolConfigsBySupportedTool(
      configs,
      isProjectDetailSupportedCliToolId,
    )
    const configuredTools = buildConfiguredCliTools(
      PROJECT_DETAIL_SUPPORTED_CLI_TOOLS,
      groupedConfigs,
    )
    const nextDefaultAgentCliToolId = businessLine?.defaultAgentCliToolId ?? ''
    workflowNodeConfigsByTool.value = groupedConfigs
    workflowConfiguredCliTools.value = configuredTools
    workflowDefaultAgentCliToolId.value = isProjectDetailSupportedCliToolId(
      nextDefaultAgentCliToolId,
    )
      ? nextDefaultAgentCliToolId
      : ''
    workflowCreateForm.value.nodes = normalizeWorkflowNodes(
      workflowCreateForm.value.nodes.map((node) => ({
        ...node,
        input: resolveWorkflowNodeInputByContext(
          node.input,
          configuredTools,
          groupedConfigs,
          workflowDefaultAgentCliToolId.value,
        ),
      })),
    )
    syncWorkflowEditorActiveNodeIndex()
  } catch (error) {
    if (businessLineId === project.value?.businessLineId) {
      workflowConfiguredCliTools.value = []
      workflowNodeConfigsByTool.value = {}
      workflowDefaultAgentCliToolId.value = ''
      message.error(toErrorMessage(error, '加载项目工作流 Agent CLI 列表失败'))
    }
  } finally {
    if (businessLineId === project.value?.businessLineId) {
      loadingWorkflowConfiguredCliTools.value = false
    }
  }
}

const loadWorkflowNodeConfigs = async (
  businessLineId: string,
  toolId: ProjectDetailSupportedCliToolId,
): Promise<AgentToolConfig[]> => {
  const cachedConfigs = workflowNodeConfigsByTool.value[toolId]
  if (cachedConfigs) {
    return cachedConfigs
  }

  workflowNodeConfigLoadingByTool.value = {
    ...workflowNodeConfigLoadingByTool.value,
    [toolId]: true,
  }

  try {
    const configs = await businessLinesApi.listAgentToolConfigs(businessLineId, { toolId })
    if (businessLineId !== project.value?.businessLineId) {
      return []
    }

    workflowNodeConfigsByTool.value = {
      ...workflowNodeConfigsByTool.value,
      [toolId]: configs,
    }

    return configs
  } catch (error) {
    if (businessLineId === project.value?.businessLineId) {
      workflowNodeConfigsByTool.value = {
        ...workflowNodeConfigsByTool.value,
        [toolId]: [],
      }
      message.error(toErrorMessage(error, '加载工作流节点 Agent CLI 配置失败'))
    }
    return []
  } finally {
    if (businessLineId === project.value?.businessLineId) {
      workflowNodeConfigLoadingByTool.value = {
        ...workflowNodeConfigLoadingByTool.value,
        [toolId]: false,
      }
    }
  }
}

const getWorkflowNodeConfigs = (toolId: ProjectDetailSupportedCliToolId | '') => {
  if (!toolId) {
    return []
  }

  return workflowNodeConfigsByTool.value[toolId] ?? []
}

const getWorkflowNodeConfigSelectOptions = (toolId: string) => {
  const id = toolId as ProjectDetailSupportedCliToolId | ''
  return getWorkflowNodeConfigs(id).map((config) => ({
    label: config.name,
    value: config.id,
  }))
}

const isWorkflowNodeConfigLoading = (toolId: string) => {
  if (!toolId) {
    return false
  }

  return Boolean(workflowNodeConfigLoadingByTool.value[toolId as ProjectDetailSupportedCliToolId])
}

const handleWorkflowNodeCliToolChange = async (node: WorkflowTemplateNodeForm) => {
  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    node.input = resolveWorkflowNodeInput(node.input)
    return
  }

  if (
    !node.input.agentCliId ||
    !workflowConfiguredCliToolIdSet.value.has(node.input.agentCliId as ProjectDetailSupportedCliToolId)
  ) {
    node.input = resolveWorkflowNodeInput(node.input)
    return
  }

  const selectedToolId = node.input.agentCliId as ProjectDetailSupportedCliToolId
  node.input.agentCliConfigId = ''

  const configs = await loadWorkflowNodeConfigs(businessLineId, selectedToolId)
  if (node.input.agentCliId !== selectedToolId) {
    return
  }

  node.input.agentCliConfigId = resolvePreferredAgentCliConfigId(
    configs,
    node.input.agentCliConfigId,
  )
}

const preloadWorkflowNodeConfigs = async () => {
  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    return
  }

  const toolIds = Array.from(
    new Set(
      workflowCreateForm.value.nodes
        .map((node) => node.input.agentCliId)
        .filter((toolId): toolId is ProjectDetailSupportedCliToolId => Boolean(toolId)),
    ),
  )

  await Promise.all(toolIds.map((toolId) => loadWorkflowNodeConfigs(businessLineId, toolId)))
}

const openWorkflowCreateModal = () => {
  if (!canAccessWorkflow.value) {
    message.error('当前账号暂无项目工作流管理权限')
    return
  }

  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    message.error('当前项目未绑定业务线，无法创建工作流模板')
    return
  }

  workflowAddMenuOpen.value = false
  workflowTemplateModalMode.value = 'create'
  editingWorkflowTemplateId.value = ''
  resetWorkflowCreateForm()
  ensureWorkflowCreateNodeShape()
  workflowNodeConfigLoadingByTool.value = {}
  workflowCreateModalOpen.value = true
  void loadWorkflowConfiguredCliTools(businessLineId).then(() => preloadWorkflowNodeConfigs())
}

const openWorkflowEditModal = (template: WorkflowTemplate) => {
  if (!canAccessWorkflow.value) {
    message.error('当前账号暂无项目工作流管理权限')
    return
  }

  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    return
  }

  workflowTemplateModalMode.value = 'edit'
  editingWorkflowTemplateId.value = template.id
  workflowValidationMessage.value = ''
  workflowCreateForm.value = {
    name: template.name,
    description: template.description ?? '',
    nodes: buildWorkflowFormNodesFromTemplate(template),
  }
  workflowEditorActiveNodeIndex.value = 0
  workflowNodeConfigLoadingByTool.value = {}
  workflowCreateModalOpen.value = true
  void loadWorkflowConfiguredCliTools(businessLineId).then(() => preloadWorkflowNodeConfigs())
}

const closeWorkflowCreateModal = () => {
  workflowCreateModalOpen.value = false
  workflowTemplateModalMode.value = 'create'
  editingWorkflowTemplateId.value = ''
  resetWorkflowCreateForm()
}

const addWorkflowCreateNode = () => {
  workflowCreateForm.value.nodes.push(buildWorkflowNode(workflowCreateForm.value.nodes.length + 1))
  workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
  workflowEditorActiveNodeIndex.value = workflowCreateForm.value.nodes.length - 1
}

const removeWorkflowCreateNode = (index: number) => {
  if (workflowCreateForm.value.nodes.length <= 1) {
    return
  }

  workflowCreateForm.value.nodes.splice(index, 1)
  workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
  syncWorkflowEditorActiveNodeIndex(
    workflowEditorActiveNodeIndex.value > index ? workflowEditorActiveNodeIndex.value - 1 : index,
  )
}

const closeWorkflowAddMenu = () => {
  workflowAddMenuOpen.value = false
}

const toggleWorkflowAddMenu = () => {
  workflowAddMenuOpen.value = !workflowAddMenuOpen.value
}

const setWorkflowAddMenuAnchorEl = (el: Element | ComponentPublicInstance | null) => {
  if (el == null) {
    workflowAddMenuAnchorRef.value = null
    return
  }
  const node = el instanceof HTMLElement ? el : (el as ComponentPublicInstance).$el
  workflowAddMenuAnchorRef.value = node instanceof HTMLElement ? node : null
}

const onDocumentPointerDown = (event: PointerEvent) => {
  if (!workflowAddMenuOpen.value) {
    return
  }

  const eventTarget = event.target
  if (!(eventTarget instanceof Node)) {
    return
  }

  if (workflowAddMenuAnchorRef.value?.contains(eventTarget)) {
    return
  }

  closeWorkflowAddMenu()
}

const loadBusinessLineWorkflowTemplates = async (businessLineId: string) => {
  if (!businessLineId) {
    businessLineWorkflowTemplates.value = []
    return
  }

  loadingBusinessLineWorkflowTemplates.value = true
  copyWorkflowErrorMessage.value = ''

  try {
    const templates = await fetchAllPages((page, limit) =>
      workflowApi.list({
        page,
        limit,
        scope: 'business_line',
        businessLineId,
      }),
    )
    if (businessLineId !== project.value?.businessLineId) {
      return
    }

    businessLineWorkflowTemplates.value = templates
  } catch (error) {
    if (businessLineId === project.value?.businessLineId) {
      businessLineWorkflowTemplates.value = []
      copyWorkflowErrorMessage.value = toErrorMessage(error, '加载业务线工作流模板失败')
    }
  } finally {
    if (businessLineId === project.value?.businessLineId) {
      loadingBusinessLineWorkflowTemplates.value = false
    }
  }
}

const closeWorkflowCopyModal = () => {
  copyingBusinessLineWorkflowTemplateId.value = ''
  copyWorkflowErrorMessage.value = ''
  workflowCopyModalOpen.value = false
}

const openWorkflowCopyModal = async () => {
  if (!canAccessWorkflow.value) {
    message.error('当前账号暂无项目工作流管理权限')
    return
  }

  closeWorkflowAddMenu()
  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    message.error('当前项目未绑定业务线，无法复制模板')
    return
  }

  workflowCopyKeyword.value = ''
  copyWorkflowErrorMessage.value = ''
  workflowCopyModalOpen.value = true
  await loadBusinessLineWorkflowTemplates(businessLineId)
}

const cloneWorkflowNodesFromTemplate = (template: WorkflowTemplate): WorkflowTemplateNode[] => {
  if (!template.nodesJson.length) {
    return [buildWorkflowNode(1)]
  }

  return template.nodesJson.map((node, index) => ({
    nodeOrder: node.nodeOrder || index + 1,
    name: node.name || `step-${index + 1}`,
    type: node.type || 'agent',
    requiresApproval: Boolean(node.requiresApproval),
    requiresArtifact: Boolean(node.requiresArtifact),
    input: node.input ? { ...node.input } : undefined,
  }))
}

const buildCopiedWorkflowTemplateName = (sourceName: string) => {
  const baseName = sourceName.trim() || '业务线工作流模板'
  const existingNameSet = new Set(workflowTemplates.value.map((template) => template.name.trim()))

  if (!existingNameSet.has(baseName)) {
    return baseName
  }

  let index = 1
  let nextName = `${baseName}（复制）`

  while (existingNameSet.has(nextName)) {
    index += 1
    nextName = `${baseName}（复制${index}）`
  }

  return nextName
}

const submitCopyBusinessLineWorkflowTemplate = async (template: WorkflowTemplate) => {
  if (!projectId.value) {
    return
  }

  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    message.error('当前项目未绑定业务线，无法复制模板')
    return
  }

  copyingBusinessLineWorkflowTemplateId.value = template.id
  copyWorkflowErrorMessage.value = ''

  try {
    await loadWorkflowConfiguredCliTools(businessLineId)

    const nodesForValidation = cloneWorkflowNodesFromTemplate(template)
    const copyValidationMessage = validateBusinessLineWorkflowTemplateForProjectCopy(
      nodesForValidation,
      {
        configuredCliToolIdSet: workflowConfiguredCliToolIdSet.value,
        configsByTool: workflowNodeConfigsByTool.value,
        hasConfiguredCliTools: workflowConfiguredCliTools.value.length > 0,
      },
    )

    if (copyValidationMessage) {
      copyWorkflowErrorMessage.value = copyValidationMessage
      message.error(copyValidationMessage)
      return
    }

    await workflowApi.create({
      name: buildCopiedWorkflowTemplateName(template.name),
      description: normalizeOptionalText(template.description ?? ''),
      scope: 'project',
      projectId: projectId.value,
      nodes: cloneWorkflowNodesFromTemplate(template),
      isActive: template.isActive,
    })

    closeWorkflowCopyModal()
    await loadWorkflowTemplates(projectId.value)
    message.success(`模板「${template.name}」已复制到当前项目`)
  } catch (error) {
    copyWorkflowErrorMessage.value = toErrorMessage(error, '复制业务线模板失败')
    message.error(copyWorkflowErrorMessage.value)
  } finally {
    copyingBusinessLineWorkflowTemplateId.value = ''
  }
}

const loadWorkflowTemplates = async (targetProjectId: string) => {
  if (!targetProjectId) {
    workflowTemplates.value = []
    return
  }

  loadingWorkflowTemplates.value = true
  workflowValidationMessage.value = ''

  try {
    const templates = await fetchAllPages((page, limit) =>
      workflowApi.list({
        page,
        limit,
        keyword: workflowKeyword.value.trim() || undefined,
        projectId: targetProjectId,
        scope: 'project',
      }),
    )

    if (targetProjectId !== projectId.value) {
      return
    }

    workflowTemplates.value = templates
  } catch (error) {
    if (targetProjectId === projectId.value) {
      workflowTemplates.value = []
      message.error(toErrorMessage(error, '加载项目工作流模板失败'))
    }
  } finally {
    if (targetProjectId === projectId.value) {
      loadingWorkflowTemplates.value = false
    }
  }
}

const submitWorkflowTemplate = async () => {
  if (!canAccessWorkflow.value) {
    message.error('当前账号暂无项目工作流管理权限')
    return
  }

  if (!projectId.value) {
    return
  }

  if (workflowTemplateModalMode.value === 'edit' && !editingWorkflowTemplateId.value) {
    workflowValidationMessage.value = '未找到待编辑模板'
    return
  }

  if (!workflowCreateForm.value.name.trim()) {
    workflowValidationMessage.value = '模板名称不能为空'
    return
  }

  ensureWorkflowCreateNodeShape()
  const nodes = buildWorkflowNodesForSubmit(workflowCreateForm.value.nodes)
  const nodeValidationMessage = validateWorkflowNodes(nodes)

  if (nodeValidationMessage) {
    workflowValidationMessage.value = nodeValidationMessage
    return
  }

  submittingWorkflowTemplate.value = true
  workflowValidationMessage.value = ''

  const requestPayload = {
    name: workflowCreateForm.value.name.trim(),
    description: normalizeOptionalText(workflowCreateForm.value.description),
    nodes,
  }
  const isEditing = workflowTemplateModalMode.value === 'edit'

  try {
    if (isEditing) {
      await workflowApi.update(editingWorkflowTemplateId.value, requestPayload)
      message.success('项目工作流模板更新成功')
    } else {
      await workflowApi.create({
        ...requestPayload,
        scope: 'project',
        projectId: projectId.value,
        isActive: true,
      })
      message.success('项目工作流模板创建成功')
    }

    await loadWorkflowTemplates(projectId.value)
    closeWorkflowCreateModal()
  } catch (error) {
    message.error(
      toErrorMessage(error, isEditing ? '更新项目工作流模板失败' : '创建项目工作流模板失败'),
    )
  } finally {
    submittingWorkflowTemplate.value = false
  }
}

const removeWorkflowTemplate = async (template: WorkflowTemplate) => {
  if (!canAccessWorkflow.value) {
    message.error('当前账号暂无项目工作流管理权限')
    return
  }

  if (template.scope !== 'project') {
    return
  }

  workflowDeleteTarget.value = template
  workflowDeleteConfirmOpen.value = true
}

const setWorkflowDeleteConfirmOpen = (open: boolean) => {
  workflowDeleteConfirmOpen.value = open
  if (!open) {
    workflowDeleteTarget.value = null
  }
}

const confirmRemoveWorkflowTemplate = async () => {
  if (!canAccessWorkflow.value) {
    message.error('当前账号暂无项目工作流管理权限')
    return
  }

  const template = workflowDeleteTarget.value
  if (!template || template.scope !== 'project') {
    return
  }

  workflowTemplateActionId.value = template.id
  try {
    await workflowApi.remove(template.id)
    await loadWorkflowTemplates(projectId.value)
    message.success('模板删除成功')
    setWorkflowDeleteConfirmOpen(false)
  } catch (error) {
    message.error(toErrorMessage(error, '删除模板失败'))
  } finally {
    workflowTemplateActionId.value = ''
  }
}

const openMemberFormModal = () => {
  if (!canManageProjectMembers.value) {
    message.error('当前账号暂无项目成员管理权限')
    return
  }

  validationMessage.value = ''
  newMemberForm.userId = ''
  newMemberForm.roleKey = preferredProjectRoleKey.value
  memberFormModalOpen.value = true
}

const closeMemberFormModal = () => {
  memberFormModalOpen.value = false
  validationMessage.value = ''
}

const openConfigFormModal = () => {
  if (!canUpdateProject.value) {
    message.error('当前账号暂无项目配置权限')
    return
  }

  validationMessage.value = ''
  configFormModalOpen.value = true
}

const closeConfigFormModal = () => {
  configFormModalOpen.value = false
  validationMessage.value = ''
}

const syncConfigForm = (currentProject: Project) => {
  const configJson = (currentProject.configJson ?? {}) as Record<string, unknown>
  const runnerConfig =
    configJson.agentRunner && typeof configJson.agentRunner === 'object'
      ? (configJson.agentRunner as Record<string, unknown>)
      : {}

  configForm.name = currentProject.name
  configForm.description = currentProject.description ?? ''
  configForm.gitUrl = currentProject.gitUrl
  configForm.defaultBranch = currentProject.defaultBranch
  configForm.agentAdapter =
    typeof configJson.agentAdapter === 'string' ? configJson.agentAdapter : 'codex'
  configForm.gitRuntimeEnabled = configJson.gitRuntimeEnabled === true
  configForm.repoLocalPath =
    typeof configJson.repoLocalPath === 'string' ? configJson.repoLocalPath : ''
  configForm.repoCacheBaseDir =
    typeof configJson.repoCacheBaseDir === 'string' ? configJson.repoCacheBaseDir : ''
  configForm.worktreeBaseDir =
    typeof configJson.worktreeBaseDir === 'string' ? configJson.worktreeBaseDir : ''
  configForm.skills = Array.isArray(configJson.allowedSkills)
    ? configJson.allowedSkills.map((item) => String(item)).join(', ')
    : ''
  configForm.mcp = Array.isArray(configJson.allowedMcp)
    ? configJson.allowedMcp.map((item) => String(item)).join(', ')
    : ''
  configForm.maxConcurrency =
    typeof configJson.maxConcurrency === 'number' && configJson.maxConcurrency > 0
      ? String(configJson.maxConcurrency)
      : '2'
  configForm.priority = typeof configJson.priority === 'string' ? configJson.priority : 'normal'
  configForm.runnerCommand = typeof runnerConfig.command === 'string' ? runnerConfig.command : ''
  configForm.runnerArgs = Array.isArray(runnerConfig.args)
    ? runnerConfig.args.map((item) => String(item)).join(', ')
    : ''
  configForm.runnerTimeoutSeconds =
    typeof runnerConfig.timeoutSeconds === 'number' && runnerConfig.timeoutSeconds > 0
      ? String(runnerConfig.timeoutSeconds)
      : '600'
  configForm.subRepos = Array.isArray(configJson.subRepos)
    ? (configJson.subRepos as SubRepoEntry[])
        .filter(
          (r) =>
            r &&
            typeof r === 'object' &&
            typeof r.url === 'string' &&
            typeof r.prefix === 'string' &&
            typeof r.branch === 'string',
        )
        .map((r) => ({ url: r.url, prefix: r.prefix, branch: r.branch }))
    : []
  syncFromContainerRuntime(configJson.containerRuntime)
}

const loadProjectContext = async () => {
  if (!projectId.value) {
    return
  }

  contextLoading.value = true

  try {
    projectContext.value = await projectsApi.context(projectId.value)
  } catch (error) {
    projectContext.value = null
    message.error(toErrorMessage(error, '加载项目上下文失败'))
  } finally {
    contextLoading.value = false
  }
}

const loadUsers = async () => {
  users.value = await fetchAllPages((page, limit) => usersApi.list({ page, limit }))
}

const loadProjectData = async () => {
  if (!projectId.value) {
    return
  }

  loading.value = true
  validationMessage.value = ''

  try {
    await accessStore.loadContext({ projectId: projectId.value })

    const shouldLoadMembers = canManageProjectMembers.value
    const [projectResponse, memberResponse, taskResponse, customRoleResponse] = await Promise.all([
      projectsApi.detail(projectId.value),
      shouldLoadMembers
        ? projectsApi.listMembers(projectId.value)
        : Promise.resolve([] as ProjectMember[]),
      tasksApi.list({ projectId: projectId.value, page: 1, limit: 20 }),
      shouldLoadMembers
        ? projectsApi.listCustomRoles(projectId.value)
        : Promise.resolve([] as ProjectCustomRole[]),
    ])

    project.value = projectResponse
    projectMembers.value = memberResponse
    recentTasks.value = taskResponse.data
    projectCustomRoles.value = customRoleResponse

    memberRoleDrafts.value = memberResponse.reduce<Record<string, string>>((result, member) => {
      result[member.userId] = resolveRoleAssignmentKey(member.roleId, projectRoleOptions.value)
      return result
    }, {})

    if (shouldLoadMembers && users.value.length === 0) {
      void loadUsers().catch((error) => {
        message.error(toErrorMessage(error, '加载用户列表失败'))
      })
    }

    syncConfigForm(projectResponse)
    await loadProjectContext()

    if (canAccessWorkflow.value) {
      await loadWorkflowTemplates(projectResponse.id)
      return
    }

    workflowTemplates.value = []
    businessLineWorkflowTemplates.value = []
    projectCustomRoles.value = shouldLoadMembers ? projectCustomRoles.value : []
    closeWorkflowAddMenu()
    closeWorkflowCopyModal()
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目详情失败'))

    if (error instanceof HttpError && (error.status === 404 || error.status === 403)) {
      localStorage.removeItem(STORAGE_KEYS.lastSelectedProjectId)
      void router.replace({ path: '/dashboard', query: { [SETTINGS_QUERY_KEY]: 'projects' } })
    }
  } finally {
    loading.value = false
  }
}

const createMember = async () => {
  if (!canManageProjectMembers.value) {
    message.error('当前账号暂无项目成员管理权限')
    return
  }

  if (!projectId.value || !newMemberForm.userId.trim()) {
    return
  }

  const normalizedUserId = newMemberForm.userId.trim()
  const duplicatedMember = projectMembers.value.find((member) => member.userId === normalizedUserId)
  if (duplicatedMember) {
    validationMessage.value = '该用户已在当前项目成员列表中'
    return
  }

  creatingMember.value = true
  validationMessage.value = ''

  try {
    const selectedRole = projectRoleOptions.value.find((item) => item.key === newMemberForm.roleKey)
    if (!selectedRole) {
      validationMessage.value = '请选择角色'
      return
    }

    await projectsApi.addMember(projectId.value, {
      userId: normalizedUserId,
      roleId: selectedRole.roleId,
    })

    newMemberForm.userId = ''
    newMemberForm.roleKey = preferredProjectRoleKey.value
    closeMemberFormModal()
    await loadProjectData()
    message.success('添加项目成员成功')
  } catch (error) {
    message.error(toErrorMessage(error, '添加项目成员失败'))
  } finally {
    creatingMember.value = false
  }
}

const updateMemberRole = async (member: ProjectMember) => {
  if (!canManageProjectMembers.value) {
    message.error('当前账号暂无项目成员管理权限')
    return
  }

  if (!projectId.value) {
    return
  }

  const nextRoleKey = memberRoleDrafts.value[member.userId]
  const selectedRole = projectRoleOptions.value.find((item) => item.key === nextRoleKey)
  if (!selectedRole) {
    return
  }

  const currentRoleKey = resolveRoleAssignmentKey(member.roleId, projectRoleOptions.value)
  if (nextRoleKey === currentRoleKey) {
    return
  }

  updatingMemberId.value = member.userId

  try {
    await projectsApi.updateMember(projectId.value, member.userId, {
      roleId: selectedRole.roleId,
    })

    await loadProjectData()
    message.success('更新成员角色成功')
  } catch (error) {
    message.error(toErrorMessage(error, '更新成员角色失败'))
  } finally {
    updatingMemberId.value = null
  }
}

const removeMember = async (member: ProjectMember) => {
  if (!canManageProjectMembers.value) {
    message.error('当前账号暂无项目成员管理权限')
    return
  }

  memberRemoveTarget.value = member
  memberRemoveConfirmOpen.value = true
}

const setMemberRemoveConfirmOpen = (open: boolean) => {
  memberRemoveConfirmOpen.value = open
  if (!open) {
    memberRemoveTarget.value = null
  }
}

const confirmRemoveMember = async () => {
  if (!canManageProjectMembers.value) {
    message.error('当前账号暂无项目成员管理权限')
    return
  }

  const member = memberRemoveTarget.value
  if (!projectId.value || !member) {
    return
  }

  removingMemberId.value = member.userId

  try {
    await projectsApi.removeMember(projectId.value, member.userId)
    await loadProjectData()
    message.success('移除成员成功')
    setMemberRemoveConfirmOpen(false)
  } catch (error) {
    message.error(toErrorMessage(error, '移除成员失败'))
  } finally {
    removingMemberId.value = null
  }
}

const saveConfig = async () => {
  if (!canUpdateProject.value) {
    message.error('当前账号暂无项目配置权限')
    return
  }

  if (!project.value || !projectId.value || !configForm.name.trim()) {
    validationMessage.value = '项目名称不能为空'
    return
  }

  savingConfig.value = true
  validationMessage.value = ''

  try {
    const allowedSkills = configForm.skills
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const allowedMcp = configForm.mcp
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const runnerArgs = configForm.runnerArgs
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const containerRuntimeValidationMessage = validateContainerRuntime()
    if (containerRuntimeValidationMessage) {
      validationMessage.value = containerRuntimeValidationMessage
      return
    }

    const currentConfigJson = isObjectRecord(project.value.configJson)
      ? { ...(project.value.configJson as Record<string, unknown>) }
      : {}
    const configJson: Record<string, unknown> = {
      ...currentConfigJson,
      agentAdapter: configForm.agentAdapter.trim() || 'codex',
      allowedSkills,
      allowedMcp,
      maxConcurrency: Math.max(1, Number(configForm.maxConcurrency) || 1),
      priority: configForm.priority.trim() || 'normal',
      gitRuntimeEnabled: configForm.gitRuntimeEnabled,
      agentRunner: {
        ...(configForm.runnerCommand.trim() ? { command: configForm.runnerCommand.trim() } : {}),
        ...(runnerArgs.length ? { args: runnerArgs } : {}),
        timeoutSeconds: Math.max(5, Number(configForm.runnerTimeoutSeconds) || 600),
      },
    }

    if (configForm.repoLocalPath.trim()) {
      configJson.repoLocalPath = configForm.repoLocalPath.trim()
    } else {
      delete configJson.repoLocalPath
    }

    if (configForm.repoCacheBaseDir.trim()) {
      configJson.repoCacheBaseDir = configForm.repoCacheBaseDir.trim()
    } else {
      delete configJson.repoCacheBaseDir
    }

    if (configForm.worktreeBaseDir.trim()) {
      configJson.worktreeBaseDir = configForm.worktreeBaseDir.trim()
    } else {
      delete configJson.worktreeBaseDir
    }

    const filteredSubRepos = configForm.subRepos
      .filter((r) => r.url.trim() && r.prefix.trim() && r.branch.trim())
      .map((r) => ({
        url: r.url.trim(),
        prefix: r.prefix.trim(),
        branch: r.branch.trim(),
      }))
    if (filteredSubRepos.length > 0) {
      configJson.subRepos = filteredSubRepos
    } else {
      delete configJson.subRepos
    }

    await projectsApi.update(projectId.value, {
      name: configForm.name.trim(),
      description: configForm.description.trim() || undefined,
      configJson: buildContainerRuntimeConfigJson(configJson),
    })

    await loadProjectData()
    closeConfigFormModal()
    message.success('保存项目配置成功')
  } catch (error) {
    message.error(toErrorMessage(error, '保存项目配置失败'))
  } finally {
    savingConfig.value = false
  }
}

watch(
  () => projectId.value,
  () => {
    closeWorkflowAddMenu()
    closeWorkflowCopyModal()
    setWorkflowDeleteConfirmOpen(false)
    setMemberRemoveConfirmOpen(false)
    void loadProjectData()
  },
)

watch(
  () => route.path,
  (path) => {
    if (path === '/projects/workflows' || path.endsWith('/workflows')) {
      tab.value = 'workflow'
    }
  },
)

watch(
  () => workflowAddMenuOpen.value,
  (open) => {
    if (typeof document === 'undefined') {
      return
    }

    if (open) {
      document.addEventListener('pointerdown', onDocumentPointerDown)
      return
    }

    document.removeEventListener('pointerdown', onDocumentPointerDown)
  },
)

watch(
  () => [availableTabs.value, workflowOnlyMode.value] as const,
  ([nextTabs, isWorkflowOnly]) => {
    const routeTab = resolveProjectsDetailRouteTab(route.query.tab)
    if (!isWorkflowOnly && routeTab && nextTabs.includes(routeTab)) {
      tab.value = routeTab
      return
    }

    if (isWorkflowOnly && canAccessWorkflow.value) {
      tab.value = 'workflow'
      return
    }

    if (!nextTabs.includes(tab.value)) {
      tab.value = nextTabs[0] ?? 'overview'
    }
  },
  { immediate: true },
)

onMounted(() => {
  void loadProjectData()
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
  return reactive({
    projectId,
    workflowOnlyMode,
    tab,
    loading,
    validationMessage,
    project,
    projectMembers,
    recentTasks,
    projectContext,
    users,
    contextLoading,
    creatingMember,
    updatingMemberId,
    removingMemberId,
    memberRemoveConfirmOpen,
    memberRemoveTarget,
    savingConfig,
    memberFormModalOpen,
    configFormModalOpen,
    loadingWorkflowTemplates,
    submittingWorkflowTemplate,
    workflowCreateModalOpen,
    workflowTemplateModalMode,
    editingWorkflowTemplateId,
    workflowTemplateActionId,
    workflowDeleteConfirmOpen,
    workflowDeleteTarget,
    workflowValidationMessage,
    workflowTemplates,
    workflowKeyword,
    workflowAddMenuOpen,
    workflowAddMenuAnchorRef,
    setWorkflowAddMenuAnchorEl,
    workflowCopyModalOpen,
    workflowCopyKeyword,
    loadingBusinessLineWorkflowTemplates,
    businessLineWorkflowTemplates,
    copyingBusinessLineWorkflowTemplateId,
    copyWorkflowErrorMessage,
    workflowConfiguredCliTools,
    loadingWorkflowConfiguredCliTools,
    workflowNodeConfigsByTool,
    workflowNodeConfigLoadingByTool,
    workflowEditorActiveNodeIndex,
    workflowCreateForm,
    memberRoleDrafts,
    newMemberForm,
    configForm,
    containerEnvSummary,
    containerServiceSummary,
    formatDate,
    statusLabelMap,
    statusClassMap,
    contextSourceLabelMap,
    formatContextLength,
    tabClass,
    runningTaskCount,
    doneTaskCount,
    workflowTemplateModalTitle,
    activeWorkflowCreateNode,
    workflowTemplateSubmitIdleText,
    workflowTemplateSubmitLoadingText,
    canManageProjectMembers,
    projectRoleSelectOptions,
    canAccessWorkflow,
    canUpdateProject,
    workflowCliToolSelectOptions,
    filteredBusinessLineWorkflowTemplates,
    displayUserName,
    displayUserMeta,
    formatWorkflowNodeTabLabel,
    loadWorkflowTemplates,
    getWorkflowNodeConfigSelectOptions,
    isWorkflowNodeConfigLoading,
    handleWorkflowNodeCliToolChange,
    openWorkflowCreateModal,
    openWorkflowEditModal,
    closeWorkflowCreateModal,
    addWorkflowCreateNode,
    removeWorkflowCreateNode,
    toggleWorkflowAddMenu,
    openWorkflowCopyModal,
    closeWorkflowCopyModal,
    submitCopyBusinessLineWorkflowTemplate,
    submitWorkflowTemplate,
    removeWorkflowTemplate,
    setWorkflowDeleteConfirmOpen,
    confirmRemoveWorkflowTemplate,
    openMemberFormModal,
    closeMemberFormModal,
    openConfigFormModal,
    closeConfigFormModal,
    loadProjectContext,
    createMember,
    updateMemberRole,
    removeMember,
    setMemberRemoveConfirmOpen,
    confirmRemoveMember,
    saveConfig,
    PROJECT_WORKFLOW_SELECT_PANEL_Z_INDEX,
  })
}
