<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from '@/hooks'
import { authApi } from '@/api/auth'
import {
  businessLinesApi,
  type AgentToolConfig,
  type BusinessLine,
  type BusinessLineCustomRole,
  type BusinessLineInvite,
  type BusinessLineMember,
} from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import {
  createProjectContainerRuntimeFormState,
  useProjectContainerRuntimeForm,
} from '@/composables/useProjectContainerRuntimeForm'
import {
  createProjectRunnerTemplateFormState,
  useProjectRunnerTemplateForm,
} from '@/composables/useProjectRunnerTemplateForm'
import { usersApi } from '@/api/users'
import { workflowApi } from '@/api/workflow'
import type { BusinessLineItem, ProjectItem } from '@/hooks/core/useLayout'
import type {
  Project,
  ProjectContainerRuntimeConfig,
  ProjectRunnerTemplateConfig,
  ProjectCustomRole,
} from '@/types/api/projects'
import type { User } from '@/types/api/users'
import type { Skill, SkillTreeNode } from '@/types/api/skills'
import type { Mcp } from '@/types/api/mcps'
import type {
  WorkflowTemplate,
  WorkflowTemplateNode,
  WorkflowTemplateNodeInput,
} from '@/types/api/workflow'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'
import BusinessLineFormModal from './modals/BusinessLineFormModal.vue'
import ConfirmActionModal from './modals/ConfirmActionModal.vue'
import MemberPermissionModal from './modals/MemberPermissionModal.vue'
import CustomRoleModal from '@/components/access/CustomRoleModal.vue'
import ProjectFormModal from './modals/ProjectFormModal.vue'
import AgentToolConfigModal from './modals/AgentToolConfigModal.vue'
import SkillUploadModal from './modals/SkillUploadModal.vue'
import AppSelect from '@/components/core/select'
import SkillTree from '@/components/skills/SkillTree.vue'
import McpJsonImportModal from './modals/McpJsonImportModal.vue'
import WorkflowPromptVariablesHint from '@/components/workflow/WorkflowPromptVariablesHint.vue'
import WorkflowPromptTextarea from '@/components/workflow/WorkflowPromptTextarea.vue'
import { STORAGE_KEYS } from '@/types/common/storage'
import {
  BUSINESS_LINE_CAPABILITY_TREE,
  PROJECT_CAPABILITY_TREE,
  buildBusinessLineRoleAssignmentOptions,
  formatProjectRoleCapabilitiesDisplay,
  formatBusinessLineRoleCapabilitiesDisplay,
} from '@/constants/access'

type MainTab =
  | 'projects'
  | 'members'
  | 'permissions'
  | 'agent-cli'
  | 'workflow'
  | 'skill'
  | 'mcp'
  | 'settings'
type PermissionRoleTab = 'business-line' | 'project'
const PROJECT_ROLE_NONE_VALUE = 'none'
type ProjectRoleSelection = string
type SupportedCliToolId = 'claude-code' | 'codex' | 'gemini-cli' | 'cursor-agent' | 'opencode'
type WorkflowTemplateNodeInputForm = {
  prompt: string
  agentCliId: SupportedCliToolId | ''
  agentCliConfigId: string
  earlyExitMarkerEnabled: boolean
  earlyExitMarkerFileName: string
}
type WorkflowTemplateNodeForm = Omit<WorkflowTemplateNode, 'input'> & {
  input: WorkflowTemplateNodeInputForm
  maxLoops?: number
}

const SUPPORTED_CLI_TOOLS: Array<{ id: SupportedCliToolId; label: string }> = [
  { id: 'cursor-agent', label: 'Cursor Agent' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'opencode', label: 'Opencode' },
]
const DEFAULT_AGENT_TOOL_CONFIG_NAME = 'default'
const BUSINESS_LINE_WORKFLOW_SELECT_PANEL_Z_INDEX = 120

const createEmptyWorkflowNodeInput = (): WorkflowTemplateNodeInputForm => ({
  prompt: '',
  agentCliId: '',
  agentCliConfigId: '',
  earlyExitMarkerEnabled: false,
  earlyExitMarkerFileName: '',
})

defineOptions({
  name: 'BusinessLineManagementPanel',
})

const props = withDefaults(
  defineProps<{
    lines: BusinessLineItem[]
    projects: ProjectItem[]
    activeBusinessLineId: string
    selectedProjectId?: string
    canCreateBusinessLine: boolean
    mode?: 'page' | 'modal'
  }>(),
  {
    mode: 'page',
  },
)

const isModalMode = computed(() => props.mode === 'modal')
const isPanelActive = computed(() => true)

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select-line', businessLineId: string): void
  (event: 'select-project', projectId: string): void
  (event: 'request-refresh'): void
}>()
const router = useRouter()

const activeLineId = ref('')
const activeTab = ref<MainTab>('projects')
const activePermissionRoleTab = ref<PermissionRoleTab>('business-line')

const projectQuery = ref('')
const memberQuery = ref('')

const lineDetail = ref<BusinessLine | null>(null)
const lineProjects = ref<ProjectItem[]>([])
const lineMembers = ref<BusinessLineMember[]>([])
const lineCustomRoles = ref<BusinessLineCustomRole[]>([])
const users = ref<User[]>([])

const loadingLineDetail = ref(false)
const loadingProjects = ref(false)
const loadingMembers = ref(false)
const loadingCustomRoles = ref(false)
const loadingUsers = ref(false)
const loadingAgentToolConfigs = ref(false)
const submittingAgentToolConfig = ref(false)
const deletingAgentToolConfigId = ref('')
const agentCliValidationMessage = ref('')
const agentToolConfigModalOpen = ref(false)
const agentToolConfigMode = ref<'create' | 'edit'>('create')
const editingAgentToolConfigId = ref('')
const agentToolConfigs = ref<AgentToolConfig[]>([])
const activeAgentCliToolId = ref<SupportedCliToolId>('cursor-agent')
const agentToolConfigForm = ref({
  name: '',
  description: '',
  isDefault: false,
  config: {} as Record<string, unknown>,
})

const lineFormModalOpen = ref(false)
const lineFormMode = ref<'create' | 'edit'>('create')
const lineFormSubmitting = ref(false)
const lineFormError = ref('')
const lineFormInitialName = ref('')
const lineFormInitialDescription = ref('')

const projectFormModalOpen = ref(false)
const projectFormMode = ref<'create' | 'edit'>('create')
const projectFormSubmitting = ref(false)
const projectFormError = ref('')
const projectFormInitialName = ref('')
const projectFormInitialDescription = ref('')
const projectFormInitialGitUrl = ref('')
const projectFormInitialDefaultBranch = ref('main')
const projectFormInitialContainerRuntime = ref<ProjectContainerRuntimeConfig | null>(null)
const projectFormInitialRunnerTemplate = ref<ProjectRunnerTemplateConfig | null>(null)
const projectFormInitialConfigJson = ref<Record<string, unknown> | null>(null)
const editingProjectId = ref('')

const memberPermissionModalOpen = ref(false)
const memberPermissionModalMode = ref<'create' | 'edit'>('create')
const memberPermissionModalSubmitting = ref(false)
const memberPermissionModalPreparing = ref(false)
const memberPermissionModalError = ref('')
const memberPermissionInitialUserId = ref('')
const memberPermissionInitialBusinessRole = ref<string>('member')
const memberPermissionInitialProjectRoles = ref<Record<string, ProjectRoleSelection>>({})
const memberInvitationLink = ref('')
const memberInvitationExpiresAt = ref('')

const customRoleModalOpen = ref(false)
const customRoleModalMode = ref<'create' | 'edit'>('create')
const customRoleModalSubmitting = ref(false)
const customRoleModalError = ref('')
const editingCustomRoleId = ref('')
const customRoleInitialName = ref('')
const customRoleInitialDescription = ref('')
const customRoleInitialCapabilities = ref<string[]>([])
const deletingCustomRoleId = ref('')

const permissionProjectRoleLibrary = ref<ProjectCustomRole[]>([])
const loadingPermissionProjectRoleLibrary = ref(false)
const permissionProjectRoleModalOpen = ref(false)
const permissionProjectRoleModalMode = ref<'create' | 'edit'>('create')
const permissionProjectRoleModalSubmitting = ref(false)
const permissionProjectRoleModalError = ref('')
const editingPermissionProjectRoleId = ref('')
const permissionProjectRoleInitialName = ref('')
const permissionProjectRoleInitialDescription = ref('')
const permissionProjectRoleInitialCapabilities = ref<string[]>([])
const deletingPermissionProjectRoleId = ref('')

const projectDeleteModalOpen = ref(false)
const deletingProject = ref(false)
const deletingProjectTarget = ref<ProjectItem | null>(null)

const memberRemoveModalOpen = ref(false)
const removingMember = ref(false)
const removingMemberTarget = ref<BusinessLineMember | null>(null)

const lineDeleteModalOpen = ref(false)
const lineDeleteFinalModalOpen = ref(false)
const deletingLine = ref(false)

const loadingWorkflowTemplates = ref(false)
const submittingWorkflowTemplate = ref(false)
const workflowCreateModalOpen = ref(false)
const workflowTemplateModalMode = ref<'create' | 'edit'>('create')
const editingWorkflowTemplateId = ref('')
const workflowTemplateActionId = ref('')
const workflowTemplateDeleteModalOpen = ref(false)
const workflowTemplateDeleteTarget = ref<WorkflowTemplate | null>(null)
const workflowValidationMessage = ref('')
const workflowTemplates = ref<WorkflowTemplate[]>([])
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
      requiresApproval: true,
      input: createEmptyWorkflowNodeInput(),
    },
  ],
})

const loadingLocalSkills = ref(false)
const skillKeyword = ref('')
const removingLocalSkillId = ref('')
const downloadingLocalSkillId = ref('')
const loadingLocalMcps = ref(false)
const uploadSkillModalOpen = ref(false)
const uploadingLocalSkill = ref(false)
const uploadSkillError = ref('')
const mcpJsonImportModalOpen = ref(false)
const importingLocalMcps = ref(false)
const mcpJsonImportError = ref('')
const mcpJsonPreviewModalOpen = ref(false)
const loadingMcpJsonPreview = ref(false)
const mcpJsonPreviewItem = ref<Mcp | null>(null)
const mcpJsonPreviewName = ref('')
const mcpJsonPreviewSourcePath = ref('')
const mcpJsonPreviewError = ref('')
const mcpJsonPreviewDraft = ref('')
const savingMcpJsonPreview = ref(false)
const skillPreviewModalOpen = ref(false)
const loadingSkillPreview = ref(false)
const skillPreviewItem = ref<Skill | null>(null)
const skillPreviewId = ref('')
const skillPreviewName = ref('')
const skillPreviewTree = ref<SkillTreeNode[]>([])
const skillPreviewContent = ref('')
const skillPreviewSelectedPath = ref('')
const skillPreviewFileLoading = ref(false)
const skillPreviewError = ref('')
const skillPreviewRequestToken = ref(0)
const skillPreviewExpandedDirs = ref(new Set<string>())
const localSkills = ref<Skill[]>([])
const localMcps = ref<Mcp[]>([])

const message = useMessage()
const lineCapabilitiesById = ref<Record<string, string[]>>({})

const selectedLine = computed(() => {
  return props.lines.find((line) => line.id === activeLineId.value) ?? null
})

const selectedLineName = computed(() => {
  return lineDetail.value?.name ?? selectedLine.value?.name ?? '业务线'
})

const selectedLineDescription = computed(() => {
  return lineDetail.value?.description ?? selectedLine.value?.description ?? ''
})

const getLineCapabilities = (lineId: string) => {
  return lineCapabilitiesById.value[lineId] ?? []
}

const hasActiveLineCapability = (capability: string) => {
  if (!activeLineId.value) {
    return false
  }

  return getLineCapabilities(activeLineId.value).includes(capability)
}

const hasAnyActiveLineCapability = (...capabilities: string[]) => {
  return capabilities.some((cap) => hasActiveLineCapability(cap))
}

const canManageActiveLine = computed(() => {
  return hasActiveLineCapability('businessLine.update')
})

const canInviteMembers = computed(() => hasActiveLineCapability('businessLine.member.invite'))
const canUpdateMemberRole = computed(() =>
  hasActiveLineCapability('businessLine.member.updateRole'),
)
const canRemoveMembers = computed(() => hasActiveLineCapability('businessLine.member.remove'))
const canCreateBusinessLineRole = computed(() =>
  hasActiveLineCapability('businessLine.role.create'),
)
const canUpdateBusinessLineRole = computed(() =>
  hasActiveLineCapability('businessLine.role.update'),
)
const canDeleteBusinessLineRole = computed(() =>
  hasActiveLineCapability('businessLine.role.delete'),
)

const businessLineRoleOptions = computed(() => {
  return buildBusinessLineRoleAssignmentOptions(lineCustomRoles.value)
})

const memberPermissionProjectRoleOptions = computed(() => {
  return permissionProjectRoleLibrary.value.map((role) => ({
    label: role.name,
    value: role.id,
  }))
})

const canCreateProjectItem = computed(() => {
  return hasActiveLineCapability('businessLine.project.create')
})

const canUpdateProjectItem = computed(() => {
  return hasActiveLineCapability('businessLine.project.update')
})

const canDeleteProjectItem = computed(() => {
  return hasActiveLineCapability('businessLine.project.delete')
})

const canManagePermissionProjectRoles = computed(() => {
  return (
    Boolean(activeLineId.value) &&
    hasAnyActiveLineCapability(
      'businessLine.projectRole.create',
      'businessLine.projectRole.update',
      'businessLine.projectRole.delete',
    )
  )
})

const loadLineAccess = async (lineId: string) => {
  if (!lineId) {
    return
  }

  try {
    const response = await authApi.access({ businessLineId: lineId })
    lineCapabilitiesById.value = {
      ...lineCapabilitiesById.value,
      [lineId]: Array.from(new Set(response.capabilities)),
    }
  } catch (error) {
    void error
    lineCapabilitiesById.value = {
      ...lineCapabilitiesById.value,
      [lineId]: [],
    }
  }
}

const loadPermissionProjectCustomRoles = async (lineId: string) => {
  if (!lineId) {
    permissionProjectRoleLibrary.value = []
    return
  }

  loadingPermissionProjectRoleLibrary.value = true

  try {
    const roles = await businessLinesApi.listProjectCustomRoles(lineId)
    if (lineId !== activeLineId.value) {
      return
    }

    permissionProjectRoleLibrary.value = roles
  } catch (error) {
    if (lineId === activeLineId.value) {
      permissionProjectRoleLibrary.value = []
      message.error(toErrorMessage(error, '加载角色列表失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingPermissionProjectRoleLibrary.value = false
    }
  }
}

const activeAgentCliToolLabel = computed(() => {
  return (
    SUPPORTED_CLI_TOOLS.find((tool) => tool.id === activeAgentCliToolId.value)?.label ??
    activeAgentCliToolId.value
  )
})

const workflowConfiguredCliToolIdSet = computed(() => {
  return new Set(workflowConfiguredCliTools.value.map((tool) => tool.id))
})

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

const workflowTemplateModalTitle = computed(() => {
  return workflowTemplateModalMode.value === 'edit'
    ? '编辑业务线工作流模板'
    : '创建业务线工作流模板'
})

const workflowTemplateSubmitIdleText = computed(() => {
  return workflowTemplateModalMode.value === 'edit' ? '保存修改' : '创建模板'
})

const workflowTemplateSubmitLoadingText = computed(() => {
  return workflowTemplateModalMode.value === 'edit' ? '保存中...' : '创建中...'
})

const canDeleteLine = computed(() => {
  return (
    Boolean(activeLineId.value) &&
    hasActiveLineCapability('businessLine.delete') &&
    lineProjects.value.length === 0
  )
})

const filteredProjects = computed(() => {
  const query = projectQuery.value.trim().toLowerCase()
  if (!query) {
    return lineProjects.value
  }

  return lineProjects.value.filter((project) => {
    return (
      project.name.toLowerCase().includes(query) ||
      project.id.toLowerCase().includes(query) ||
      (project.description ?? '').toLowerCase().includes(query) ||
      project.gitUrl.toLowerCase().includes(query)
    )
  })
})

const userMap = computed(() => {
  return new Map(users.value.map((user) => [user.id, user]))
})

const filteredMembers = computed(() => {
  const query = memberQuery.value.trim().toLowerCase()
  if (!query) {
    return lineMembers.value
  }

  return lineMembers.value.filter((member) => {
    const user = userMap.value.get(member.userId)
    const nickname = user?.nickname?.toLowerCase() ?? ''
    const username = user?.username?.toLowerCase() ?? ''
    return (
      member.userId.toLowerCase().includes(query) ||
      member.roleId.toLowerCase().includes(query) ||
      (member.customRoleName ?? '').toLowerCase().includes(query) ||
      nickname.includes(query) ||
      username.includes(query)
    )
  })
})

const formatDate = (value?: string) => {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const projectContainerRuntimeForm = useProjectContainerRuntimeForm(
  createProjectContainerRuntimeFormState(),
)
const projectRunnerTemplateForm = useProjectRunnerTemplateForm(
  createProjectRunnerTemplateFormState(),
)

const mapProjectItem = (project: Project): ProjectItem => {
  return {
    id: project.id,
    name: project.name,
    to: `/dashboard?projectId=${encodeURIComponent(project.id)}`,
    businessLineId: project.businessLineId,
    description: project.description ?? null,
    gitUrl: project.gitUrl,
    defaultBranch: project.defaultBranch,
    configJson: project.configJson ?? null,
  }
}

const resetAgentToolConfigForm = () => {
  agentToolConfigModalOpen.value = false
  agentToolConfigMode.value = 'create'
  editingAgentToolConfigId.value = ''
  agentCliValidationMessage.value = ''
  agentToolConfigForm.value = {
    name: '',
    description: '',
    isDefault: false,
    config: {},
  }
}

const buildCreateAgentToolConfigForm = () => {
  const hasNamedDefaultConfig = agentToolConfigs.value.some(
    (config) => config.name.trim().toLowerCase() === DEFAULT_AGENT_TOOL_CONFIG_NAME,
  )
  const hasDefaultConfig = agentToolConfigs.value.some((config) => config.isDefault)

  return {
    name: hasNamedDefaultConfig ? '' : DEFAULT_AGENT_TOOL_CONFIG_NAME,
    description: '',
    isDefault: !hasDefaultConfig,
    config: {} as Record<string, unknown>,
  }
}

const openCreateAgentToolConfig = () => {
  resetAgentToolConfigForm()
  agentToolConfigForm.value = buildCreateAgentToolConfigForm()
  agentToolConfigModalOpen.value = true
}

const openEditAgentToolConfig = (config: AgentToolConfig) => {
  agentToolConfigMode.value = 'edit'
  editingAgentToolConfigId.value = config.id
  agentCliValidationMessage.value = ''
  agentToolConfigForm.value = {
    name: config.name,
    description: config.description ?? '',
    isDefault: config.isDefault,
    config: { ...config.configJson },
  }
  agentToolConfigModalOpen.value = true
}

const loadAgentToolConfigs = async (
  lineId: string,
  toolId: SupportedCliToolId = activeAgentCliToolId.value,
) => {
  if (!lineId) {
    agentToolConfigs.value = []
    resetAgentToolConfigForm()
    return
  }

  loadingAgentToolConfigs.value = true
  try {
    const configs = await businessLinesApi.listAgentToolConfigs(lineId, { toolId })
    if (lineId !== activeLineId.value) {
      return
    }
    agentToolConfigs.value = configs
  } catch (error) {
    if (lineId === activeLineId.value) {
      agentToolConfigs.value = []
      message.error(toErrorMessage(error, '加载 Agent CLI 配置失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingAgentToolConfigs.value = false
    }
  }
}

const saveAgentToolConfig = async (payload: {
  name: string
  description: string
  isDefault: boolean
  config: Record<string, unknown>
}) => {
  if (!activeLineId.value) {
    return
  }

  const toolId = activeAgentCliToolId.value
  const name = payload.name.trim()

  if (!toolId) {
    agentCliValidationMessage.value = 'Tool ID 不能为空'
    return
  }

  if (!name) {
    agentCliValidationMessage.value = '配置名称不能为空'
    return
  }

  submittingAgentToolConfig.value = true
  agentCliValidationMessage.value = ''

  try {
    const requestPayload = {
      toolId,
      name,
      description: normalizeOptionalText(payload.description),
      isDefault: payload.isDefault,
      configJson: payload.config,
    }

    if (agentToolConfigMode.value === 'create') {
      await businessLinesApi.createAgentToolConfig(activeLineId.value, requestPayload)
      message.success('Agent CLI 配置创建成功')
    } else {
      if (!editingAgentToolConfigId.value) {
        return
      }

      await businessLinesApi.updateAgentToolConfig(
        activeLineId.value,
        editingAgentToolConfigId.value,
        requestPayload,
      )
      message.success('Agent CLI 配置更新成功')
    }

    await loadAgentToolConfigs(activeLineId.value)
    resetAgentToolConfigForm()
    agentToolConfigModalOpen.value = false
  } catch (error) {
    message.error(toErrorMessage(error, '保存 Agent CLI 配置失败'))
  } finally {
    submittingAgentToolConfig.value = false
  }
}

const setAgentToolConfigAsDefault = async (config: AgentToolConfig) => {
  if (!activeLineId.value || config.isDefault) {
    return
  }

  submittingAgentToolConfig.value = true
  agentCliValidationMessage.value = ''

  try {
    await businessLinesApi.updateAgentToolConfig(activeLineId.value, config.id, {
      isDefault: true,
    })
    await loadAgentToolConfigs(activeLineId.value, activeAgentCliToolId.value)
    message.success('默认 Agent CLI 配置已更新')
  } catch (error) {
    message.error(toErrorMessage(error, '更新默认配置失败'))
  } finally {
    submittingAgentToolConfig.value = false
  }
}

const removeAgentToolConfig = async (configId: string) => {
  if (!activeLineId.value) {
    return
  }

  deletingAgentToolConfigId.value = configId
  try {
    await businessLinesApi.removeAgentToolConfig(activeLineId.value, configId)
    await loadAgentToolConfigs(activeLineId.value, activeAgentCliToolId.value)

    if (editingAgentToolConfigId.value === configId) {
      resetAgentToolConfigForm()
    }

    message.success('Agent CLI 配置已删除')
  } catch (error) {
    message.error(toErrorMessage(error, '删除 Agent CLI 配置失败'))
  } finally {
    deletingAgentToolConfigId.value = ''
  }
}

const isSupportedCliToolId = (toolId: string): toolId is SupportedCliToolId => {
  return SUPPORTED_CLI_TOOLS.some((tool) => tool.id === toolId)
}

const normalizeWorkflowNodeInput = (
  input?: WorkflowTemplateNodeInput,
): WorkflowTemplateNodeInputForm => {
  const rawInput = (input ?? {}) as Record<string, unknown>
  const prompt = typeof rawInput.prompt === 'string' ? rawInput.prompt : ''
  const rawAgentCliId =
    typeof rawInput.agentCliId === 'string'
      ? rawInput.agentCliId.trim()
      : typeof rawInput.cliToolId === 'string'
        ? rawInput.cliToolId.trim()
        : ''
  const normalizedCliToolId = isSupportedCliToolId(rawAgentCliId) ? rawAgentCliId : ''
  const rawAgentCliConfigId =
    typeof rawInput.agentCliConfigId === 'string'
      ? rawInput.agentCliConfigId.trim()
      : typeof rawInput.agentToolConfigId === 'string'
        ? rawInput.agentToolConfigId.trim()
        : ''
  const earlyExitMarkerEnabled = Boolean(rawInput.earlyExitMarkerEnabled)
  const earlyExitMarkerFileName =
    typeof rawInput.earlyExitMarkerFileName === 'string'
      ? rawInput.earlyExitMarkerFileName.trim()
      : ''

  return {
    prompt,
    agentCliId: normalizedCliToolId,
    agentCliConfigId: normalizedCliToolId ? rawAgentCliConfigId : '',
    earlyExitMarkerEnabled,
    earlyExitMarkerFileName,
  }
}

const resolveWorkflowNodeInputByContext = (
  input: WorkflowTemplateNodeInput | WorkflowTemplateNodeInputForm | undefined,
  configuredTools: Array<{ id: SupportedCliToolId; label: string }>,
  configsByTool: Partial<Record<SupportedCliToolId, AgentToolConfig[]>>,
): WorkflowTemplateNodeInputForm => {
  const nextInput = normalizeWorkflowNodeInput(input)
  const allowedToolIds = new Set(configuredTools.map((tool) => tool.id))
  const fallbackToolId = configuredTools[0]?.id ?? ''
  const agentCliId =
    nextInput.agentCliId && allowedToolIds.has(nextInput.agentCliId)
      ? nextInput.agentCliId
      : fallbackToolId

  if (!agentCliId) {
    return {
      ...nextInput,
      agentCliId: '',
      agentCliConfigId: '',
    }
  }

  const toolConfigs = configsByTool[agentCliId] ?? []
  const hasSelectedConfig = toolConfigs.some((config) => config.id === nextInput.agentCliConfigId)
  const preferredConfigId =
    toolConfigs.find((config) => config.isDefault)?.id ?? toolConfigs[0]?.id ?? ''

  return {
    ...nextInput,
    agentCliId,
    agentCliConfigId: hasSelectedConfig ? nextInput.agentCliConfigId : preferredConfigId,
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
  requiresApproval: true,
  maxLoops: 1,
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
      maxLoops: Math.max(Number(node.maxLoops) || 1, 1),
      input: normalizeWorkflowNodeInput(node.input),
    }))
}

const serializeWorkflowNodeInput = (
  input: WorkflowTemplateNodeInputForm,
): WorkflowTemplateNodeInput | undefined => {
  const normalizedPrompt = input.prompt.trim()
  const normalizedConfigId = input.agentCliConfigId.trim()
  const normalizedMarkerFileName = input.earlyExitMarkerFileName.trim()
  const payload: WorkflowTemplateNodeInput = {}

  if (normalizedPrompt) {
    payload.prompt = normalizedPrompt
  }

  if (input.agentCliId) {
    payload.agentCliId = input.agentCliId
    if (normalizedConfigId) {
      payload.agentCliConfigId = normalizedConfigId
    }
  }

  if (input.earlyExitMarkerEnabled && normalizedMarkerFileName) {
    payload.earlyExitMarkerEnabled = true
    payload.earlyExitMarkerFileName = normalizedMarkerFileName
  }

  return Object.keys(payload).length > 0 ? payload : undefined
}

const buildWorkflowNodesForSubmit = (nodes: WorkflowTemplateNodeForm[]): WorkflowTemplateNode[] => {
  return normalizeWorkflowNodes(nodes).map((node) => ({
    ...node,
    input: {
      ...serializeWorkflowNodeInput(node.input),
      ...(node.maxLoops !== undefined && node.maxLoops > 1 ? { maxLoops: node.maxLoops } : {}),
    },
  }))
}

const validateWorkflowNodes = (nodes: WorkflowTemplateNode[]) => {
  if (nodes.length === 0) {
    return '至少需要一个节点'
  }

  if (workflowConfiguredCliTools.value.length === 0) {
    return '当前业务线暂无已配置 Agent CLI，请先在 Agent CLI 页面完成配置'
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || !node.name.trim()) {
      return `节点 #${index + 1} 名称不能为空`
    }

    const nodeInput = normalizeWorkflowNodeInput(node.input)
    if (!nodeInput.agentCliId) {
      return `节点 #${index + 1} 请选择 Agent CLI`
    }

    if (!workflowConfiguredCliToolIdSet.value.has(nodeInput.agentCliId)) {
      return `节点 #${index + 1} 的 Agent CLI 不可用，请重新选择`
    }

    if (nodeInput.earlyExitMarkerEnabled && !nodeInput.earlyExitMarkerFileName.trim()) {
      return `节点 #${index + 1} 已启用 marker 提前退出，请填写 marker 文件名`
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

const loadWorkflowConfiguredCliTools = async (lineId: string) => {
  if (!lineId) {
    workflowConfiguredCliTools.value = []
    workflowNodeConfigsByTool.value = {}
    return
  }

  loadingWorkflowConfiguredCliTools.value = true
  try {
    const configs = await businessLinesApi.listAgentToolConfigs(lineId)
    if (lineId !== activeLineId.value) {
      return
    }

    const groupedConfigs: Partial<Record<SupportedCliToolId, AgentToolConfig[]>> = {}
    for (const config of configs) {
      if (!isSupportedCliToolId(config.toolId)) {
        continue
      }

      groupedConfigs[config.toolId] = [...(groupedConfigs[config.toolId] ?? []), config]
    }

    const configuredTools = SUPPORTED_CLI_TOOLS.filter((tool) => {
      return Boolean(groupedConfigs[tool.id]?.length)
    })
    workflowNodeConfigsByTool.value = groupedConfigs
    workflowConfiguredCliTools.value = configuredTools
    workflowCreateForm.value.nodes = normalizeWorkflowNodes(
      workflowCreateForm.value.nodes.map((node) => {
        return {
          ...node,
          input: resolveWorkflowNodeInputByContext(node.input, configuredTools, groupedConfigs),
        }
      }),
    )
  } catch (error) {
    if (lineId === activeLineId.value) {
      workflowConfiguredCliTools.value = []
      workflowNodeConfigsByTool.value = {}
      message.error(toErrorMessage(error, '加载业务线工作流 Agent CLI 列表失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingWorkflowConfiguredCliTools.value = false
    }
  }
}

const loadWorkflowNodeConfigs = async (
  lineId: string,
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
    const configs = await businessLinesApi.listAgentToolConfigs(lineId, { toolId })
    if (lineId !== activeLineId.value) {
      return []
    }

    workflowNodeConfigsByTool.value = {
      ...workflowNodeConfigsByTool.value,
      [toolId]: configs,
    }
    return configs
  } catch (error) {
    if (lineId === activeLineId.value) {
      workflowNodeConfigsByTool.value = {
        ...workflowNodeConfigsByTool.value,
        [toolId]: [],
      }
      message.error(toErrorMessage(error, '加载工作流节点 Agent CLI 配置失败'))
    }
    return []
  } finally {
    if (lineId === activeLineId.value) {
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

const getWorkflowNodeConfigSelectOptions = (toolId: SupportedCliToolId | '') => {
  return [
    {
      label: !toolId ? '请先选择 Agent CLI' : '请选择 Agent CLI 配置',
      value: '',
    },
    ...getWorkflowNodeConfigs(toolId).map((config) => ({
      label: config.name,
      value: config.id,
    })),
  ]
}

const isWorkflowNodeConfigLoading = (toolId: SupportedCliToolId | '') => {
  if (!toolId) {
    return false
  }

  return Boolean(workflowNodeConfigLoadingByTool.value[toolId])
}

const handleWorkflowNodeCliToolChange = async (node: WorkflowTemplateNodeForm) => {
  if (!activeLineId.value) {
    node.input = resolveWorkflowNodeInput(node.input)
    return
  }

  if (!node.input.agentCliId || !workflowConfiguredCliToolIdSet.value.has(node.input.agentCliId)) {
    node.input = resolveWorkflowNodeInput(node.input)
    return
  }

  const selectedToolId = node.input.agentCliId
  node.input.agentCliConfigId = ''

  const configs = await loadWorkflowNodeConfigs(activeLineId.value, selectedToolId)
  if (node.input.agentCliId !== selectedToolId) {
    return
  }

  const preferredConfigId = configs.find((config) => config.isDefault)?.id ?? configs[0]?.id ?? ''
  node.input.agentCliConfigId = preferredConfigId
}

const preloadWorkflowNodeConfigs = async () => {
  if (!activeLineId.value) {
    return
  }

  const toolIds = Array.from(
    new Set(
      workflowCreateForm.value.nodes
        .map((node) => node.input.agentCliId)
        .filter((toolId): toolId is SupportedCliToolId => Boolean(toolId)),
    ),
  )

  await Promise.all(toolIds.map((toolId) => loadWorkflowNodeConfigs(activeLineId.value, toolId)))
}

const resetWorkflowCreateForm = () => {
  workflowValidationMessage.value = ''
  workflowCreateForm.value = {
    name: '',
    description: '',
    nodes: [buildWorkflowNode(1)],
  }
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
      maxLoops: (node.input as WorkflowTemplateNodeInput | undefined)?.maxLoops ?? 1,
      input: normalizeWorkflowNodeInput(node.input),
    })),
  )
}

const openWorkflowCreateModal = () => {
  if (!activeLineId.value) {
    return
  }

  workflowTemplateModalMode.value = 'create'
  editingWorkflowTemplateId.value = ''
  resetWorkflowCreateForm()
  ensureWorkflowCreateNodeShape()
  workflowNodeConfigLoadingByTool.value = {}
  workflowCreateModalOpen.value = true
  void loadWorkflowConfiguredCliTools(activeLineId.value).then(() => preloadWorkflowNodeConfigs())
}

const openWorkflowEditModal = (template: WorkflowTemplate) => {
  if (!activeLineId.value) {
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
  void loadWorkflowConfiguredCliTools(activeLineId.value).then(() => preloadWorkflowNodeConfigs())
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

const loadWorkflowTemplates = async (lineId: string) => {
  if (!lineId) {
    workflowTemplates.value = []
    resetWorkflowCreateForm()
    return
  }

  loadingWorkflowTemplates.value = true
  workflowValidationMessage.value = ''

  try {
    const templates = await fetchAllPages((page, limit) =>
      workflowApi.list({
        page,
        limit,
        scope: 'business_line',
        businessLineId: lineId,
      }),
    )

    workflowTemplates.value = templates
  } catch (error) {
    workflowTemplates.value = []
    message.error(toErrorMessage(error, '加载业务线工作流模板失败'))
  } finally {
    loadingWorkflowTemplates.value = false
  }
}

const submitWorkflowTemplate = async () => {
  if (!activeLineId.value) {
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
      message.success('业务线工作流模板更新成功')
    } else {
      await workflowApi.create({
        ...requestPayload,
        scope: 'business_line',
        businessLineId: activeLineId.value,
        isActive: true,
      })
      message.success('业务线工作流模板创建成功')
    }

    await loadWorkflowTemplates(activeLineId.value)
    closeWorkflowCreateModal()
  } catch (error) {
    message.error(
      toErrorMessage(error, isEditing ? '更新业务线工作流模板失败' : '创建业务线工作流模板失败'),
    )
  } finally {
    submittingWorkflowTemplate.value = false
  }
}

const removeWorkflowTemplate = async (template: WorkflowTemplate) => {
  workflowTemplateDeleteTarget.value = template
  workflowTemplateDeleteModalOpen.value = true
}

const setWorkflowTemplateDeleteModalOpen = (open: boolean) => {
  workflowTemplateDeleteModalOpen.value = open
  if (!open) {
    workflowTemplateDeleteTarget.value = null
  }
}

const confirmRemoveWorkflowTemplate = async () => {
  const template = workflowTemplateDeleteTarget.value
  if (!template) {
    return
  }

  workflowTemplateActionId.value = template.id
  try {
    await workflowApi.remove(template.id)
    await loadWorkflowTemplates(activeLineId.value)
    message.success('模板删除成功')
    setWorkflowTemplateDeleteModalOpen(false)
  } catch (error) {
    message.error(toErrorMessage(error, '删除模板失败'))
  } finally {
    workflowTemplateActionId.value = ''
  }
}

const loadLocalSkills = async (lineId: string) => {
  if (!lineId) {
    localSkills.value = []
    return
  }

  loadingLocalSkills.value = true

  try {
    const keyword = skillKeyword.value.trim() || undefined
    const skills = await businessLinesApi.listLocalSkills(lineId, { keyword })
    if (lineId !== activeLineId.value) {
      return
    }

    localSkills.value = skills
  } catch (error) {
    if (lineId === activeLineId.value) {
      localSkills.value = []
      message.error(toErrorMessage(error, '加载业务线本地 Skill 失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingLocalSkills.value = false
    }
  }
}

const downloadLocalSkill = async (item: Skill) => {
  if (!activeLineId.value || downloadingLocalSkillId.value) {
    return
  }

  downloadingLocalSkillId.value = item.id

  try {
    const token = localStorage.getItem(STORAGE_KEYS.authToken)
    const url = `/api/v1/business-lines/${encodeURIComponent(activeLineId.value)}/local-skills/${encodeURIComponent(item.id)}/download`
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!response.ok) {
      throw new Error(`下载失败 (${response.status})`)
    }

    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition')
    const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/)
    const fileName = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : `${item.name}.zip`

    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  } catch (error) {
    message.error(toErrorMessage(error, '下载技能失败'))
  } finally {
    downloadingLocalSkillId.value = ''
  }
}

const removeLocalSkill = async (item: Skill) => {
  if (!activeLineId.value || removingLocalSkillId.value) {
    return
  }

  if (!window.confirm(`确认删除技能「${item.name}」吗？此操作不可撤销。`)) {
    return
  }

  removingLocalSkillId.value = item.id

  try {
    await businessLinesApi.removeLocalSkill(activeLineId.value, item.id)
    if (skillPreviewItem.value?.id === item.id) {
      closeSkillPreview()
    }
    await loadLocalSkills(activeLineId.value)
    message.success(`技能「${item.name}」已删除`)
  } catch (error) {
    message.error(toErrorMessage(error, '删除技能失败'))
  } finally {
    removingLocalSkillId.value = ''
  }
}

const openUploadSkillModal = () => {
  if (!activeLineId.value) {
    return
  }

  uploadSkillError.value = ''
  uploadSkillModalOpen.value = true
}

const submitUploadSkill = async (file: File) => {
  if (!activeLineId.value) {
    return
  }

  uploadingLocalSkill.value = true
  uploadSkillError.value = ''

  try {
    const uploadedSkill = await businessLinesApi.uploadLocalSkill(activeLineId.value, file)
    uploadSkillModalOpen.value = false
    await loadLocalSkills(activeLineId.value)
    message.success(`Skill「${uploadedSkill.name}」上传成功`)
  } catch (error) {
    uploadSkillError.value = toErrorMessage(error, '上传 Skill 失败')
    message.error(uploadSkillError.value)
  } finally {
    uploadingLocalSkill.value = false
  }
}

const resetSkillPreviewState = () => {
  skillPreviewRequestToken.value += 1
  skillPreviewModalOpen.value = false
  loadingSkillPreview.value = false
  skillPreviewItem.value = null
  skillPreviewId.value = ''
  skillPreviewName.value = ''
  skillPreviewTree.value = []
  skillPreviewContent.value = ''
  skillPreviewSelectedPath.value = ''
  skillPreviewFileLoading.value = false
  skillPreviewError.value = ''
  skillPreviewExpandedDirs.value = new Set()
}

const closeSkillPreview = () => {
  resetSkillPreviewState()
}

const toggleSkillPreviewDir = (dirPath: string) => {
  const expanded = skillPreviewExpandedDirs.value
  if (expanded.has(dirPath)) {
    expanded.delete(dirPath)
  } else {
    expanded.add(dirPath)
  }
}

const loadSkillPreviewFile = async (skillId: string, filePath: string) => {
  if (!activeLineId.value) return

  skillPreviewSelectedPath.value = filePath
  skillPreviewFileLoading.value = true
  skillPreviewContent.value = ''
  const requestToken = skillPreviewRequestToken.value

  try {
    const response = await businessLinesApi.localSkillFile(activeLineId.value, skillId, filePath)
    if (requestToken !== skillPreviewRequestToken.value) return
    skillPreviewContent.value = response.content
  } catch (error) {
    if (requestToken !== skillPreviewRequestToken.value) return
    skillPreviewContent.value = ''
    skillPreviewError.value = toErrorMessage(error, '加载文件失败')
  } finally {
    if (requestToken === skillPreviewRequestToken.value) {
      skillPreviewFileLoading.value = false
    }
  }
}

const findSkillMdInTree = (nodes: SkillTreeNode[]): string | null => {
  for (const node of nodes) {
    if (!node.isDir && node.name.toLowerCase() === 'skill.md') {
      return node.path
    }
  }
  return null
}

const openSkillPreview = async (item: Skill) => {
  if (!activeLineId.value) {
    return
  }

  const requestToken = ++skillPreviewRequestToken.value
  skillPreviewModalOpen.value = true
  loadingSkillPreview.value = true
  skillPreviewItem.value = item
  skillPreviewId.value = item.id
  skillPreviewName.value = item.name
  skillPreviewTree.value = []
  skillPreviewContent.value = ''
  skillPreviewSelectedPath.value = ''
  skillPreviewError.value = ''
  skillPreviewExpandedDirs.value = new Set()

  try {
    const response = await businessLinesApi.localSkillTree(activeLineId.value, item.id)

    if (requestToken !== skillPreviewRequestToken.value) return

    skillPreviewTree.value = response.tree
    const defaultFile = findSkillMdInTree(response.tree)
    if (defaultFile) {
      await loadSkillPreviewFile(item.id, defaultFile)
    }
  } catch (error) {
    if (requestToken !== skillPreviewRequestToken.value) return
    skillPreviewError.value = toErrorMessage(error, '加载技能目录失败')
  } finally {
    if (requestToken === skillPreviewRequestToken.value) {
      loadingSkillPreview.value = false
    }
  }
}

const loadLocalMcps = async (lineId: string) => {
  if (!lineId) {
    localMcps.value = []
    return
  }

  loadingLocalMcps.value = true

  try {
    const mcps = await businessLinesApi.listLocalMcps(lineId)
    if (lineId !== activeLineId.value) {
      return
    }

    localMcps.value = mcps
  } catch (error) {
    if (lineId === activeLineId.value) {
      localMcps.value = []
      message.error(toErrorMessage(error, '加载业务线本地 MCP 失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingLocalMcps.value = false
    }
  }
}

const openImportMcpJsonModal = () => {
  if (!activeLineId.value) {
    return
  }

  mcpJsonImportError.value = ''
  mcpJsonImportModalOpen.value = true
}

const submitImportMcpJson = async (payload: Record<string, unknown>) => {
  if (!activeLineId.value) {
    return
  }

  importingLocalMcps.value = true
  mcpJsonImportError.value = ''

  try {
    const result = await businessLinesApi.importLocalMcps(activeLineId.value, {
      payload,
    })
    mcpJsonImportModalOpen.value = false
    await loadLocalMcps(activeLineId.value)

    const summary =
      result.overwrittenCount > 0
        ? `导入 ${result.importedCount} 个，覆盖 ${result.overwrittenCount} 个`
        : `导入 ${result.importedCount} 个`
    message.success(`MCP 添加成功（${summary}）`)
  } catch (error) {
    mcpJsonImportError.value = toErrorMessage(error, '添加 MCP 失败')
    message.error(mcpJsonImportError.value)
  } finally {
    importingLocalMcps.value = false
  }
}

const resolveMcpSourcePath = (item: Mcp) => {
  const absolute = item.metadataJson?.sourcePathAbsolute
  if (typeof absolute === 'string' && absolute.trim()) {
    return absolute.trim()
  }
  const sourcePath = item.metadataJson?.sourcePath
  if (typeof sourcePath !== 'string') {
    return ''
  }
  return sourcePath.trim()
}

const resetMcpJsonPreviewState = () => {
  mcpJsonPreviewModalOpen.value = false
  loadingMcpJsonPreview.value = false
  mcpJsonPreviewItem.value = null
  mcpJsonPreviewName.value = ''
  mcpJsonPreviewSourcePath.value = ''
  mcpJsonPreviewError.value = ''
  mcpJsonPreviewDraft.value = ''
  savingMcpJsonPreview.value = false
}

const closeMcpJsonPreview = () => {
  if (savingMcpJsonPreview.value) {
    return
  }

  resetMcpJsonPreviewState()
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const resolveMcpConfigFromDraft = (
  parsedPayload: unknown,
  mcpName: string,
): Record<string, unknown> => {
  if (!isRecord(parsedPayload)) {
    throw new Error('JSON 顶层必须是对象')
  }

  const mcpServers = parsedPayload.mcpServers
  if (isRecord(mcpServers) && isRecord(mcpServers[mcpName])) {
    return mcpServers[mcpName]
  }

  const keys = Object.keys(parsedPayload)
  if (keys.length === 1) {
    const onlyKey = keys[0]
    if (onlyKey && isRecord(parsedPayload[onlyKey])) {
      return parsedPayload[onlyKey]
    }
  }

  if (isRecord(parsedPayload[mcpName])) {
    return parsedPayload[mcpName]
  }

  if (
    typeof parsedPayload.command === 'string' ||
    typeof parsedPayload.url === 'string' ||
    Array.isArray(parsedPayload.args)
  ) {
    return parsedPayload
  }

  throw new Error('未找到可保存的 MCP 配置对象')
}

const openMcpJsonPreview = async (item: Mcp) => {
  if (!activeLineId.value) {
    return
  }

  const sourcePath = resolveMcpSourcePath(item)
  if (!sourcePath) {
    message.error('未找到 MCP 源配置路径')
    return
  }

  mcpJsonPreviewModalOpen.value = true
  loadingMcpJsonPreview.value = true
  mcpJsonPreviewItem.value = item
  mcpJsonPreviewName.value = item.name
  mcpJsonPreviewSourcePath.value = sourcePath
  mcpJsonPreviewError.value = ''
  mcpJsonPreviewDraft.value = ''

  try {
    const response = await businessLinesApi.getLocalMcpConfig(activeLineId.value, {
      name: item.name,
      sourcePath,
    })
    mcpJsonPreviewDraft.value = JSON.stringify(
      {
        mcpServers: {
          [response.name]: response.config,
        },
      },
      null,
      2,
    )
  } catch (error) {
    mcpJsonPreviewError.value = toErrorMessage(error, '读取 MCP JSON 失败')
  } finally {
    loadingMcpJsonPreview.value = false
  }
}

const removingLocalMcpId = ref('')
const removeLocalMcp = async (item: Mcp) => {
  if (!activeLineId.value || removingLocalMcpId.value) {
    return
  }

  const sourcePath = resolveMcpSourcePath(item)
  if (!sourcePath) {
    message.error('未找到 MCP 源配置路径')
    return
  }

  if (!window.confirm(`确认删除 MCP「${item.name}」吗？`)) {
    return
  }

  removingLocalMcpId.value = item.id

  try {
    await businessLinesApi.removeLocalMcp(activeLineId.value, {
      name: item.name,
      sourcePath,
    })
    if (mcpJsonPreviewItem.value?.id === item.id) {
      resetMcpJsonPreviewState()
    }
    await loadLocalMcps(activeLineId.value)
    message.success(`MCP「${item.name}」已删除`)
  } catch (error) {
    message.error(toErrorMessage(error, '删除 MCP 失败'))
  } finally {
    removingLocalMcpId.value = ''
  }
}

const saveMcpJsonPreview = async () => {
  if (!activeLineId.value || !mcpJsonPreviewName.value) {
    return
  }

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(mcpJsonPreviewDraft.value)
  } catch {
    mcpJsonPreviewError.value = 'JSON 格式不合法'
    return
  }

  let nextConfig: Record<string, unknown>
  try {
    nextConfig = resolveMcpConfigFromDraft(parsedPayload, mcpJsonPreviewName.value)
  } catch (error) {
    mcpJsonPreviewError.value = error instanceof Error ? error.message : '无法解析 MCP 配置'
    return
  }

  if (Object.prototype.hasOwnProperty.call(nextConfig, 'description')) {
    delete nextConfig.description
  }

  savingMcpJsonPreview.value = true
  mcpJsonPreviewError.value = ''

  try {
    await businessLinesApi.importLocalMcps(activeLineId.value, {
      payload: {
        mcpServers: {
          [mcpJsonPreviewName.value]: nextConfig,
        },
      },
    })

    const refreshed = await businessLinesApi.getLocalMcpConfig(activeLineId.value, {
      name: mcpJsonPreviewName.value,
      sourcePath: mcpJsonPreviewSourcePath.value,
    })
    mcpJsonPreviewDraft.value = JSON.stringify(
      {
        mcpServers: {
          [refreshed.name]: refreshed.config,
        },
      },
      null,
      2,
    )
    await loadLocalMcps(activeLineId.value)
    message.success(`MCP「${mcpJsonPreviewName.value}」保存成功`)
    resetMcpJsonPreviewState()
  } catch (error) {
    mcpJsonPreviewError.value = toErrorMessage(error, '保存 MCP JSON 失败')
  } finally {
    savingMcpJsonPreview.value = false
  }
}

const displayUserLabel = (userId: string) => {
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

const displayBusinessLineRoleLabel = (member: BusinessLineMember) => {
  if (member.customRoleName?.trim()) {
    return member.customRoleName
  }

  return member.roleId
}

const roleBadgeClass = (role: string) => {
  const normalizedRole = role.trim().toLowerCase()

  if (normalizedRole === 'owner') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
  }

  if (normalizedRole === 'admin') {
    return 'border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300'
  }

  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
}

const tabClass = (tab: MainTab) => {
  return tab === activeTab.value
    ? 'bg-background text-foreground shadow-sm'
    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
}

const permissionRoleTabClass = (tab: PermissionRoleTab) => {
  return tab === activePermissionRoleTab.value
    ? 'border border-border bg-background text-foreground shadow-sm shadow-primary/5'
    : 'border border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground'
}

const isMemberAccessTab = (tab: MainTab = activeTab.value) => {
  return tab === 'members' || tab === 'permissions'
}

const resetTabErrors = () => {
  lineFormError.value = ''
  projectFormError.value = ''
  memberPermissionModalError.value = ''
  permissionProjectRoleModalError.value = ''
  agentCliValidationMessage.value = ''
  workflowValidationMessage.value = ''
  mcpJsonImportError.value = ''
  mcpJsonPreviewError.value = ''
}

const closeModal = () => {
  emit('close')
}

const goToMainPage = () => {
  void router.push({ name: 'home' })
}

const openProjectsListPage = () => {
  void router.push({ path: '/projects' })
}

const isCurrentProject = (projectId: string) => {
  return projectId === props.selectedProjectId
}

const selectCurrentProject = (project: ProjectItem) => {
  emit('select-line', project.businessLineId)
  emit('select-project', project.id)
}

const loadLineDetail = async (lineId: string) => {
  if (!lineId) {
    lineDetail.value = null
    return
  }

  loadingLineDetail.value = true

  try {
    const detail = await businessLinesApi.detail(lineId)
    if (lineId !== activeLineId.value) {
      return
    }

    lineDetail.value = detail
  } catch (error) {
    if (lineId === activeLineId.value) {
      message.error(toErrorMessage(error, '加载业务线详情失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingLineDetail.value = false
    }
  }
}

const loadLineProjects = async (lineId: string) => {
  if (!lineId) {
    lineProjects.value = []
    return
  }

  loadingProjects.value = true

  try {
    const response = await fetchAllPages((page, limit) =>
      projectsApi.list({
        page,
        limit,
        businessLineId: lineId,
      }),
    )

    if (lineId !== activeLineId.value) {
      return
    }

    lineProjects.value = response
      .map((project) => mapProjectItem(project))
      .sort((left, right) => left.name.localeCompare(right.name))
  } catch (error) {
    if (lineId === activeLineId.value) {
      lineProjects.value = []
      message.error(toErrorMessage(error, '加载项目失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingProjects.value = false
    }
  }
}

const loadLineMembers = async (lineId: string) => {
  if (!lineId) {
    lineMembers.value = []
    lineCustomRoles.value = []
    return
  }

  loadingMembers.value = true

  try {
    const members = await businessLinesApi.listMembers(lineId)
    if (lineId !== activeLineId.value) {
      return
    }

    lineMembers.value = members
  } catch (error) {
    if (lineId === activeLineId.value) {
      lineMembers.value = []
      message.error(toErrorMessage(error, '加载业务线成员失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingMembers.value = false
    }
  }
}

const loadLineCustomRoles = async (lineId: string) => {
  if (!lineId) {
    lineCustomRoles.value = []
    return
  }

  loadingCustomRoles.value = true

  try {
    const roles = await businessLinesApi.listCustomRoles(lineId)
    if (lineId !== activeLineId.value) {
      return
    }

    lineCustomRoles.value = roles
  } catch (error) {
    if (lineId === activeLineId.value) {
      lineCustomRoles.value = []
      message.error(toErrorMessage(error, '加载业务线角色失败'))
    }
  } finally {
    if (lineId === activeLineId.value) {
      loadingCustomRoles.value = false
    }
  }
}

const loadUsers = async () => {
  if (loadingUsers.value) {
    return
  }

  loadingUsers.value = true

  try {
    users.value = await fetchAllPages((page, limit) => usersApi.list({ page, limit }))
  } catch (error) {
    message.error(toErrorMessage(error, '加载用户列表失败'))
  } finally {
    loadingUsers.value = false
  }
}

const loadLineContext = async ({ includeMembers = false }: { includeMembers?: boolean } = {}) => {
  if (!activeLineId.value) {
    lineDetail.value = null
    lineProjects.value = []
    lineMembers.value = []
    lineCustomRoles.value = []
    return
  }

  const lineId = activeLineId.value
  await Promise.all([loadLineDetail(lineId), loadLineProjects(lineId)])

  if (includeMembers) {
    await Promise.all([loadLineMembers(lineId), loadLineCustomRoles(lineId)])
  }
}

const refreshForCurrentLine = async ({
  includeMembers = false,
}: { includeMembers?: boolean } = {}) => {
  emit('request-refresh')
  await loadLineContext({ includeMembers })
}

const openCreateLineModal = () => {
  if (!props.canCreateBusinessLine) {
    return
  }

  lineFormMode.value = 'create'
  lineFormInitialName.value = ''
  lineFormInitialDescription.value = ''
  lineFormError.value = ''
  lineFormModalOpen.value = true
}

const openEditLineModal = () => {
  if (!activeLineId.value || !canManageActiveLine.value) {
    return
  }

  lineFormMode.value = 'edit'
  lineFormInitialName.value = selectedLineName.value
  lineFormInitialDescription.value = selectedLineDescription.value ?? ''
  lineFormError.value = ''
  lineFormModalOpen.value = true
}

const submitLineForm = async (payload: { name: string; description: string }) => {
  lineFormSubmitting.value = true
  lineFormError.value = ''

  try {
    if (lineFormMode.value === 'create') {
      const created = await businessLinesApi.create({
        name: payload.name.trim(),
        description: normalizeOptionalText(payload.description),
      })

      activeLineId.value = created.id
      emit('select-line', created.id)
      activeTab.value = 'projects'
    } else {
      if (!activeLineId.value || !canManageActiveLine.value) {
        return
      }

      await businessLinesApi.update(activeLineId.value, {
        name: payload.name.trim(),
        description: payload.description.trim(),
      })
    }

    lineFormModalOpen.value = false
    await refreshForCurrentLine({ includeMembers: isMemberAccessTab() })
    message.success(lineFormMode.value === 'create' ? '创建业务线成功' : '保存业务线成功')
  } catch (error) {
    message.error(toErrorMessage(error, '保存业务线失败'))
  } finally {
    lineFormSubmitting.value = false
  }
}

const openCreateProjectModal = () => {
  if (!activeLineId.value || !canCreateProjectItem.value) {
    return
  }

  projectFormMode.value = 'create'
  editingProjectId.value = ''
  projectFormInitialName.value = ''
  projectFormInitialDescription.value = ''
  projectFormInitialGitUrl.value = ''
  projectFormInitialDefaultBranch.value = 'main'
  projectFormInitialContainerRuntime.value = null
  projectFormInitialRunnerTemplate.value = null
  projectFormInitialConfigJson.value = null
  projectFormError.value = ''
  projectFormModalOpen.value = true
}

const openEditProjectModal = (project: ProjectItem) => {
  if (!canUpdateProjectItem.value) {
    return
  }

  projectFormMode.value = 'edit'
  editingProjectId.value = project.id
  projectFormInitialName.value = project.name
  projectFormInitialDescription.value = project.description ?? ''
  projectFormInitialGitUrl.value = project.gitUrl
  projectFormInitialDefaultBranch.value = project.defaultBranch
  projectFormInitialContainerRuntime.value =
    project.configJson?.containerRuntime &&
    typeof project.configJson.containerRuntime === 'object' &&
    !Array.isArray(project.configJson.containerRuntime)
      ? (project.configJson.containerRuntime as ProjectContainerRuntimeConfig)
      : null
  projectFormInitialRunnerTemplate.value =
    project.configJson?.runnerTemplate &&
    typeof project.configJson.runnerTemplate === 'object' &&
    !Array.isArray(project.configJson.runnerTemplate)
      ? (project.configJson.runnerTemplate as ProjectRunnerTemplateConfig)
      : null
  projectFormInitialConfigJson.value =
    project.configJson && typeof project.configJson === 'object' && !Array.isArray(project.configJson)
      ? project.configJson
      : null
  projectFormError.value = ''
  projectFormModalOpen.value = true
}

const submitProjectForm = async (payload: {
  name: string
  description: string
  gitUrl: string
  defaultBranch: string
  containerRuntime?: ProjectContainerRuntimeConfig
  runnerTemplate?: ProjectRunnerTemplateConfig
}) => {
  if (!activeLineId.value) {
    return
  }

  projectFormSubmitting.value = true
  projectFormError.value = ''

  try {
    projectContainerRuntimeForm.syncFromContainerRuntime(payload.containerRuntime)
    projectRunnerTemplateForm.syncFromRunnerTemplate(payload.runnerTemplate)

    if (projectFormMode.value === 'create') {
      if (!canCreateProjectItem.value) {
        return
      }
      await projectsApi.create({
        businessLineId: activeLineId.value,
        name: payload.name.trim(),
        description: normalizeOptionalText(payload.description),
        gitUrl: payload.gitUrl.trim(),
        defaultBranch: payload.defaultBranch.trim() || 'main',
        configJson: projectRunnerTemplateForm.buildProjectConfigJson(
          projectContainerRuntimeForm.buildProjectConfigJson(undefined),
        ),
      })
    } else {
      if (!editingProjectId.value || !canUpdateProjectItem.value) {
        return
      }

      await projectsApi.update(editingProjectId.value, {
        name: payload.name.trim(),
        description: payload.description.trim(),
        gitUrl: payload.gitUrl.trim(),
        defaultBranch: payload.defaultBranch.trim() || 'main',
        configJson: projectRunnerTemplateForm.buildProjectConfigJson(
          projectContainerRuntimeForm.buildProjectConfigJson(projectFormInitialConfigJson.value),
        ),
      })
    }

    projectFormModalOpen.value = false
    await refreshForCurrentLine({ includeMembers: isMemberAccessTab() })
    message.success(projectFormMode.value === 'create' ? '新建项目成功' : '保存项目成功')
  } catch (error) {
    const errMsg = toErrorMessage(error, '保存项目失败')
    projectFormError.value = errMsg
    message.error(errMsg)
  } finally {
    projectFormSubmitting.value = false
  }
}

const openProjectDeleteModal = (project: ProjectItem) => {
  if (!canDeleteProjectItem.value) {
    return
  }

  deletingProjectTarget.value = project
  projectDeleteModalOpen.value = true
}

const confirmDeleteProject = async () => {
  if (!deletingProjectTarget.value || !canDeleteProjectItem.value) {
    return
  }

  deletingProject.value = true

  try {
    await projectsApi.remove(deletingProjectTarget.value.id)
    projectDeleteModalOpen.value = false
    deletingProjectTarget.value = null
    await refreshForCurrentLine({ includeMembers: isMemberAccessTab() })
    message.success('删除项目成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除项目失败'))
  } finally {
    deletingProject.value = false
  }
}

const buildInviteUrl = (token: string) => {
  const inviteUrl = new URL('/business-lines/invite', window.location.origin)
  inviteUrl.searchParams.set('token', token)
  return inviteUrl.toString()
}

const applyInviteToCreateMemberModal = (invite: BusinessLineInvite | null) => {
  if (!invite) {
    memberPermissionInitialBusinessRole.value = 'member'
    memberPermissionInitialProjectRoles.value = {}
    memberInvitationLink.value = ''
    memberInvitationExpiresAt.value = ''
    return
  }

  memberPermissionInitialBusinessRole.value = invite.roleId
  memberPermissionInitialProjectRoles.value = {}
  memberInvitationLink.value = buildInviteUrl(invite.token)
  memberInvitationExpiresAt.value = invite.expiresAt
}

const loadLatestInviteForCreateMemberModal = async (businessLineId: string) => {
  const latestInvite = await businessLinesApi.getLatestInvitation(businessLineId)
  applyInviteToCreateMemberModal(latestInvite)
  return latestInvite
}

const openCreateMemberModal = async () => {
  if (!activeLineId.value || !canInviteMembers.value) {
    return
  }

  const businessLineId = activeLineId.value
  memberPermissionModalMode.value = 'create'
  memberPermissionInitialUserId.value = ''
  memberPermissionInitialBusinessRole.value = 'member'
  memberPermissionInitialProjectRoles.value = {}
  memberPermissionModalPreparing.value = true
  memberPermissionModalError.value = ''
  memberInvitationLink.value = ''
  memberInvitationExpiresAt.value = ''
  memberPermissionModalOpen.value = true

  try {
    await loadLatestInviteForCreateMemberModal(businessLineId)
  } catch (error) {
    message.error(toErrorMessage(error, '加载最近邀请链接失败'))
  } finally {
    memberPermissionModalPreparing.value = false
  }
}

const openEditMemberModal = async (member: BusinessLineMember) => {
  if (!activeLineId.value || !canUpdateMemberRole.value) {
    return
  }

  memberPermissionModalMode.value = 'edit'
  memberPermissionInitialUserId.value = member.userId
  memberPermissionInitialBusinessRole.value = member.roleId
  memberPermissionInitialProjectRoles.value = {}
  memberPermissionModalPreparing.value = true
  memberPermissionModalError.value = ''
  memberPermissionModalOpen.value = true

  try {
    if (users.value.length === 0) {
      await loadUsers()
    }

    if (permissionProjectRoleLibrary.value.length === 0) {
      await loadPermissionProjectCustomRoles(activeLineId.value)
    }

    const response = await businessLinesApi.getMemberProjectRoles(activeLineId.value, member.userId)
    const nextProjectRoles: Record<string, ProjectRoleSelection> = {}

    for (const project of lineProjects.value) {
      nextProjectRoles[project.id] = response.projectRoles[project.id] ?? PROJECT_ROLE_NONE_VALUE
    }

    memberPermissionInitialProjectRoles.value = nextProjectRoles
  } catch (error) {
    message.error(toErrorMessage(error, '加载成员项目角色失败'))
  } finally {
    memberPermissionModalPreparing.value = false
  }
}

const submitMemberPermission = async (
  payload:
    | {
        mode: 'create'
        businessRole: string
        projectRoles: Record<string, ProjectRoleSelection>
      }
    | {
        mode: 'edit'
        userId: string
        businessRole: string
        projectRoles: Record<string, ProjectRoleSelection>
      },
) => {
  const canSubmit = payload.mode === 'create' ? canInviteMembers.value : canUpdateMemberRole.value
  if (!activeLineId.value || !canSubmit) {
    return
  }

  memberPermissionModalSubmitting.value = true
  memberPermissionModalError.value = ''

  try {
    if (payload.mode === 'create') {
      const businessLineId = activeLineId.value
      const createdInvite = await businessLinesApi.createInvitation(businessLineId, {
        roleId: payload.businessRole,
        projectRoles: {},
      })

      try {
        const latestInvite = await loadLatestInviteForCreateMemberModal(businessLineId)
        if (!latestInvite) {
          applyInviteToCreateMemberModal(createdInvite)
        }
      } catch (error) {
        void error
        applyInviteToCreateMemberModal(createdInvite)
      }

      message.success('邀请链接已生成')
      return
    } else {
      await businessLinesApi.updateMember(activeLineId.value, payload.userId, {
        roleId: payload.businessRole,
        projectRoles: payload.projectRoles,
      })

      memberPermissionModalOpen.value = false
      await refreshForCurrentLine({ includeMembers: true })
      message.success('保存成员权限成功')
    }
  } catch (error) {
    message.error(
      toErrorMessage(error, payload.mode === 'create' ? '生成邀请链接失败' : '保存成员权限失败'),
    )
  } finally {
    memberPermissionModalSubmitting.value = false
  }
}

const openCreateCustomRoleModal = () => {
  if (!activeLineId.value || !canCreateBusinessLineRole.value) {
    return
  }

  customRoleModalMode.value = 'create'
  editingCustomRoleId.value = ''
  customRoleInitialName.value = ''
  customRoleInitialDescription.value = ''
  customRoleInitialCapabilities.value = ['businessLine.read']
  customRoleModalError.value = ''
  customRoleModalOpen.value = true
}

const openEditCustomRoleModal = (role: BusinessLineCustomRole) => {
  if (!activeLineId.value || !canUpdateBusinessLineRole.value) {
    return
  }

  customRoleModalMode.value = 'edit'
  editingCustomRoleId.value = role.id
  customRoleInitialName.value = role.name
  customRoleInitialDescription.value = role.description ?? ''
  customRoleInitialCapabilities.value = [...role.capabilities]
  customRoleModalError.value = ''
  customRoleModalOpen.value = true
}

const submitCustomRole = async (payload: {
  name: string
  description: string
  capabilities: string[]
}) => {
  const canSubmit =
    customRoleModalMode.value === 'create'
      ? canCreateBusinessLineRole.value
      : canUpdateBusinessLineRole.value
  if (!activeLineId.value || !canSubmit) {
    return
  }

  customRoleModalSubmitting.value = true
  customRoleModalError.value = ''

  try {
    const requestPayload = {
      name: payload.name.trim(),
      description: normalizeOptionalText(payload.description),
      capabilities: [...payload.capabilities],
    }

    if (customRoleModalMode.value === 'edit' && editingCustomRoleId.value) {
      await businessLinesApi.updateCustomRole(
        activeLineId.value,
        editingCustomRoleId.value,
        requestPayload,
      )
    } else {
      await businessLinesApi.createCustomRole(activeLineId.value, requestPayload)
    }

    customRoleModalOpen.value = false
    await loadLineCustomRoles(activeLineId.value)
    message.success(customRoleModalMode.value === 'edit' ? '保存角色成功' : '创建角色成功')
  } catch (error) {
    customRoleModalError.value = toErrorMessage(error, '保存自定义角色失败')
  } finally {
    customRoleModalSubmitting.value = false
  }
}

const removeCustomRole = async (role: BusinessLineCustomRole) => {
  if (!activeLineId.value || !canDeleteBusinessLineRole.value || deletingCustomRoleId.value) {
    return
  }

  const confirmed = window.confirm(`确认删除自定义角色「${role.name}」吗？`)
  if (!confirmed) {
    return
  }

  deletingCustomRoleId.value = role.id

  try {
    await businessLinesApi.removeCustomRole(activeLineId.value, role.id)
    await loadLineCustomRoles(activeLineId.value)
    message.success('删除角色成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除自定义角色失败'))
  } finally {
    deletingCustomRoleId.value = ''
  }
}

const openCreatePermissionProjectRoleModal = () => {
  if (!activeLineId.value || !canManagePermissionProjectRoles.value) {
    return
  }

  permissionProjectRoleModalMode.value = 'create'
  editingPermissionProjectRoleId.value = ''
  permissionProjectRoleInitialName.value = ''
  permissionProjectRoleInitialDescription.value = ''
  permissionProjectRoleInitialCapabilities.value = [
    'project.dashboard.read',
    'project.task.read',
    'project.kanban.read',
    'project.automation.read',
    'project.knowledge.read',
    'project.workflow.read',
    'project.skill.read',
    'project.mcp.read',
    'project.git.read',
  ]
  permissionProjectRoleModalError.value = ''
  permissionProjectRoleModalOpen.value = true
}

const openEditPermissionProjectRoleModal = (role: ProjectCustomRole) => {
  if (!activeLineId.value || !canManagePermissionProjectRoles.value) {
    return
  }

  permissionProjectRoleModalMode.value = 'edit'
  editingPermissionProjectRoleId.value = role.id
  permissionProjectRoleInitialName.value = role.name
  permissionProjectRoleInitialDescription.value = role.description ?? ''
  permissionProjectRoleInitialCapabilities.value = [...role.capabilities]
  permissionProjectRoleModalError.value = ''
  permissionProjectRoleModalOpen.value = true
}

const submitPermissionProjectRole = async (payload: {
  name: string
  description: string
  capabilities: string[]
}) => {
  if (!activeLineId.value || !canManagePermissionProjectRoles.value) {
    return
  }

  permissionProjectRoleModalSubmitting.value = true
  permissionProjectRoleModalError.value = ''

  try {
    const requestPayload = {
      name: payload.name.trim(),
      description: normalizeOptionalText(payload.description),
      capabilities: [...payload.capabilities],
    }

    if (permissionProjectRoleModalMode.value === 'edit' && editingPermissionProjectRoleId.value) {
      await businessLinesApi.updateProjectCustomRole(
        activeLineId.value,
        editingPermissionProjectRoleId.value,
        requestPayload,
      )
    } else {
      await businessLinesApi.createProjectCustomRole(activeLineId.value, requestPayload)
    }

    permissionProjectRoleModalOpen.value = false
    await loadPermissionProjectCustomRoles(activeLineId.value)
    message.success(
      permissionProjectRoleModalMode.value === 'edit' ? '保存项目角色成功' : '创建项目角色成功',
    )
  } catch (error) {
    permissionProjectRoleModalError.value = toErrorMessage(error, '保存项目角色失败')
  } finally {
    permissionProjectRoleModalSubmitting.value = false
  }
}

const removePermissionProjectRole = async (role: ProjectCustomRole) => {
  if (
    !activeLineId.value ||
    !canManagePermissionProjectRoles.value ||
    deletingPermissionProjectRoleId.value
  ) {
    return
  }

  const confirmed = window.confirm(`确认删除项目角色「${role.name}」吗？`)
  if (!confirmed) {
    return
  }

  deletingPermissionProjectRoleId.value = role.id

  try {
    await businessLinesApi.removeProjectCustomRole(activeLineId.value, role.id)
    await loadPermissionProjectCustomRoles(activeLineId.value)
    message.success('删除项目角色成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除项目角色失败'))
  } finally {
    deletingPermissionProjectRoleId.value = ''
  }
}

const refreshLinePermissionSection = async () => {
  if (!activeLineId.value) {
    return
  }

  await Promise.all([
    loadLineCustomRoles(activeLineId.value),
    loadPermissionProjectCustomRoles(activeLineId.value),
  ])
}

const refreshMemberAccessSection = async () => {
  if (!activeLineId.value) {
    return
  }

  await Promise.all([loadLineMembers(activeLineId.value), loadLineCustomRoles(activeLineId.value)])
}

const openRemoveMemberModal = (member: BusinessLineMember) => {
  if (!canRemoveMembers.value) {
    return
  }

  removingMemberTarget.value = member
  memberRemoveModalOpen.value = true
}

const confirmRemoveMember = async () => {
  if (!activeLineId.value || !removingMemberTarget.value || !canRemoveMembers.value) {
    return
  }

  removingMember.value = true

  try {
    await businessLinesApi.removeMember(activeLineId.value, removingMemberTarget.value.userId)
    memberRemoveModalOpen.value = false
    removingMemberTarget.value = null
    await refreshForCurrentLine({ includeMembers: true })
    message.success('移除成员成功')
  } catch (error) {
    message.error(toErrorMessage(error, '移除成员失败'))
  } finally {
    removingMember.value = false
  }
}

const openDeleteLineModal = () => {
  if (!canDeleteLine.value) {
    return
  }

  lineDeleteFinalModalOpen.value = false
  lineDeleteModalOpen.value = true
}

const confirmDeleteLine = async () => {
  if (!activeLineId.value || !canDeleteLine.value) {
    return
  }

  lineDeleteModalOpen.value = false
  lineDeleteFinalModalOpen.value = true
}

const confirmDeleteLineFinal = async () => {
  if (!activeLineId.value || !canDeleteLine.value) {
    return
  }

  deletingLine.value = true
  const removedLineId = activeLineId.value

  try {
    await businessLinesApi.remove(removedLineId)
    lineDeleteModalOpen.value = false
    lineDeleteFinalModalOpen.value = false

    const fallbackLineId = props.lines.find((line) => line.id !== removedLineId)?.id ?? ''
    activeLineId.value = fallbackLineId

    if (fallbackLineId) {
      emit('select-line', fallbackLineId)
    }

    await refreshForCurrentLine({ includeMembers: isMemberAccessTab() })
    message.success('删除业务线成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除业务线失败'))
  } finally {
    deletingLine.value = false
  }
}

const initializePanel = () => {
  resetTabErrors()
  activeTab.value = 'projects'
  projectQuery.value = ''
  memberQuery.value = ''
  activeAgentCliToolId.value = 'cursor-agent'
  agentToolConfigs.value = []
  resetAgentToolConfigForm()
  workflowTemplates.value = []
  workflowConfiguredCliTools.value = []
  workflowNodeConfigsByTool.value = {}
  workflowNodeConfigLoadingByTool.value = {}
  loadingWorkflowConfiguredCliTools.value = false
  localSkills.value = []
  localMcps.value = []
  skillKeyword.value = ''
  uploadSkillModalOpen.value = false
  uploadSkillError.value = ''
  uploadingLocalSkill.value = false
  mcpJsonImportModalOpen.value = false
  importingLocalMcps.value = false
  mcpJsonImportError.value = ''
  resetSkillPreviewState()
  resetMcpJsonPreviewState()
  resetWorkflowCreateForm()
  workflowTemplateModalMode.value = 'create'
  editingWorkflowTemplateId.value = ''

  activeLineId.value = props.activeBusinessLineId || props.lines[0]?.id || ''
  activePermissionRoleTab.value = 'business-line'
  if (activeLineId.value) {
    emit('select-line', activeLineId.value)
    void loadLineAccess(activeLineId.value)
  }

  void loadLineContext({ includeMembers: false })
}

initializePanel()

watch(
  () => props.activeBusinessLineId,
  (lineId) => {
    if (!isPanelActive.value || !lineId || lineId === activeLineId.value) {
      return
    }

    activeLineId.value = lineId
  },
)

watch(
  () => props.lines,
  (lines) => {
    if (!isPanelActive.value) {
      return
    }

    if (lines.some((line) => line.id === activeLineId.value)) {
      return
    }

    activeLineId.value = lines[0]?.id ?? ''
  },
)

watch(
  () => activeLineId.value,
  (lineId, previousLineId) => {
    if (!isPanelActive.value || lineId === previousLineId) {
      return
    }

    projectQuery.value = ''
    memberQuery.value = ''

    if (!lineId) {
      lineDetail.value = null
      lineProjects.value = []
      lineMembers.value = []
      permissionProjectRoleLibrary.value = []
      agentToolConfigs.value = []
      workflowTemplates.value = []
      workflowConfiguredCliTools.value = []
      workflowNodeConfigsByTool.value = {}
      workflowNodeConfigLoadingByTool.value = {}
      loadingWorkflowConfiguredCliTools.value = false
      localSkills.value = []
      localMcps.value = []
      skillKeyword.value = ''
      uploadSkillModalOpen.value = false
      uploadSkillError.value = ''
      uploadingLocalSkill.value = false
      mcpJsonImportModalOpen.value = false
      importingLocalMcps.value = false
      mcpJsonImportError.value = ''
      resetSkillPreviewState()
      resetMcpJsonPreviewState()
      resetAgentToolConfigForm()
      resetWorkflowCreateForm()
      workflowTemplateModalMode.value = 'create'
      editingWorkflowTemplateId.value = ''
      return
    }

    workflowConfiguredCliTools.value = []
    workflowNodeConfigsByTool.value = {}
    workflowNodeConfigLoadingByTool.value = {}
    loadingWorkflowConfiguredCliTools.value = false
    permissionProjectRoleLibrary.value = []
    emit('select-line', lineId)
    void loadLineAccess(lineId)
    void loadLineContext({ includeMembers: isMemberAccessTab() })
    if (activeTab.value === 'agent-cli') {
      void loadAgentToolConfigs(lineId, activeAgentCliToolId.value)
    } else if (activeTab.value === 'workflow') {
      void loadWorkflowTemplates(lineId)
    } else if (activeTab.value === 'skill') {
      void loadLocalSkills(lineId)
    } else if (activeTab.value === 'mcp') {
      void loadLocalMcps(lineId)
    }
  },
)

watch(
  () => activeTab.value,
  (tab) => {
    if (!isPanelActive.value || !activeLineId.value) {
      return
    }

    if (tab === 'projects') {
      void loadLineProjects(activeLineId.value)
      return
    }

    if (tab === 'members') {
      void Promise.all([
        loadLineMembers(activeLineId.value),
        loadLineCustomRoles(activeLineId.value),
        loadUsers(),
      ])
      return
    }

    if (tab === 'permissions') {
      void Promise.all([
        loadLineCustomRoles(activeLineId.value),
        loadPermissionProjectCustomRoles(activeLineId.value),
      ])
      return
    }

    if (tab === 'agent-cli') {
      resetAgentToolConfigForm()
      void loadAgentToolConfigs(activeLineId.value, activeAgentCliToolId.value)
      return
    }

    if (tab === 'workflow') {
      void Promise.all([
        loadWorkflowTemplates(activeLineId.value),
        loadWorkflowConfiguredCliTools(activeLineId.value),
      ])
      return
    }

    if (tab === 'skill') {
      void loadLocalSkills(activeLineId.value)
      return
    }

    if (tab === 'mcp') {
      void loadLocalMcps(activeLineId.value)
      return
    }

    void loadLineDetail(activeLineId.value)
  },
)

watch(
  () => [isPanelActive.value, activeTab.value, activeLineId.value] as const,
  ([active, tab]) => {
    if (!active || tab !== 'permissions') {
      return
    }

    if (!activeLineId.value) {
      permissionProjectRoleLibrary.value = []
      return
    }

    void loadPermissionProjectCustomRoles(activeLineId.value)
  },
)

watch(
  () => activeAgentCliToolId.value,
  (toolId, previousToolId) => {
    if (!isPanelActive.value || toolId === previousToolId) {
      return
    }

    resetAgentToolConfigForm()

    if (activeTab.value !== 'agent-cli' || !activeLineId.value) {
      return
    }

    void loadAgentToolConfigs(activeLineId.value, toolId)
  },
)

</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col">
    <section
      :aria-modal="isModalMode || undefined"
      :role="isModalMode ? 'dialog' : 'region'"
      aria-labelledby="business-line-modal-title"
      class="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
        <div class="grid min-h-0 flex-1 grid-cols-1 lg:h-full lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside
            class="flex min-h-0 flex-col border-b border-border bg-muted/30 lg:border-r lg:border-b-0"
          >
            <header class="flex h-16 items-center border-b border-border px-4">
              <h2 class="text-sm font-semibold">业务线</h2>
            </header>

            <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              <button
                v-for="line in props.lines"
                :key="line.id"
                type="button"
                class="w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="
                  line.id === activeLineId
                    ? 'border-primary/45 bg-primary/8 shadow-sm'
                    : 'border-border bg-background hover:bg-muted/40'
                "
                @click="activeLineId = line.id"
              >
                <p class="text-sm font-semibold text-foreground">{{ line.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ line.description || '暂无描述' }}
                </p>
                <p class="mt-2 text-xs text-muted-foreground">项目 {{ line.projectCount }}</p>
              </button>

              <div
                v-if="props.lines.length === 0"
                class="rounded-xl border border-dashed border-border bg-background/70 px-3 py-4 text-sm text-muted-foreground"
              >
                暂无业务线
              </div>
            </div>

            <footer class="border-t border-border p-3">
              <button
                type="button"
                class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!props.canCreateBusinessLine"
                :title="props.canCreateBusinessLine ? '创建业务线' : '当前账号暂无创建业务线权限'"
                @click="openCreateLineModal"
              >
                创建业务线
              </button>
              <p v-if="!props.canCreateBusinessLine" class="mt-2 text-[11px] text-muted-foreground">
                当前账号暂无创建业务线权限
              </p>
            </footer>
          </aside>

          <div class="flex min-h-0 flex-1 flex-col">
            <header class="flex h-16 items-center justify-between border-b border-border px-5">
              <div>
                <p class="text-xs font-semibold tracking-wide text-muted-foreground">业务线管理</p>
                <h2 id="business-line-modal-title" class="text-sm font-semibold">
                  {{ selectedLineName }}
                </h2>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="!isModalMode"
                  type="button"
                  aria-label="返回主页面"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
                  @click="goToMainPage"
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
                <button
                  v-if="isModalMode"
                  type="button"
                  aria-label="关闭"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
                  @click="closeModal"
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
              </div>
            </header>

            <div class="border-b border-border px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('projects')"
                  type="button"
                  @click="activeTab = 'projects'"
                >
                  项目
                </button>
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('members')"
                  type="button"
                  @click="activeTab = 'members'"
                >
                  成员
                </button>
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('permissions')"
                  type="button"
                  @click="activeTab = 'permissions'"
                >
                  权限
                </button>
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('agent-cli')"
                  type="button"
                  @click="activeTab = 'agent-cli'"
                >
                  Agent CLI
                </button>
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('workflow')"
                  type="button"
                  @click="activeTab = 'workflow'"
                >
                  工作流
                </button>
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('skill')"
                  type="button"
                  @click="activeTab = 'skill'"
                >
                  Skills
                </button>
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('mcp')"
                  type="button"
                  @click="activeTab = 'mcp'"
                >
                  MCP
                </button>
                <button
                  class="rounded-xl px-4 py-2 text-sm font-semibold transition"
                  :class="tabClass('settings')"
                  type="button"
                  @click="activeTab = 'settings'"
                >
                  设置
                </button>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto p-4">
              <section v-if="activeTab === 'projects'" class="space-y-4">
                <div class="panel-card p-4">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-semibold">项目列表（{{ filteredProjects.length }}）</p>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        @click="openProjectsListPage"
                      >
                        查看项目列表
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        @click="loadLineProjects(activeLineId)"
                      >
                        刷新
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId || !canCreateProjectItem"
                        @click="openCreateProjectModal"
                      >
                        新建项目
                      </button>
                    </div>
                  </div>

                  <input
                    v-model="projectQuery"
                    type="search"
                    class="mt-4 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="按项目名 / ID / 描述 / Git 地址搜索"
                  />

                  <div v-if="loadingProjects" class="mt-4 text-sm text-muted-foreground">
                    加载项目中...
                  </div>

                  <div v-else class="mt-4 space-y-2">
                    <article
                      v-for="project in filteredProjects"
                      :key="project.id"
                      :data-project-id="project.id"
                      class="cursor-pointer rounded-xl border px-4 py-3"
                      :class="
                        isCurrentProject(project.id)
                          ? 'border-primary/45 bg-primary/8 shadow-sm'
                          : 'border-border bg-background/70'
                      "
                      role="button"
                      tabindex="0"
                      @click="selectCurrentProject(project)"
                      @keydown.enter.prevent="selectCurrentProject(project)"
                      @keydown.space.prevent="selectCurrentProject(project)"
                    >
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <p class="text-sm font-semibold text-foreground">{{ project.name }}</p>
                            <span
                              v-if="isCurrentProject(project.id)"
                              class="inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                            >
                              当前项目
                            </span>
                          </div>
                          <p class="text-xs text-muted-foreground">
                            {{ project.description || '暂无描述' }}
                          </p>
                          <p class="font-mono text-[11px] text-muted-foreground">
                            {{ project.gitUrl }}
                          </p>
                          <p class="text-xs text-muted-foreground">
                            默认分支：{{ project.defaultBranch }}
                          </p>
                        </div>

                        <div class="flex items-center gap-2">
                          <button
                            v-if="canUpdateProjectItem"
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                            @click.stop="openEditProjectModal(project)"
                          >
                            编辑
                          </button>
                          <button
                            v-if="canDeleteProjectItem"
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                            @click.stop="openProjectDeleteModal(project)"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </article>

                    <div
                      v-if="!loadingProjects && filteredProjects.length === 0"
                      class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground"
                    >
                      当前业务线暂无项目。
                    </div>
                  </div>
                </div>
              </section>

              <section v-else-if="activeTab === 'members'" class="space-y-4">
                <div class="panel-card p-4">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold">成员列表（{{ filteredMembers.length }}）</p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        管理业务线成员，并为成员分配默认角色或自定义角色。
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        @click="refreshMemberAccessSection"
                      >
                        刷新
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId || !canInviteMembers"
                        @click="openCreateMemberModal"
                      >
                        邀请成员
                      </button>
                    </div>
                  </div>

                  <input
                    v-model="memberQuery"
                    type="search"
                    class="mt-4 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="按成员名 / 用户名 / 用户 ID 搜索"
                  />

                  <div v-if="loadingMembers" class="mt-4 text-sm text-muted-foreground">
                    加载成员中...
                  </div>

                  <div v-else class="mt-4 overflow-x-auto">
                    <table class="w-full min-w-[760px] text-left text-sm">
                      <thead class="border-b border-border bg-background/70">
                        <tr class="text-xs font-semibold text-muted-foreground">
                          <th class="px-4 py-3">成员</th>
                          <th class="px-4 py-3">业务线角色</th>
                          <th class="px-4 py-3">最近更新时间</th>
                          <th class="px-4 py-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-border">
                        <tr
                          v-for="member in filteredMembers"
                          :key="member.id"
                          class="transition hover:bg-background/70"
                        >
                          <td class="px-4 py-3">
                            <p class="text-sm font-semibold">
                              {{ displayUserLabel(member.userId) }}
                            </p>
                            <p class="mt-0.5 text-xs text-muted-foreground">
                              {{ displayUserMeta(member.userId) }}
                            </p>
                            <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {{ member.userId }}
                            </p>
                          </td>
                          <td class="px-4 py-3">
                            <span
                              class="inline-flex rounded-full border px-2 py-1 text-xs font-semibold"
                              :class="roleBadgeClass(displayBusinessLineRoleLabel(member))"
                            >
                              {{ displayBusinessLineRoleLabel(member) }}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-muted-foreground">
                            {{ formatDate(member.updatedAt) }}
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex justify-end gap-2">
                              <button
                                v-if="canUpdateMemberRole"
                                type="button"
                                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                                @click="openEditMemberModal(member)"
                              >
                                编辑角色
                              </button>
                              <button
                                v-if="canRemoveMembers"
                                type="button"
                                class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                                @click="openRemoveMemberModal(member)"
                              >
                                移除
                              </button>
                            </div>
                          </td>
                        </tr>

                        <tr v-if="!loadingMembers && filteredMembers.length === 0">
                          <td colspan="4" class="px-4 py-5 text-sm text-muted-foreground">
                            暂无成员，请先邀请。
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section v-else-if="activeTab === 'permissions'" class="space-y-4">
                <div class="flex justify-center sm:justify-start">
                  <div
                    class="inline-flex w-full max-w-md items-center gap-1.5 rounded-2xl border border-border/70 bg-muted/35 p-1.5 shadow-sm sm:w-auto"
                  >
                    <button
                      type="button"
                      class="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none sm:min-w-[132px]"
                      :class="permissionRoleTabClass('business-line')"
                      @click="activePermissionRoleTab = 'business-line'"
                    >
                      业务线角色
                    </button>
                    <button
                      type="button"
                      class="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none sm:min-w-[132px]"
                      :class="permissionRoleTabClass('project')"
                      @click="activePermissionRoleTab = 'project'"
                    >
                      项目角色
                    </button>
                  </div>
                </div>

                <div
                  v-if="activePermissionRoleTab === 'business-line'"
                  class="panel-card space-y-4 p-4"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">角色列表（{{ lineCustomRoles.length }}）</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        @click="refreshLinePermissionSection()"
                      >
                        刷新
                      </button>
                      <button
                        v-if="canCreateBusinessLineRole"
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
                        @click="openCreateCustomRoleModal"
                      >
                        新建
                      </button>
                    </div>
                  </div>

                  <div v-if="loadingCustomRoles" class="text-sm text-muted-foreground">
                    加载业务线角色中...
                  </div>
                  <div
                    v-else-if="lineCustomRoles.length === 0"
                    class="rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
                  >
                    当前暂无业务线角色。
                  </div>
                  <div v-else class="space-y-3">
                    <article
                      v-for="role in lineCustomRoles"
                      :key="role.id"
                      class="rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <p class="text-sm font-semibold">{{ role.name }}</p>
                          </div>
                          <p class="mt-1 text-xs text-muted-foreground">
                            {{
                              formatBusinessLineRoleCapabilitiesDisplay(role.capabilities) ||
                              role.description ||
                              '暂无描述'
                            }}
                          </p>
                        </div>
                        <div
                          v-if="canUpdateBusinessLineRole || canDeleteBusinessLineRole"
                          class="flex shrink-0 items-center gap-2"
                        >
                          <button
                            v-if="canUpdateBusinessLineRole"
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                            @click="openEditCustomRoleModal(role)"
                          >
                            编辑
                          </button>
                          <button
                            v-if="canDeleteBusinessLineRole"
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="deletingCustomRoleId === role.id"
                            @click="removeCustomRole(role)"
                          >
                            {{ deletingCustomRoleId === role.id ? '删除中...' : '删除' }}
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>

                <div v-else class="panel-card space-y-4 p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">
                        角色列表（{{ permissionProjectRoleLibrary.length }}）
                      </p>
                    </div>
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId"
                        @click="activeLineId && loadPermissionProjectCustomRoles(activeLineId)"
                      >
                        刷新
                      </button>
                      <button
                        v-if="canManagePermissionProjectRoles"
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
                        @click="openCreatePermissionProjectRoleModal"
                      >
                        新建
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="!activeLineId"
                    class="rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
                  >
                    请先选择业务线。
                  </div>
                  <div
                    v-else-if="loadingPermissionProjectRoleLibrary"
                    class="text-sm text-muted-foreground"
                  >
                    加载角色列表中...
                  </div>
                  <div
                    v-else-if="permissionProjectRoleLibrary.length === 0"
                    class="rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
                  >
                    当前业务线暂无项目角色。
                  </div>
                  <div v-else class="space-y-3">
                    <article
                      v-for="role in permissionProjectRoleLibrary"
                      :key="role.id"
                      class="rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <p class="text-sm font-semibold">{{ role.name }}</p>
                          </div>
                          <p class="mt-1 text-xs text-muted-foreground">
                            {{
                              formatProjectRoleCapabilitiesDisplay(role.capabilities) ||
                              role.description ||
                              '暂无描述'
                            }}
                          </p>
                        </div>
                        <div
                          v-if="canManagePermissionProjectRoles"
                          class="flex shrink-0 items-center gap-2"
                        >
                          <button
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                            @click="openEditPermissionProjectRoleModal(role)"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="deletingPermissionProjectRoleId === role.id"
                            @click="removePermissionProjectRole(role)"
                          >
                            {{ deletingPermissionProjectRoleId === role.id ? '删除中...' : '删除' }}
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>
              <section v-else-if="activeTab === 'agent-cli'" class="space-y-4">
                <article class="panel-card p-5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold">Agent CLI 配置</p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        业务线统一维护多套 Agent CLI 配置，供同业务线项目复用。
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId"
                        @click="loadAgentToolConfigs(activeLineId, activeAgentCliToolId)"
                      >
                        刷新
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId"
                        @click="openCreateAgentToolConfig"
                      >
                        新建配置
                      </button>
                    </div>
                  </div>

                  <div class="mt-4 flex flex-wrap gap-2">
                    <button
                      v-for="tool in SUPPORTED_CLI_TOOLS"
                      :key="tool.id"
                      type="button"
                      class="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                      :class="
                        activeAgentCliToolId === tool.id
                          ? 'border border-primary/45 bg-primary/12 text-primary shadow-sm'
                          : 'border border-border text-muted-foreground hover:bg-background/60 hover:text-foreground'
                      "
                      @click="activeAgentCliToolId = tool.id"
                    >
                      {{ tool.label }}
                    </button>
                  </div>

                  <div v-if="loadingAgentToolConfigs" class="mt-4 text-sm text-muted-foreground">
                    加载配置中...
                  </div>

                  <div v-else class="mt-4 overflow-x-auto">
                    <table class="w-full min-w-[760px] text-left text-sm">
                      <thead class="border-b border-border bg-background/70">
                        <tr class="text-xs font-semibold text-muted-foreground">
                          <th class="px-4 py-3">名称</th>
                          <th class="px-4 py-3">Tool ID</th>
                          <th class="px-4 py-3">默认</th>
                          <th class="px-4 py-3">更新时间</th>
                          <th class="px-4 py-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-border">
                        <tr
                          v-for="config in agentToolConfigs"
                          :key="config.id"
                          class="transition hover:bg-background/70"
                        >
                          <td class="px-4 py-3">
                            <p class="text-sm font-semibold">{{ config.name }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">
                              {{ config.description || '暂无描述' }}
                            </p>
                          </td>
                          <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {{ config.toolId }}
                          </td>
                          <td class="px-4 py-3">
                            <span
                              v-if="config.isDefault"
                              class="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                            >
                              默认
                            </span>
                            <span v-else class="text-xs text-muted-foreground">-</span>
                          </td>
                          <td class="px-4 py-3 text-muted-foreground">
                            {{ formatDate(config.updatedAt) }}
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex justify-end gap-2">
                              <button
                                type="button"
                                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                                @click="openEditAgentToolConfig(config)"
                              >
                                编辑
                              </button>
                              <button
                                v-if="!config.isDefault"
                                type="button"
                                class="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                                :disabled="submittingAgentToolConfig"
                                @click="setAgentToolConfigAsDefault(config)"
                              >
                                设为默认
                              </button>
                              <button
                                type="button"
                                class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="deletingAgentToolConfigId === config.id"
                                @click="removeAgentToolConfig(config.id)"
                              >
                                {{ deletingAgentToolConfigId === config.id ? '删除中...' : '删除' }}
                              </button>
                            </div>
                          </td>
                        </tr>

                        <tr v-if="!loadingAgentToolConfigs && agentToolConfigs.length === 0">
                          <td colspan="5" class="px-4 py-5 text-sm text-muted-foreground">
                            {{ activeAgentCliToolLabel }} 暂无配置，请先创建。
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </article>
              </section>

              <section v-else-if="activeTab === 'workflow'" class="space-y-4">
                <article class="panel-card p-5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold">工作流模板列表</p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        {{
                          loadingWorkflowTemplates
                            ? '加载中...'
                            : `共 ${workflowTemplates.length} 个`
                        }}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId"
                        @click="openWorkflowCreateModal"
                      >
                        创建模板
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId || loadingWorkflowTemplates"
                        @click="loadWorkflowTemplates(activeLineId)"
                      >
                        刷新
                      </button>
                    </div>
                  </div>

                  <div v-if="loadingWorkflowTemplates" class="mt-3 text-sm text-muted-foreground">
                    加载业务线工作流模板中...
                  </div>

                  <div v-else class="mt-3 overflow-x-auto">
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
                                :data-testid="`workflow-edit-${template.id}`"
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
                        <tr v-if="workflowTemplates.length === 0">
                          <td colspan="3" class="px-3 py-4 text-sm text-muted-foreground">
                            当前业务线暂无工作流模板，请先创建。
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </article>
              </section>

              <section v-else-if="activeTab === 'skill'" class="space-y-4">
                <article class="panel-card p-5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-1 items-center gap-2">
                      <input
                        v-model="skillKeyword"
                        class="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                        placeholder="搜索名称 / 版本 / 说明"
                        type="search"
                        @keydown.enter.prevent="loadLocalSkills(activeLineId)"
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId || loadingLocalSkills"
                        @click="loadLocalSkills(activeLineId)"
                      >
                        刷新
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId || loadingLocalSkills"
                        @click="loadLocalSkills(activeLineId)"
                      >
                        搜索
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId || uploadingLocalSkill"
                        @click="openUploadSkillModal"
                      >
                        上传技能
                      </button>
                    </div>
                  </div>

                  <div v-if="loadingLocalSkills" class="mt-3 text-sm text-muted-foreground">
                    加载业务线本地 Skill 中...
                  </div>

                  <div v-else class="mt-3 space-y-2">
                    <article
                      v-for="item in localSkills"
                      :key="item.id"
                      class="cursor-pointer rounded-xl border border-border bg-background/70 px-4 py-3 transition hover:border-primary/40 hover:bg-muted/30"
                      role="button"
                      tabindex="0"
                      @click="void openSkillPreview(item)"
                      @keydown.enter.prevent="void openSkillPreview(item)"
                      @keydown.space.prevent="void openSkillPreview(item)"
                    >
                      <p class="text-sm font-semibold">{{ item.name }}</p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        {{ item.description ?? '暂无描述' }}
                      </p>
                    </article>

                    <div
                      v-if="localSkills.length === 0"
                      class="rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
                    >
                      当前业务线目录下未发现 Skill 配置。
                    </div>
                  </div>
                </article>
              </section>

              <section v-else-if="activeTab === 'mcp'" class="space-y-4">
                <article class="panel-card p-5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold">MCP 列表</p>
                    </div>
                    <div class="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId || loadingLocalMcps"
                        @click="loadLocalMcps(activeLineId)"
                      >
                        刷新
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId || importingLocalMcps"
                        @click="openImportMcpJsonModal"
                      >
                        添加
                      </button>
                    </div>
                  </div>

                  <div v-if="loadingLocalMcps" class="mt-3 text-sm text-muted-foreground">
                    加载业务线本地 MCP 中...
                  </div>

                  <div v-else class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                    <article
                      v-for="item in localMcps"
                      :key="item.id"
                      :data-mcp-id="item.id"
                      class="flex cursor-pointer flex-col rounded-lg border border-border bg-background/70 px-2.5 py-2 transition hover:border-primary/40 hover:bg-muted/30"
                      role="button"
                      tabindex="0"
                      @click="void openMcpJsonPreview(item)"
                      @keydown.enter.prevent="void openMcpJsonPreview(item)"
                      @keydown.space.prevent="void openMcpJsonPreview(item)"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-xs font-semibold">{{ item.name }}</p>
                        <p
                          v-if="item.version && item.version !== 'local'"
                          class="mt-1 text-[11px] text-muted-foreground"
                        >
                          版本：{{ item.version }}
                        </p>
                        <p
                          v-if="item.description"
                          class="mt-1 line-clamp-1 text-[11px] text-muted-foreground"
                        >
                          {{ item.description }}
                        </p>
                      </div>
                    </article>

                    <div
                      v-if="localMcps.length === 0"
                      class="col-span-full rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground"
                    >
                      当前业务线目录下未发现 MCP 配置。
                    </div>
                  </div>
                </article>
              </section>

              <section v-else class="space-y-4">
                <article class="panel-card p-5">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold">基础信息</p>
                      <p class="mt-1 text-xs text-muted-foreground">编辑当前业务线名称与描述。</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!activeLineId || loadingLineDetail || !canManageActiveLine"
                        @click="openEditLineModal"
                      >
                        编辑信息
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="!canDeleteLine"
                        @click="openDeleteLineModal"
                      >
                        删除业务线
                      </button>
                    </div>
                  </div>

                  <div class="mt-4 space-y-3 rounded-xl border border-border bg-background/70 p-4">
                    <div>
                      <p class="text-xs text-muted-foreground">业务线名称</p>
                      <p class="mt-1 text-sm font-semibold">{{ selectedLineName }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-muted-foreground">描述</p>
                      <p class="mt-1 text-sm text-foreground">
                        {{ selectedLineDescription || '暂无描述' }}
                      </p>
                    </div>
                  </div>
                </article>
              </section>
            </div>
          </div>
        </div>
      </section>

      <div
        v-if="workflowCreateModalOpen"
        class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-line-workflow-create-modal-title"
        @click.self="closeWorkflowCreateModal"
      >
        <section
          class="max-h-[95vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 id="business-line-workflow-create-modal-title" class="text-sm font-semibold">
              {{ workflowTemplateModalTitle }}
            </h3>
            <button
              type="button"
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              aria-label="关闭工作流模板弹窗"
              @click="closeWorkflowCreateModal"
            >
              关闭
            </button>
          </header>

          <form
            class="max-h-[calc(95vh-56px)] space-y-4 overflow-auto px-4 py-4"
            @submit.prevent="submitWorkflowTemplate"
          >
            <section class="space-y-3 rounded-xl border border-border bg-background/60 p-3">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">模板信息</p>
                <p class="mt-1 text-[11px] text-muted-foreground">
                  配置模板名称与描述，供业务线所有项目复用。
                </p>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-xs font-semibold text-muted-foreground">模板名称</span>
                  <input
                    v-model="workflowCreateForm.name"
                    class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="例如：业务线默认代码修复流"
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
                  <p class="mt-1 text-[11px] text-muted-foreground">
                    每个节点配置执行提示词、Agent CLI 与配置。
                  </p>
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
                  :key="`workflow-create-node-${index}`"
                  class="space-y-3 rounded-2xl border border-border bg-background/80 p-3.5"
                >
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="text-[11px] font-semibold text-muted-foreground">
                        节点 {{ index + 1 }}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <label
                        class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground"
                      >
                        <input v-model="node.requiresApproval" type="checkbox" class="h-4 w-4" />
                        需要审批
                      </label>
                      <label
                        class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground"
                      >
                        <input v-model="node.input.earlyExitMarkerEnabled" type="checkbox" class="h-4 w-4" />
                        marker 提前退出
                      </label>
                      <label
                        class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground"
                      >
                        <span class="shrink-0">最多循环</span>
                        <input
                          v-model.number="node.maxLoops"
                          type="number"
                          min="1"
                          class="w-12 rounded border-0 bg-transparent px-1 text-center text-xs focus:ring-1 focus:ring-primary"
                        />
                        <span class="shrink-0">次</span>
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
                      <span class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>节点 Prompt</span>
                        <WorkflowPromptVariablesHint variant="popover" />
                      </span>
                      <WorkflowPromptTextarea
                        v-model="node.input.prompt"
                        placeholder="输入该节点的提示词，输入 / 可插入变量"
                      />
                    </label>
                    <label v-if="node.input.earlyExitMarkerEnabled" class="space-y-1 md:col-span-2">
                      <span class="text-[11px] text-muted-foreground">Marker 文件名</span>
                      <input
                        v-model="node.input.earlyExitMarkerFileName"
                        class="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                        type="text"
                        placeholder="例如：taskResult（会读取 docs/code/taskResult.md）"
                      />
                    </label>

                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">Agent CLI</span>
                      <AppSelect
                        v-model="node.input.agentCliId"
                        aria-label="Agent CLI"
                        :disabled="
                          loadingWorkflowConfiguredCliTools ||
                          workflowConfiguredCliTools.length === 0
                        "
                        :options="workflowCliToolSelectOptions"
                        :panel-z-index="BUSINESS_LINE_WORKFLOW_SELECT_PANEL_Z_INDEX"
                        trigger-class="h-8 rounded-lg border-border bg-background px-2.5 text-sm shadow-none"
                        @change="void handleWorkflowNodeCliToolChange(node)"
                      />
                    </label>

                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">Agent CLI 配置</span>
                      <AppSelect
                        v-model="node.input.agentCliConfigId"
                        aria-label="Agent CLI 配置"
                        :disabled="
                          !node.input.agentCliId ||
                          isWorkflowNodeConfigLoading(node.input.agentCliId)
                        "
                        :options="getWorkflowNodeConfigSelectOptions(node.input.agentCliId)"
                        :panel-z-index="BUSINESS_LINE_WORKFLOW_SELECT_PANEL_Z_INDEX"
                        trigger-class="h-8 rounded-lg border-border bg-background px-2.5 text-sm shadow-none"
                      />
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
                :disabled="submittingWorkflowTemplate || !activeLineId"
              >
                {{
                  submittingWorkflowTemplate
                    ? workflowTemplateSubmitLoadingText
                    : workflowTemplateSubmitIdleText
                }}
              </button>
            </div>
          </form>
        </section>
      </div>

      <BusinessLineFormModal
        :open="lineFormModalOpen"
        :mode="lineFormMode"
        size="large"
        :submitting="lineFormSubmitting"
        :initial-name="lineFormInitialName"
        :initial-description="lineFormInitialDescription"
        :error-message="lineFormError"
        @update:open="lineFormModalOpen = $event"
        @submit="submitLineForm"
      />

      <ProjectFormModal
        :open="projectFormModalOpen"
        :mode="projectFormMode"
        size="large"
        :business-line-id="activeLineId"
        :submitting="projectFormSubmitting"
        :initial-name="projectFormInitialName"
        :initial-description="projectFormInitialDescription"
        :initial-git-url="projectFormInitialGitUrl"
        :initial-default-branch="projectFormInitialDefaultBranch"
        :initial-container-runtime="projectFormInitialContainerRuntime"
        :initial-runner-template="projectFormInitialRunnerTemplate"
        :error-message="projectFormError"
        @update:open="projectFormModalOpen = $event"
        @submit="submitProjectForm"
      />

      <MemberPermissionModal
        :open="memberPermissionModalOpen"
        :mode="memberPermissionModalMode"
        size="large"
        :submitting="memberPermissionModalSubmitting"
        :preparing="memberPermissionModalPreparing"
        :users="users"
        :projects="lineProjects"
        :initial-user-id="memberPermissionInitialUserId"
        :role-options="businessLineRoleOptions"
        :initial-business-role="memberPermissionInitialBusinessRole"
        :initial-project-roles="memberPermissionInitialProjectRoles"
        :show-project-roles="memberPermissionModalMode === 'edit'"
        :project-role-options="memberPermissionProjectRoleOptions"
        :invite-link="memberInvitationLink"
        :invite-expires-at="memberInvitationExpiresAt"
        :error-message="memberPermissionModalError"
        @update:open="memberPermissionModalOpen = $event"
        @submit="submitMemberPermission"
      />

      <CustomRoleModal
        :open="customRoleModalOpen"
        :mode="customRoleModalMode"
        size="large"
        scope-label="业务线"
        :submitting="customRoleModalSubmitting"
        :capability-tree="BUSINESS_LINE_CAPABILITY_TREE"
        :initial-name="customRoleInitialName"
        :initial-description="customRoleInitialDescription"
        :initial-capabilities="customRoleInitialCapabilities"
        :error-message="customRoleModalError"
        @update:open="customRoleModalOpen = $event"
        @submit="submitCustomRole"
      />

      <CustomRoleModal
        :open="permissionProjectRoleModalOpen"
        :mode="permissionProjectRoleModalMode"
        size="large"
        scope-label="项目"
        :submitting="permissionProjectRoleModalSubmitting"
        :capability-tree="PROJECT_CAPABILITY_TREE"
        :initial-name="permissionProjectRoleInitialName"
        :initial-description="permissionProjectRoleInitialDescription"
        :initial-capabilities="permissionProjectRoleInitialCapabilities"
        :error-message="permissionProjectRoleModalError"
        @update:open="permissionProjectRoleModalOpen = $event"
        @submit="submitPermissionProjectRole"
      />

      <AgentToolConfigModal
        :open="agentToolConfigModalOpen"
        :mode="agentToolConfigMode"
        size="large"
        :submitting="submittingAgentToolConfig"
        :cli-tool-id="activeAgentCliToolId"
        :cli-tool-label="activeAgentCliToolLabel"
        :initial-name="agentToolConfigForm.name"
        :initial-description="agentToolConfigForm.description"
        :initial-is-default="agentToolConfigForm.isDefault"
        :initial-config="agentToolConfigForm.config"
        :error-message="agentCliValidationMessage"
        @update:open="agentToolConfigModalOpen = $event"
        @submit="saveAgentToolConfig"
      />

      <SkillUploadModal
        :open="uploadSkillModalOpen"
        size="large"
        :submitting="uploadingLocalSkill"
        :error-message="uploadSkillError"
        :show-target-selection="false"
        @update:open="uploadSkillModalOpen = $event"
        @submit="submitUploadSkill"
      />

      <McpJsonImportModal
        :open="mcpJsonImportModalOpen"
        size="large"
        :submitting="importingLocalMcps"
        :error-message="mcpJsonImportError"
        @update:open="mcpJsonImportModalOpen = $event"
        @submit="submitImportMcpJson"
      />

      <div
        v-if="skillPreviewModalOpen"
        class="fixed inset-0 z-[126] flex items-center justify-center p-3 sm:p-6"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          aria-label="关闭 Skill 预览弹窗"
          @click="closeSkillPreview"
        />
        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="min-w-0 flex-1 space-y-1">
              <h2 class="text-base font-semibold">{{ skillPreviewName || 'Skill' }}</h2>
              <p class="truncate text-xs text-muted-foreground">
                {{ skillPreviewSelectedPath || '技能目录' }}
              </p>
            </div>
            <div class="ml-4 flex shrink-0 items-center gap-2">
              <button
                v-if="skillPreviewItem"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-md border border-primary/60 bg-primary/5 px-3 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="loadingSkillPreview || downloadingLocalSkillId === skillPreviewItem.id"
                @click="skillPreviewItem && void downloadLocalSkill(skillPreviewItem)"
              >
                {{ downloadingLocalSkillId === skillPreviewItem?.id ? '下载中...' : '下载' }}
              </button>
              <button
                v-if="skillPreviewItem"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-md border border-destructive/60 bg-destructive/5 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="删除 Skill"
                :disabled="loadingSkillPreview || removingLocalSkillId === skillPreviewItem.id"
                @click="skillPreviewItem && void removeLocalSkill(skillPreviewItem)"
              >
                {{ removingLocalSkillId === skillPreviewItem?.id ? '删除中...' : '删除' }}
              </button>
              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
                @click="closeSkillPreview"
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
            </div>
          </header>

          <div v-if="loadingSkillPreview" class="flex min-h-0 flex-1 px-4 py-6 text-sm text-muted-foreground">
            加载中...
          </div>
          <p
            v-else-if="skillPreviewError && skillPreviewTree.length === 0"
            class="flex min-h-0 flex-1 px-4 py-6 text-sm text-destructive"
          >
            {{ skillPreviewError }}
          </p>

          <div v-else class="flex min-h-0 flex-1">
            <aside class="w-52 flex-shrink-0 overflow-y-auto border-r border-border px-2 py-3">
              <SkillTree
                :nodes="skillPreviewTree"
                :selected-path="skillPreviewSelectedPath"
                :expanded-dirs="skillPreviewExpandedDirs"
                @select-file="loadSkillPreviewFile(skillPreviewId, $event)"
                @toggle-dir="toggleSkillPreviewDir($event)"
              />

              <p
                v-if="skillPreviewTree.length === 0"
                class="px-2 py-2 text-xs text-muted-foreground"
              >
                无文件
              </p>
            </aside>

            <div class="min-w-0 flex-1 overflow-y-auto px-4 py-3">
              <p v-if="skillPreviewFileLoading" class="text-sm text-muted-foreground">加载中...</p>
              <p v-else-if="skillPreviewError" class="text-sm text-destructive">
                {{ skillPreviewError }}
              </p>
              <p v-else-if="!skillPreviewSelectedPath" class="text-sm text-muted-foreground">
                请在左侧选择一个文件查看内容。
              </p>
              <pre
                v-else
                class="max-h-[62vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground"
                >{{ skillPreviewContent || '文件内容为空。' }}</pre
              >
            </div>
          </div>

          <footer class="border-t border-border px-4 py-3">
            <button
              type="button"
              class="h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              @click="closeSkillPreview"
            >
              关闭
            </button>
          </footer>
        </section>
      </div>

      <div
        v-if="mcpJsonPreviewModalOpen"
        class="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-6"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          aria-label="关闭 MCP JSON 预览弹窗"
          @click="closeMcpJsonPreview"
        />
        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="space-y-1">
              <h2 class="text-base font-semibold">MCP JSON</h2>
              <p class="text-xs text-muted-foreground">{{ mcpJsonPreviewName }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="mcpJsonPreviewItem"
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="删除 MCP"
                :disabled="
                  loadingMcpJsonPreview ||
                  savingMcpJsonPreview ||
                  removingLocalMcpId === mcpJsonPreviewItem.id
                "
                @click="mcpJsonPreviewItem && void removeLocalMcp(mcpJsonPreviewItem)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
                删除
              </button>
              <button
                type="button"
                data-testid="mcp-json-preview-save"
                class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loadingMcpJsonPreview || savingMcpJsonPreview || !mcpJsonPreviewDraft"
                @click="void saveMcpJsonPreview()"
              >
                {{ savingMcpJsonPreview ? '保存中...' : '保存' }}
              </button>
              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
                @click="closeMcpJsonPreview"
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
            </div>
          </header>
          <div class="space-y-3 px-4 py-4">
            <p v-if="loadingMcpJsonPreview" class="text-sm text-muted-foreground">
              加载 JSON 中...
            </p>
            <div v-else class="space-y-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground"
                  >JSON 配置</label
                >
                <textarea
                  v-model="mcpJsonPreviewDraft"
                  data-testid="mcp-json-preview-textarea"
                  class="min-h-[48vh] w-full rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs text-foreground"
                />
              </div>
            </div>
            <p
              v-if="!loadingMcpJsonPreview && mcpJsonPreviewError"
              class="text-sm text-destructive"
            >
              {{ mcpJsonPreviewError }}
            </p>
          </div>
        </section>
      </div>

      <ConfirmActionModal
        :open="workflowTemplateDeleteModalOpen"
        :confirming="workflowTemplateActionId === (workflowTemplateDeleteTarget?.id ?? '')"
        title="删除工作流模板"
        :description="`确认删除模板「${workflowTemplateDeleteTarget?.name ?? ''}」吗？`"
        confirm-text="删除"
        @update:open="setWorkflowTemplateDeleteModalOpen"
        @confirm="confirmRemoveWorkflowTemplate"
      />

      <ConfirmActionModal
        :open="projectDeleteModalOpen"
        :confirming="deletingProject"
        title="删除项目"
        :description="`确认删除项目「${deletingProjectTarget?.name ?? ''}」吗？`"
        confirm-text="删除"
        @update:open="projectDeleteModalOpen = $event"
        @confirm="confirmDeleteProject"
      />

      <ConfirmActionModal
        :open="memberRemoveModalOpen"
        :confirming="removingMember"
        title="移除成员"
        :description="`确认移除成员「${displayUserLabel(removingMemberTarget?.userId ?? '')}」吗？`"
        confirm-text="移除"
        @update:open="memberRemoveModalOpen = $event"
        @confirm="confirmRemoveMember"
      />

      <ConfirmActionModal
        :open="lineDeleteModalOpen"
        :confirming="false"
        title="删除业务线"
        :description="`确认删除业务线「${selectedLineName}」吗？`"
        confirm-text="下一步"
        @update:open="lineDeleteModalOpen = $event"
        @confirm="confirmDeleteLine"
      />

        <ConfirmActionModal
        :open="lineDeleteFinalModalOpen"
        :confirming="deletingLine"
        title="再次确认删除"
        :description="`该操作不可恢复。请再次确认删除业务线「${selectedLineName}」。`"
        confirm-text="确认删除"
        @update:open="lineDeleteFinalModalOpen = $event"
        @confirm="confirmDeleteLineFinal"
      />
  </div>
</template>
