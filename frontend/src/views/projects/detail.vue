<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { usersApi } from '@/api/users'
import { workflowApi } from '@/api/workflow'
import type { ProjectContext } from '@/types/api/project-context'
import type { Project, ProjectMember } from '@/types/api/projects'
import type { Task } from '@/types/api/tasks'
import type { User } from '@/types/api/users'
import type {
  WorkflowTemplate,
  WorkflowTemplateNode,
  WorkflowTemplateNodeInput,
} from '@/types/api/workflow'
import ConfirmActionModal from '@/components/business/settings/modals/ConfirmActionModal.vue'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

defineOptions({
  name: 'ProjectsDetailView',
})

type SupportedCliToolId = 'claude-code' | 'codex' | 'gemini-cli' | 'cursor-agent' | 'opencode'
type WorkflowTemplateNodeInputForm = {
  prompt: string
  cliToolId: SupportedCliToolId | ''
  agentToolConfigId: string
}
type WorkflowTemplateNodeForm = Omit<WorkflowTemplateNode, 'input'> & {
  input: WorkflowTemplateNodeInputForm
}

const SUPPORTED_CLI_TOOLS: Array<{ id: SupportedCliToolId; label: string }> = [
  { id: 'cursor-agent', label: 'Cursor Agent' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'opencode', label: 'Opencode' },
]

const route = useRoute()
const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const projectId = computed(() => {
  const projectIdFromParams = normalizeRouteParam(route.params.id)
  if (projectIdFromParams) {
    return projectIdFromParams
  }

  return normalizeRouteParam(route.query.projectId)
})

type TabKey = 'overview' | 'context' | 'members' | 'workflow' | 'config'
const workflowOnlyMode = computed(() => {
  return route.path === '/projects/workflows' || route.path.endsWith('/workflows')
})

const resolveInitialTab = (): TabKey => {
  if (workflowOnlyMode.value) {
    return 'workflow'
  }

  return 'overview'
}

const tab = ref<TabKey>(resolveInitialTab())

const loading = ref(false)
const validationMessage = ref('')
const message = useMessage()

const project = ref<Project | null>(null)
const projectMembers = ref<ProjectMember[]>([])
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
const workflowConfiguredCliTools = ref<Array<{ id: SupportedCliToolId; label: string }>>([])
const loadingWorkflowConfiguredCliTools = ref(false)
const workflowNodeConfigsByTool = ref<Partial<Record<SupportedCliToolId, AgentToolConfig[]>>>({})
const workflowNodeConfigLoadingByTool = ref<Partial<Record<SupportedCliToolId, boolean>>>({})
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
      input: {
        prompt: '',
        cliToolId: '',
        agentToolConfigId: '',
      },
    },
  ],
})

const memberRoleDrafts = ref<Record<string, ProjectMember['role']>>({})

const newMemberForm = reactive({
  userId: '',
  role: 'developer' as ProjectMember['role'],
})

const configForm = reactive({
  name: '',
  description: '',
  gitUrl: '',
  defaultBranch: 'main',
  agentAdapter: 'codex',
  agentRunnerEnabled: false,
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

const workflowTemplateSubmitIdleText = computed(() => {
  return workflowTemplateModalMode.value === 'edit' ? '保存修改' : '创建模板'
})

const workflowTemplateSubmitLoadingText = computed(() => {
  return workflowTemplateModalMode.value === 'edit' ? '保存中...' : '创建中...'
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

const isSupportedCliToolId = (toolId: string): toolId is SupportedCliToolId => {
  return SUPPORTED_CLI_TOOLS.some((tool) => tool.id === toolId)
}

const createEmptyWorkflowNodeInput = (): WorkflowTemplateNodeInputForm => ({
  prompt: '',
  cliToolId: '',
  agentToolConfigId: '',
})

const normalizeWorkflowNodeInput = (
  input: WorkflowTemplateNodeInput | WorkflowTemplateNodeInputForm | undefined,
): WorkflowTemplateNodeInputForm => {
  if (!input || typeof input !== 'object') {
    return createEmptyWorkflowNodeInput()
  }

  const prompt =
    typeof input.prompt === 'string'
      ? input.prompt
      : ''
  const cliToolId =
    typeof input.cliToolId === 'string' && isSupportedCliToolId(input.cliToolId)
      ? input.cliToolId
      : ''
  const agentToolConfigId =
    typeof input.agentToolConfigId === 'string'
      ? input.agentToolConfigId
      : ''

  return {
    prompt,
    cliToolId,
    agentToolConfigId,
  }
}

const resolveWorkflowNodeInputByContext = (
  input: WorkflowTemplateNodeInput | WorkflowTemplateNodeInputForm | undefined,
  configuredTools: Array<{ id: SupportedCliToolId; label: string }>,
  configsByTool: Partial<Record<SupportedCliToolId, AgentToolConfig[]>>,
): WorkflowTemplateNodeInputForm => {
  if (configuredTools.length === 0) {
    return {
      ...normalizeWorkflowNodeInput(input),
      cliToolId: '',
      agentToolConfigId: '',
    }
  }

  const nextInput = normalizeWorkflowNodeInput(input)
  const allowedToolIds = new Set(configuredTools.map((tool) => tool.id))
  const fallbackToolId = configuredTools[0]?.id ?? ''
  const cliToolId =
    nextInput.cliToolId && allowedToolIds.has(nextInput.cliToolId)
      ? nextInput.cliToolId
      : fallbackToolId

  if (!cliToolId) {
    return {
      ...nextInput,
      cliToolId: '',
      agentToolConfigId: '',
    }
  }

  const toolConfigs = configsByTool[cliToolId] ?? []
  const hasSelectedConfig = toolConfigs.some((config) => config.id === nextInput.agentToolConfigId)
  const preferredConfigId =
    toolConfigs.find((config) => config.isDefault)?.id ?? toolConfigs[0]?.id ?? ''

  return {
    ...nextInput,
    cliToolId,
    agentToolConfigId: hasSelectedConfig ? nextInput.agentToolConfigId : preferredConfigId,
  }
}

const resolveWorkflowNodeInput = (
  input: WorkflowTemplateNodeInput | WorkflowTemplateNodeInputForm | undefined,
): WorkflowTemplateNodeInputForm => {
  return resolveWorkflowNodeInputByContext(
    input,
    workflowConfiguredCliTools.value,
    workflowNodeConfigsByTool.value,
  )
}

const buildWorkflowNode = (nodeOrder: number): WorkflowTemplateNodeForm => ({
  nodeOrder,
  name: `step-${nodeOrder}`,
  type: 'agent',
  requiresApproval: false,
  input: resolveWorkflowNodeInput(createEmptyWorkflowNodeInput()),
})

const normalizeWorkflowNodes = (nodes: WorkflowTemplateNodeForm[]) => {
  return [...nodes]
    .sort((left, right) => left.nodeOrder - right.nodeOrder)
    .map((node, index) => ({
      ...node,
      nodeOrder: index + 1,
      name: node.name.trim() || `step-${index + 1}`,
      requiresApproval: Boolean(node.requiresApproval),
      input: normalizeWorkflowNodeInput(node.input),
    }))
}

const serializeWorkflowNodeInput = (
  input: WorkflowTemplateNodeInputForm,
): WorkflowTemplateNodeInput | undefined => {
  const normalizedPrompt = input.prompt.trim()
  const normalizedConfigId = input.agentToolConfigId.trim()
  const payload: WorkflowTemplateNodeInput = {}

  if (normalizedPrompt) {
    payload.prompt = normalizedPrompt
  }

  if (input.cliToolId) {
    payload.cliToolId = input.cliToolId
    if (normalizedConfigId) {
      payload.agentToolConfigId = normalizedConfigId
    }
  }

  return Object.keys(payload).length > 0 ? payload : undefined
}

const buildWorkflowNodesForSubmit = (nodes: WorkflowTemplateNodeForm[]): WorkflowTemplateNode[] => {
  return normalizeWorkflowNodes(nodes).map((node) => ({
    ...node,
    input: serializeWorkflowNodeInput(node.input),
  }))
}

const validateWorkflowNodes = (nodes: WorkflowTemplateNode[]) => {
  if (nodes.length === 0) {
    return '至少需要一个节点'
  }

  if (workflowConfiguredCliTools.value.length === 0) {
    return '当前业务线暂无已配置 Agent CLI，请先在业务线设置中配置'
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || !node.name.trim()) {
      return `节点 #${index + 1} 名称不能为空`
    }

    const nodeInput = normalizeWorkflowNodeInput(node.input)
    if (!nodeInput.cliToolId) {
      return `节点 #${index + 1} 请选择 Agent CLI`
    }

    if (!workflowConfiguredCliToolIdSet.value.has(nodeInput.cliToolId)) {
      return `节点 #${index + 1} 的 Agent CLI 不可用，请重新选择`
    }
  }

  return ''
}

const ensureWorkflowCreateNodeShape = () => {
  if (workflowCreateForm.value.nodes.length === 0) {
    workflowCreateForm.value.nodes = [buildWorkflowNode(1)]
  }

  workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
}

const resetWorkflowCreateForm = () => {
  workflowValidationMessage.value = ''
  workflowCreateForm.value = {
    name: '',
    description: '',
    nodes: [buildWorkflowNode(1)],
  }
}

const buildWorkflowFormNodesFromTemplate = (template: WorkflowTemplate): WorkflowTemplateNodeForm[] => {
  const sourceNodes = template.nodesJson.length > 0 ? template.nodesJson : [buildWorkflowNode(1)]

  return normalizeWorkflowNodes(
    sourceNodes.map((node, index) => ({
      nodeOrder: node.nodeOrder || index + 1,
      name: node.name || `step-${index + 1}`,
      type: node.type || 'agent',
      requiresApproval: Boolean(node.requiresApproval),
      input: normalizeWorkflowNodeInput(node.input),
    })),
  )
}

const loadWorkflowConfiguredCliTools = async (businessLineId: string) => {
  if (!businessLineId) {
    workflowConfiguredCliTools.value = []
    workflowNodeConfigsByTool.value = {}
    return
  }

  loadingWorkflowConfiguredCliTools.value = true

  try {
    const configs = await businessLinesApi.listAgentToolConfigs(businessLineId)
    if (businessLineId !== project.value?.businessLineId) {
      return
    }

    const groupedConfigs: Partial<Record<SupportedCliToolId, AgentToolConfig[]>> = {}
    for (const config of configs) {
      if (!isSupportedCliToolId(config.toolId)) {
        continue
      }

      groupedConfigs[config.toolId] = [...(groupedConfigs[config.toolId] ?? []), config]
    }

    const configuredTools = SUPPORTED_CLI_TOOLS.filter((tool) => Boolean(groupedConfigs[tool.id]?.length))
    workflowNodeConfigsByTool.value = groupedConfigs
    workflowConfiguredCliTools.value = configuredTools
    workflowCreateForm.value.nodes = normalizeWorkflowNodes(
      workflowCreateForm.value.nodes.map((node) => ({
        ...node,
        input: resolveWorkflowNodeInputByContext(node.input, configuredTools, groupedConfigs),
      })),
    )
  } catch (error) {
    if (businessLineId === project.value?.businessLineId) {
      workflowConfiguredCliTools.value = []
      workflowNodeConfigsByTool.value = {}
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
  toolId: SupportedCliToolId,
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

const getWorkflowNodeConfigs = (toolId: SupportedCliToolId | '') => {
  if (!toolId) {
    return []
  }

  return workflowNodeConfigsByTool.value[toolId] ?? []
}

const isWorkflowNodeConfigLoading = (toolId: SupportedCliToolId | '') => {
  if (!toolId) {
    return false
  }

  return Boolean(workflowNodeConfigLoadingByTool.value[toolId])
}

const handleWorkflowNodeCliToolChange = async (node: WorkflowTemplateNodeForm) => {
  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    node.input = resolveWorkflowNodeInput(node.input)
    return
  }

  if (!node.input.cliToolId || !workflowConfiguredCliToolIdSet.value.has(node.input.cliToolId)) {
    node.input = resolveWorkflowNodeInput(node.input)
    return
  }

  const selectedToolId = node.input.cliToolId
  node.input.agentToolConfigId = ''

  const configs = await loadWorkflowNodeConfigs(businessLineId, selectedToolId)
  if (node.input.cliToolId !== selectedToolId) {
    return
  }

  const preferredConfigId = configs.find((config) => config.isDefault)?.id ?? configs[0]?.id ?? ''
  node.input.agentToolConfigId = preferredConfigId
}

const preloadWorkflowNodeConfigs = async () => {
  const businessLineId = project.value?.businessLineId
  if (!businessLineId) {
    return
  }

  const toolIds = Array.from(
    new Set(
      workflowCreateForm.value.nodes
        .map((node) => node.input.cliToolId)
        .filter((toolId): toolId is SupportedCliToolId => Boolean(toolId)),
    ),
  )

  await Promise.all(toolIds.map((toolId) => loadWorkflowNodeConfigs(businessLineId, toolId)))
}

const openWorkflowCreateModal = () => {
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
}

const removeWorkflowCreateNode = (index: number) => {
  if (workflowCreateForm.value.nodes.length <= 1) {
    return
  }

  workflowCreateForm.value.nodes.splice(index, 1)
  workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
}

const closeWorkflowAddMenu = () => {
  workflowAddMenuOpen.value = false
}

const toggleWorkflowAddMenu = () => {
  workflowAddMenuOpen.value = !workflowAddMenuOpen.value
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

  copyingBusinessLineWorkflowTemplateId.value = template.id
  copyWorkflowErrorMessage.value = ''

  try {
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
    message.error(toErrorMessage(error, isEditing ? '更新项目工作流模板失败' : '创建项目工作流模板失败'))
  } finally {
    submittingWorkflowTemplate.value = false
  }
}

const removeWorkflowTemplate = async (template: WorkflowTemplate) => {
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
  validationMessage.value = ''
  memberFormModalOpen.value = true
}

const closeMemberFormModal = () => {
  memberFormModalOpen.value = false
  validationMessage.value = ''
}

const openConfigFormModal = () => {
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
  configForm.agentAdapter = typeof configJson.agentAdapter === 'string' ? configJson.agentAdapter : 'codex'
  configForm.agentRunnerEnabled = configJson.agentRunnerEnabled === true
  configForm.gitRuntimeEnabled = configJson.gitRuntimeEnabled === true
  configForm.repoLocalPath = typeof configJson.repoLocalPath === 'string' ? configJson.repoLocalPath : ''
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
    const [projectResponse, memberResponse, taskResponse] = await Promise.all([
      projectsApi.detail(projectId.value),
      projectsApi.listMembers(projectId.value),
      tasksApi.list({ projectId: projectId.value, page: 1, limit: 20 }),
    ])

    project.value = projectResponse
    projectMembers.value = memberResponse
    recentTasks.value = taskResponse.data

    memberRoleDrafts.value = memberResponse.reduce<Record<string, ProjectMember['role']>>((result, member) => {
      result[member.userId] = member.role
      return result
    }, {})

    syncConfigForm(projectResponse)
    await Promise.all([
      loadProjectContext(),
      loadWorkflowTemplates(projectResponse.id),
    ])
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目详情失败'))
  } finally {
    loading.value = false
  }
}

const createMember = async () => {
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
    await projectsApi.addMember(projectId.value, {
      userId: normalizedUserId,
      role: newMemberForm.role,
    })

    newMemberForm.userId = ''
    newMemberForm.role = 'developer'
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
  if (!projectId.value) {
    return
  }

  const nextRole = memberRoleDrafts.value[member.userId]
  if (!nextRole || nextRole === member.role) {
    return
  }

  updatingMemberId.value = member.userId

  try {
    await projectsApi.updateMember(projectId.value, member.userId, {
      role: nextRole,
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
  if (!project.value || !projectId.value || !configForm.name.trim() || !configForm.gitUrl.trim()) {
    validationMessage.value = '项目名称和仓库地址不能为空'
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

    const configJson: Record<string, unknown> = {
      agentAdapter: configForm.agentAdapter.trim() || 'codex',
      allowedSkills,
      allowedMcp,
      maxConcurrency: Math.max(1, Number(configForm.maxConcurrency) || 1),
      priority: configForm.priority.trim() || 'normal',
      agentRunnerEnabled: configForm.agentRunnerEnabled,
      gitRuntimeEnabled: configForm.gitRuntimeEnabled,
      ...(configForm.repoLocalPath.trim() ? { repoLocalPath: configForm.repoLocalPath.trim() } : {}),
      ...(configForm.repoCacheBaseDir.trim()
        ? { repoCacheBaseDir: configForm.repoCacheBaseDir.trim() }
        : {}),
      ...(configForm.worktreeBaseDir.trim() ? { worktreeBaseDir: configForm.worktreeBaseDir.trim() } : {}),
      agentRunner: {
        ...(configForm.runnerCommand.trim() ? { command: configForm.runnerCommand.trim() } : {}),
        ...(runnerArgs.length ? { args: runnerArgs } : {}),
        timeoutSeconds: Math.max(5, Number(configForm.runnerTimeoutSeconds) || 600),
      },
    }

    await projectsApi.update(projectId.value, {
      name: configForm.name.trim(),
      description: configForm.description.trim() || undefined,
      gitUrl: configForm.gitUrl.trim(),
      defaultBranch: configForm.defaultBranch.trim() || 'main',
      configJson,
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

onMounted(() => {
  void loadProjectData()
  void loadUsers().catch((error) => {
    message.error(toErrorMessage(error, '加载用户列表失败'))
  })
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section v-if="!workflowOnlyMode" class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <RouterLink to="/projects" class="hover:text-foreground hover:underline">项目列表</RouterLink>
        <span>/</span>
        <span class="font-mono">{{ projectId }}</span>
      </div>

      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-1">
          <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">{{ project?.name ?? '项目详情' }}</h1>
          <p class="text-sm text-muted-foreground">
            <span class="font-mono text-xs">{{ project?.gitUrl ?? '-' }}</span>
            <span class="mx-2">•</span>
            <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
              {{ project?.defaultBranch ?? '-' }}
            </span>
            <span class="mx-2">•</span>
            <span>更新于 {{ formatDate(project?.updatedAt) }}</span>
          </p>
        </div>

      </div>

    </section>

    <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>

    <section v-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <template v-else-if="project">
      <section v-if="!workflowOnlyMode" class="panel-card flex flex-wrap gap-2 p-2">
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('overview')"
          type="button"
          @click="tab = 'overview'"
        >
          概览
        </button>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('context')"
          type="button"
          @click="tab = 'context'"
        >
          项目上下文
        </button>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('members')"
          type="button"
          @click="tab = 'members'"
        >
          成员管理
        </button>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('workflow')"
          type="button"
          @click="tab = 'workflow'"
        >
          工作流
        </button>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="tabClass('config')"
          type="button"
          @click="tab = 'config'"
        >
          项目配置
        </button>
      </section>

      <section v-if="!workflowOnlyMode && tab === 'overview'" class="space-y-6">
        <div class="grid gap-4 md:grid-cols-3">
          <div class="panel-card p-4">
            <p class="text-xs text-muted-foreground">任务总数</p>
            <p class="mt-2 text-2xl font-semibold">{{ recentTasks.length }}</p>
          </div>
          <div class="panel-card p-4">
            <p class="text-xs text-muted-foreground">执行中</p>
            <p class="mt-2 text-2xl font-semibold">{{ runningTaskCount }}</p>
          </div>
          <div class="panel-card p-4">
            <p class="text-xs text-muted-foreground">已完成</p>
            <p class="mt-2 text-2xl font-semibold">{{ doneTaskCount }}</p>
          </div>
        </div>

        <div class="panel-card p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold">最近任务</p>
              <p class="text-xs text-muted-foreground">按任务状态快速查看执行进度</p>
            </div>
            <RouterLink
              :to="`/tasks?projectId=${project.id}`"
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            >
              查看全部
            </RouterLink>
          </div>

          <div class="mt-4 space-y-2">
            <RouterLink
              v-for="task in recentTasks"
              :key="task.id"
              :to="{
                name: 'task-detail',
                params: { id: task.id },
                query: { projectId: task.projectId || project?.id || '' },
              }"
              class="flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 hover:bg-background"
            >
              <div>
                <p class="font-semibold">{{ task.title }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ task.id }} · {{ formatDate(task.updatedAt) }}</p>
              </div>
              <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="statusClassMap[task.status]">
                {{ statusLabelMap[task.status] }}
              </span>
            </RouterLink>

            <div v-if="recentTasks.length === 0" class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              暂无任务，点击右上角“新建任务”开始。
            </div>
          </div>
        </div>
      </section>


      <section v-else-if="!workflowOnlyMode && tab === 'context'" class="space-y-4">
        <div class="panel-card p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">项目上下文</p>
              <p class="mt-1 text-xs text-muted-foreground">自动读取 README / docs / spec 目录内容，供任务执行时参考。</p>
            </div>
            <button
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="contextLoading"
              type="button"
              @click="loadProjectContext"
            >
              {{ contextLoading ? '刷新中...' : '刷新上下文' }}
            </button>
          </div>

          <div v-if="contextLoading" class="mt-4 text-sm text-muted-foreground">上下文加载中...</div>

          <template v-else-if="projectContext">
            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
                <p class="text-xs text-muted-foreground">来源</p>
                <p class="mt-1 text-sm font-semibold">{{ contextSourceLabelMap[projectContext.source] }}</p>
              </div>
              <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
                <p class="text-xs text-muted-foreground">文档数量</p>
                <p class="mt-1 text-sm font-semibold">{{ projectContext.documents.length }}</p>
              </div>
              <div class="rounded-lg border border-border bg-background/70 px-4 py-3">
                <p class="text-xs text-muted-foreground">快照时间</p>
                <p class="mt-1 text-sm font-semibold">{{ formatDate(projectContext.generatedAt) }}</p>
              </div>
            </div>

            <div
              v-if="projectContext.warnings.length > 0"
              class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-300"
            >
              <p class="text-xs font-semibold uppercase tracking-wide">读取提示</p>
              <ul class="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li v-for="warning in projectContext.warnings" :key="warning">{{ warning }}</li>
              </ul>
            </div>

            <div class="mt-4 space-y-3">
              <article
                v-for="document in projectContext.documents"
                :key="document.path"
                class="rounded-xl border border-border bg-background/70 px-4 py-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold">{{ document.title }}</p>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ document.path }}</p>
                  </div>
                  <span class="text-xs text-muted-foreground">{{ formatContextLength(document.length) }}</span>
                </div>

                <pre class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">{{ document.preview }}</pre>
              </article>

              <div
                v-if="projectContext.documents.length === 0"
                class="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground"
              >
                当前没有可展示的上下文文档。
              </div>
            </div>
          </template>
        </div>
      </section>

      <section v-else-if="!workflowOnlyMode && tab === 'members'" class="space-y-4">
        <div class="panel-card p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">成员管理</p>
              <p class="mt-1 text-xs text-muted-foreground">
                新增成员已迁移为弹窗表单，支持输入用户 ID 或从已加载用户列表中选择。
              </p>
            </div>
            <button
              class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              type="button"
              @click="openMemberFormModal"
            >
              添加成员
            </button>
          </div>
        </div>

        <div class="panel-card overflow-hidden">
          <table class="w-full min-w-[680px] text-left text-sm">
            <thead class="border-b border-border bg-background/60">
              <tr class="text-xs font-semibold text-muted-foreground">
                <th class="px-5 py-3">用户</th>
                <th class="px-5 py-3">角色</th>
                <th class="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="member in projectMembers" :key="member.id" class="transition hover:bg-background/70">
                <td class="px-5 py-4">
                  <p class="text-sm font-semibold">{{ displayUserName(member.userId) }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ displayUserMeta(member.userId) }}</p>
                  <p class="mt-1 font-mono text-[11px] text-muted-foreground">{{ member.userId }}</p>
                </td>
                <td class="px-5 py-4">
                  <select
                    v-model="memberRoleDrafts[member.userId]"
                    class="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="owner">owner</option>
                    <option value="maintainer">maintainer</option>
                    <option value="developer">developer</option>
                    <option value="viewer">viewer</option>
                  </select>
                </td>
                <td class="px-5 py-4">
                  <div class="flex justify-end gap-2">
                    <button
                      class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="updatingMemberId === member.userId"
                      type="button"
                      @click="updateMemberRole(member)"
                    >
                      {{ updatingMemberId === member.userId ? '保存中...' : '保存角色' }}
                    </button>
                    <button
                      class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="removingMemberId === member.userId"
                      type="button"
                      @click="removeMember(member)"
                    >
                      {{ removingMemberId === member.userId ? '移除中...' : '移除' }}
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="projectMembers.length === 0">
                <td class="px-5 py-6 text-sm text-muted-foreground" colspan="3">暂无成员，请先添加。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="workflowOnlyMode || tab === 'workflow'" class="space-y-4">
        <article class="panel-card p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-1 flex-wrap items-center gap-2">
              <input
                v-model="workflowKeyword"
                class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="搜索名称 / 描述"
                type="search"
                @keydown.enter.prevent="loadWorkflowTemplates(projectId)"
              />
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
                :disabled="!projectId || loadingWorkflowTemplates"
                @click="loadWorkflowTemplates(projectId)"
              >
                刷新
              </button>
              <button
                type="button"
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!projectId || loadingWorkflowTemplates"
                @click="loadWorkflowTemplates(projectId)"
              >
                搜索
              </button>
              <div ref="workflowAddMenuAnchorRef" class="relative">
                <button
                  type="button"
                  class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="!projectId"
                  @click="toggleWorkflowAddMenu"
                >
                  添加工作流
                </button>

                <div
                  v-if="workflowAddMenuOpen"
                  class="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-border bg-background p-1 shadow-lg"
                >
                  <button
                    type="button"
                    class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                    @click="void openWorkflowCopyModal()"
                  >
                    从业务线复制
                  </button>
                  <button
                    type="button"
                    class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                    @click="openWorkflowCreateModal"
                  >
                    新建工作流
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article class="panel-card p-5">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">工作流列表</p>
              <p class="mt-1 text-xs text-muted-foreground">仅展示当前项目工作流模板，支持增删改查。</p>
            </div>
            <span class="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              {{ workflowTemplates.length }} 项
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] table-fixed text-left text-sm">
              <thead class="border-b border-border bg-background/70">
                <tr class="text-xs font-semibold text-muted-foreground">
                  <th class="px-3 py-2">模板</th>
                  <th class="w-20 px-3 py-2 whitespace-nowrap">节点数</th>
                  <th class="w-44 px-3 py-2 text-right whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr
                  v-for="template in workflowTemplates"
                  :key="template.id"
                  class="transition hover:bg-background/70"
                >
                  <td class="px-3 py-2">
                    <div class="text-left">
                      <p class="truncate font-semibold">{{ template.name }}</p>
                      <p class="mt-0.5 truncate text-xs text-muted-foreground">
                        {{ template.description || '暂无描述' }}
                      </p>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {{ template.nodesJson.length }}
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex justify-end gap-2">
                      <button
                        type="button"
                        class="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="workflowTemplateActionId === template.id"
                        @click="openWorkflowEditModal(template)"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="workflowTemplateActionId === template.id"
                        @click="removeWorkflowTemplate(template)"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!loadingWorkflowTemplates && workflowTemplates.length === 0">
                  <td colspan="3" class="px-3 py-4 text-sm text-muted-foreground">
                    当前项目暂无自定义模板，请先创建。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section v-else class="space-y-4">
        <div class="panel-card p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">项目配置</p>
              <p class="mt-1 text-xs text-muted-foreground">
                配置编辑已迁移为弹窗表单，避免在页面中直接展示创建和编辑区域。
              </p>
            </div>
            <button
              class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              type="button"
              @click="openConfigFormModal"
            >
              编辑配置
            </button>
          </div>

          <dl class="mt-4 grid gap-3 rounded-xl border border-border bg-background/70 p-4 text-xs md:grid-cols-2">
            <div>
              <dt class="text-muted-foreground">项目名称</dt>
              <dd class="mt-1 font-semibold text-foreground">{{ configForm.name || '-' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">默认分支</dt>
              <dd class="mt-1 text-foreground">{{ configForm.defaultBranch || '-' }}</dd>
            </div>
            <div class="md:col-span-2">
              <dt class="text-muted-foreground">仓库地址</dt>
              <dd class="mt-1 break-all text-foreground">{{ configForm.gitUrl || '-' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Agent 执行器</dt>
              <dd class="mt-1 text-foreground">{{ configForm.agentAdapter || '-' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">并发上限</dt>
              <dd class="mt-1 text-foreground">{{ configForm.maxConcurrency || '-' }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </template>

    <section v-else class="panel-card p-5 text-sm text-muted-foreground">
      请先在左侧选择项目后查看工作流。
    </section>

    <ConfirmActionModal
      :open="workflowDeleteConfirmOpen"
      title="删除工作流模板"
      :description="`确认删除模板「${workflowDeleteTarget?.name ?? ''}」吗？`"
      confirm-text="删除"
      :confirming="workflowTemplateActionId === (workflowDeleteTarget?.id ?? '')"
      @update:open="setWorkflowDeleteConfirmOpen"
      @confirm="confirmRemoveWorkflowTemplate"
    />

    <ConfirmActionModal
      :open="memberRemoveConfirmOpen"
      title="移除项目成员"
      :description="`确认移除成员 ${memberRemoveTarget?.userId ?? ''} 吗？`"
      confirm-text="移除"
      :confirming="removingMemberId === (memberRemoveTarget?.userId ?? '')"
      @update:open="setMemberRemoveConfirmOpen"
      @confirm="confirmRemoveMember"
    />

    <Teleport to="body">
      <div
        v-if="workflowCreateModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-workflow-create-modal-title"
        @click.self="closeWorkflowCreateModal"
      >
        <section class="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-workflow-create-modal-title" class="text-sm font-semibold">
              {{ workflowTemplateModalTitle }}
            </h2>
            <button
              type="button"
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              aria-label="关闭工作流模板弹窗"
              @click="closeWorkflowCreateModal"
            >
              关闭
            </button>
          </header>

          <form class="max-h-[calc(92vh-56px)] space-y-4 overflow-auto px-4 py-4" @submit.prevent="submitWorkflowTemplate">
            <section class="space-y-3 rounded-xl border border-border bg-background/60 p-3">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">模板信息</p>
                <p class="mt-1 text-[11px] text-muted-foreground">
                  可配置当前项目的工作流模板。
                </p>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-xs font-semibold text-muted-foreground">模板名称</span>
                  <input
                    v-model="workflowCreateForm.name"
                    class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="例如：项目发布修复流"
                    type="text"
                  />
                </label>
                <label class="space-y-1">
                  <span class="text-xs font-semibold text-muted-foreground">描述</span>
                  <input
                    v-model="workflowCreateForm.description"
                    class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="可选"
                    type="text"
                  />
                </label>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-border bg-background/60 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-semibold text-muted-foreground">节点定义</p>
                  <p class="mt-1 text-[11px] text-muted-foreground">每个节点可配置 Prompt、Agent CLI 和配置。</p>
                </div>
                <button
                  type="button"
                  class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
                  @click="addWorkflowCreateNode"
                >
                  添加节点
                </button>
              </div>

              <div class="space-y-3">
                <div
                  v-for="(node, index) in workflowCreateForm.nodes"
                  :key="`project-workflow-create-node-${index}`"
                  class="space-y-3 rounded-2xl border border-border bg-background/80 p-3.5"
                >
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="text-[11px] font-semibold text-muted-foreground">节点 {{ index + 1 }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <label
                        class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground"
                      >
                        <input v-model="node.requiresApproval" type="checkbox" class="h-4 w-4" />
                        需要审批
                      </label>
                      <button
                        type="button"
                        class="inline-flex h-8 items-center rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="workflowCreateForm.nodes.length <= 1"
                        @click="removeWorkflowCreateNode(index)"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div class="grid gap-3 md:grid-cols-2">
                    <label class="space-y-1 md:col-span-2">
                      <span class="text-[11px] text-muted-foreground">节点名称</span>
                      <input
                        v-model="node.name"
                        class="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                        type="text"
                      />
                    </label>

                    <label class="space-y-1 md:col-span-2">
                      <span class="text-[11px] text-muted-foreground">节点 Prompt</span>
                      <textarea
                        v-model="node.input.prompt"
                        class="min-h-[76px] w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        placeholder="输入该节点的执行提示词"
                      />
                    </label>

                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">Agent CLI</span>
                      <select
                        v-model="node.input.cliToolId"
                        :disabled="loadingWorkflowConfiguredCliTools || workflowConfiguredCliTools.length === 0"
                        class="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        @change="void handleWorkflowNodeCliToolChange(node)"
                      >
                        <option
                          v-if="!loadingWorkflowConfiguredCliTools && workflowConfiguredCliTools.length === 0"
                          value=""
                          disabled
                        >
                          当前业务线暂无已配置 Agent CLI
                        </option>
                        <option v-for="tool in workflowConfiguredCliTools" :key="tool.id" :value="tool.id">
                          {{ tool.label }}
                        </option>
                      </select>
                    </label>

                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">Agent CLI 配置</span>
                      <select
                        v-model="node.input.agentToolConfigId"
                        :disabled="!node.input.cliToolId || isWorkflowNodeConfigLoading(node.input.cliToolId)"
                        class="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">
                          {{ !node.input.cliToolId ? '请先选择 Agent CLI' : '请选择 Agent CLI 配置' }}
                        </option>
                        <option
                          v-for="config in getWorkflowNodeConfigs(node.input.cliToolId)"
                          :key="config.id"
                          :value="config.id"
                        >
                          {{ config.name }}
                        </option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <p v-if="workflowValidationMessage" class="text-sm text-destructive">
              {{ workflowValidationMessage }}
            </p>

            <div class="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-xs font-semibold text-foreground"
                @click="closeWorkflowCreateModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="submittingWorkflowTemplate || !projectId"
              >
                {{ submittingWorkflowTemplate ? workflowTemplateSubmitLoadingText : workflowTemplateSubmitIdleText }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="workflowCopyModalOpen"
        class="fixed inset-0 z-[121] flex items-center justify-center p-3 sm:p-6"
        @keydown.esc.prevent.stop="closeWorkflowCopyModal"
      >
        <button
          type="button"
          aria-label="关闭复制工作流弹窗"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          @click="closeWorkflowCopyModal"
        />

        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 class="text-base font-semibold">从业务线复制工作流</h2>
            <button
              type="button"
              aria-label="关闭"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              @click="closeWorkflowCopyModal"
            >
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
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <input
              v-model="workflowCopyKeyword"
              type="search"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="搜索业务线工作流模板"
            />

            <p v-if="loadingBusinessLineWorkflowTemplates" class="mt-3 text-sm text-muted-foreground">
              加载中...
            </p>
            <p v-else-if="copyWorkflowErrorMessage" class="mt-3 text-sm text-destructive">
              {{ copyWorkflowErrorMessage }}
            </p>

            <div v-else class="mt-3 space-y-2">
              <article
                v-for="template in filteredBusinessLineWorkflowTemplates"
                :key="template.id"
                class="rounded-xl border border-border bg-background/70 px-4 py-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold">{{ template.name }}</p>
                    <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {{ template.description ?? '暂无描述' }}
                    </p>
                    <p class="mt-2 text-[11px] text-muted-foreground">
                      节点数：{{ template.nodesJson.length }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="copyingBusinessLineWorkflowTemplateId === template.id"
                    @click="submitCopyBusinessLineWorkflowTemplate(template)"
                  >
                    {{ copyingBusinessLineWorkflowTemplateId === template.id ? '复制中...' : '复制' }}
                  </button>
                </div>
              </article>

              <article
                v-if="filteredBusinessLineWorkflowTemplates.length === 0"
                class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
              >
                当前业务线暂无可复制的工作流模板。
              </article>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="memberFormModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-member-form-modal-title"
        @click.self="closeMemberFormModal"
      >
        <section class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-member-form-modal-title" class="text-sm font-semibold">添加成员</h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭成员弹窗"
              @click="closeMemberFormModal"
            >
              关闭
            </button>
          </header>

          <form class="grid gap-3 px-4 py-4 md:grid-cols-[1fr_200px]" @submit.prevent="createMember">
            <input
              v-model="newMemberForm.userId"
              class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              list="project-member-user-options"
              placeholder="输入或选择用户"
              type="text"
            />
            <datalist id="project-member-user-options">
              <option v-for="user in users" :key="user.id" :value="user.id">
                {{ user.nickname?.trim() || user.username }}
              </option>
            </datalist>
            <select
              v-model="newMemberForm.role"
              class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="owner">owner</option>
              <option value="maintainer">maintainer</option>
              <option value="developer">developer</option>
              <option value="viewer">viewer</option>
            </select>
            <div class="md:col-span-2 flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                type="button"
                @click="closeMemberFormModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="creatingMember"
                type="submit"
              >
                {{ creatingMember ? '添加中...' : '添加成员' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="configFormModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-config-form-modal-title"
        @click.self="closeConfigFormModal"
      >
        <section class="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="project-config-form-modal-title" class="text-sm font-semibold">编辑项目配置</h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭配置弹窗"
              @click="closeConfigFormModal"
            >
              关闭
            </button>
          </header>

          <form class="grid max-h-[calc(92vh-56px)] gap-4 overflow-auto px-4 py-4 md:grid-cols-2" @submit.prevent="saveConfig">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">项目名称</span>
              <input
                v-model="configForm.name"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">默认分支</span>
              <input
                v-model="configForm.defaultBranch"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">仓库地址</span>
              <input
                v-model="configForm.gitUrl"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">描述</span>
              <input
                v-model="configForm.description"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Agent 执行器</span>
              <input
                v-model="configForm.agentAdapter"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如 codex"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">并发上限</span>
              <input
                v-model="configForm.maxConcurrency"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                min="1"
                type="number"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Agent Runner 开关</span>
              <select
                v-model="configForm.agentRunnerEnabled"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option :value="true">开启（真实执行）</option>
                <option :value="false">关闭（模拟执行）</option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Git Runtime 开关</span>
              <select
                v-model="configForm.gitRuntimeEnabled"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option :value="true">开启（clone/worktree）</option>
                <option :value="false">关闭（目录沙箱）</option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Skills 白名单（逗号分隔）</span>
              <input
                v-model="configForm.skills"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="code-review, test-generator"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">MCP 白名单（逗号分隔）</span>
              <input
                v-model="configForm.mcp"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="filesystem, jira"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Repo 本地路径（可选）</span>
              <input
                v-model="configForm.repoLocalPath"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="/path/to/existing/repo"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Repo 缓存目录（可选）</span>
              <input
                v-model="configForm.repoCacheBaseDir"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="/path/to/repo-cache"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Worktree 基础目录（可选）</span>
              <input
                v-model="configForm.worktreeBaseDir"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="/path/to/worktrees"
                type="text"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">Runner 命令（可选）</span>
              <input
                v-model="configForm.runnerCommand"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如 codex"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Runner 参数（逗号分隔）</span>
              <input
                v-model="configForm.runnerArgs"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="exec, --skip-git-repo-check, -"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">Runner 超时秒数</span>
              <input
                v-model="configForm.runnerTimeoutSeconds"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                min="5"
                type="number"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">优先级策略</span>
              <input
                v-model="configForm.priority"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="normal"
                type="text"
              />
            </label>

            <div class="md:col-span-2 flex justify-end gap-2">
              <button
                class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
                type="button"
                @click="closeConfigFormModal"
              >
                取消
              </button>
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savingConfig"
                type="submit"
              >
                {{ savingConfig ? '保存中...' : '保存配置' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
