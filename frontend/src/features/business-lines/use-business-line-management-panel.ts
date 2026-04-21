import type { InjectionKey } from 'vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { authApi } from '@/api/auth'
import {
  businessLinesApi,
  type BusinessLine,
  type BusinessLineCustomRole,
  type BusinessLineInvite,
  type BusinessLineMember,
} from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import {
  createProjectContainerRuntimeFormState,
  useProjectContainerRuntimeForm,
} from '@shared/composables/useProjectContainerRuntimeForm'
import { usersApi } from '@/api/users'
import type { ProjectItem } from '@features/layout'
import type {
  Project,
  ProjectContainerRuntimeConfig,
  ProjectCustomRole,
} from '@/types/api/projects'
import type { User } from '@/types/api/users'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'
import { useBlmLocalSkillsAndMcps } from './composables/useBlmLocalSkillsAndMcps'
import { useBlmAgentCli } from './composables/useBlmAgentCli'
import { useBlmWorkflowTemplates } from './composables/useBlmWorkflowTemplates'
import { normalizeOptionalText } from './blmFormUtils'
import {
  mapProjectItem,
  toProjectConfigJsonRecord,
  toProjectContainerRuntimeConfig,
} from './blmProjectDisplayUtils'
import { buildBusinessLineRoleAssignmentOptions } from '@shared/constants/access'
import { addProjectRepositoryProvisioningChangedListener } from '@shared/utils/project-repository-provisioning-event'



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

export type BusinessLineManagementPanelProps = {
  lines: import('@features/layout').BusinessLineItem[]
  projects: import('@features/layout').ProjectItem[]
  activeBusinessLineId: string
  selectedProjectId?: string
  canCreateBusinessLine: boolean
  mode?: 'page' | 'modal'
}

export type BusinessLineManagementPanelEmit = {
  (event: 'close'): void
  (event: 'select-line', businessLineId: string): void
  (event: 'select-project', projectId: string): void
  (event: 'request-refresh'): void
}

export type BusinessLineManagementPanelContext = ReturnType<typeof useBusinessLineManagementPanel>

export const businessLineManagementPanelInjectionKey = Symbol(
  'businessLineManagementPanel',
) as InjectionKey<BusinessLineManagementPanelContext>

export function useBusinessLineManagementPanel(
  props: BusinessLineManagementPanelProps,
  emit: BusinessLineManagementPanelEmit,
) {

const isModalMode = computed(() => props.mode === 'modal')
const isPanelActive = computed(() => true)

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
const editingProjectId = ref('')
const projectRuntimeSettingsModalOpen = ref(false)
const projectRuntimeSettingsSubmitting = ref(false)
const projectRuntimeSettingsError = ref('')
const projectRuntimeSettingsProject = ref<ProjectItem | null>(null)
const projectRuntimeSettingsInitialContainerRuntime = ref<ProjectContainerRuntimeConfig | null>(null)
const projectRuntimeSettingsInitialConfigJson = ref<Record<string, unknown> | null>(null)

const dbIsolationModalOpen = ref(false)
const dbIsolationSubmitting = ref(false)
const dbIsolationError = ref('')
const dbIsolationProject = ref<ProjectItem | null>(null)
const dbIsolationInitialConfigJson = ref<Record<string, unknown> | null>(null)

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

const message = useMessage()

const {
  loadingAgentToolConfigs,
  submittingAgentToolConfig,
  deletingAgentToolConfigId,
  testingAgentToolConfigId,
  agentCliValidationMessage,
  agentToolConfigModalOpen,
  agentToolConfigMode,
  agentToolConfigs,
  activeAgentCliToolId,
  agentToolConfigForm,
  activeAgentCliToolLabel,
  resetAgentToolConfigForm,
  openCreateAgentToolConfig,
  openEditAgentToolConfig,
  loadAgentToolConfigs,
  saveAgentToolConfig,
  setAgentToolConfigAsDefault,
  removeAgentToolConfig,
  testAgentToolConfig,
} = useBlmAgentCli(activeLineId, message)

const {
  loadingWorkflowTemplates,
  submittingWorkflowTemplate,
  workflowCreateModalOpen,
  workflowTemplateModalMode,
  editingWorkflowTemplateId,
  workflowTemplateActionId,
  workflowTemplateDeleteModalOpen,
  workflowTemplateDeleteTarget,
  workflowValidationMessage,
  workflowTemplates,
  workflowConfiguredCliTools,
  loadingWorkflowConfiguredCliTools,
  workflowNodeConfigsByTool,
  workflowNodeConfigLoadingByTool,
  workflowEditorActiveNodeIndex,
  workflowCreateForm,
  workflowCliToolSelectOptions,
  workflowTemplateModalTitle,
  workflowTemplateSubmitIdleText,
  workflowTemplateSubmitLoadingText,
  workflowTemplateInfoHint,
  activeWorkflowCreateNode,
  formatWorkflowNodeTabLabel,
  WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX,
  loadWorkflowConfiguredCliTools,
  getWorkflowNodeConfigSelectOptions,
  isWorkflowNodeConfigLoading,
  handleWorkflowNodeCliToolChange,
  resetWorkflowCreateForm,
  openWorkflowCreateModal,
  openWorkflowEditModal,
  closeWorkflowCreateModal,
  addWorkflowCreateNode,
  removeWorkflowCreateNode,
  loadWorkflowTemplates,
  submitWorkflowTemplate,
  removeWorkflowTemplate,
  setWorkflowTemplateDeleteModalOpen,
  confirmRemoveWorkflowTemplate,
} = useBlmWorkflowTemplates(activeLineId, message)

const {
  loadingLocalSkills,
  skillKeyword,
  removingLocalSkillId,
  downloadingLocalSkillId,
  loadingLocalMcps,
  uploadSkillModalOpen,
  uploadingLocalSkill,
  uploadSkillError,
  mcpJsonImportModalOpen,
  importingLocalMcps,
  mcpJsonImportError,
  mcpJsonPreviewModalOpen,
  loadingMcpJsonPreview,
  mcpJsonPreviewItem,
  mcpJsonPreviewName,
  mcpJsonPreviewError,
  mcpJsonPreviewDraft,
  savingMcpJsonPreview,
  skillPreviewModalOpen,
  loadingSkillPreview,
  skillPreviewItem,
  skillPreviewId,
  skillPreviewName,
  skillPreviewTree,
  skillPreviewContent,
  skillPreviewSelectedPath,
  skillPreviewFileLoading,
  skillPreviewError,
  skillPreviewExpandedDirs,
  localSkills,
  localMcps,
  removingLocalMcpId,
  loadLocalSkills,
  downloadLocalSkill,
  removeLocalSkill,
  openUploadSkillModal,
  submitUploadSkill,
  closeSkillPreview,
  toggleSkillPreviewDir,
  loadSkillPreviewFile,
  openSkillPreview,
  loadLocalMcps,
  openImportMcpJsonModal,
  submitImportMcpJson,
  closeMcpJsonPreview,
  openMcpJsonPreview,
  removeLocalMcp,
  saveMcpJsonPreview,
  resetSkillPreviewState,
  resetMcpJsonPreviewState,
} = useBlmLocalSkillsAndMcps(activeLineId, message)
const lineCapabilitiesById = ref<Record<string, string[]>>({})
let removeProjectProvisioningChangedListener: (() => void) | null = null

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

const projectContainerRuntimeForm = useProjectContainerRuntimeForm(
  createProjectContainerRuntimeFormState(),
)

const replaceLineProject = (project: Project) => {
  const nextProjectItem = mapProjectItem(project)
  const existingIndex = lineProjects.value.findIndex((item) => item.id === project.id)
  if (existingIndex < 0) {
    return
  }

  lineProjects.value = lineProjects.value.map((item, index) =>
    index === existingIndex ? nextProjectItem : item,
  )
}

const applyProjectRuntimeSettingsProject = (project: Project | ProjectItem) => {
  projectRuntimeSettingsProject.value = mapProjectItem(project as Project)
  projectRuntimeSettingsInitialContainerRuntime.value = toProjectContainerRuntimeConfig(
    project.configJson?.containerRuntime,
  )
  projectRuntimeSettingsInitialConfigJson.value = toProjectConfigJsonRecord(
    project.configJson,
  )
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

const handleProjectRepositoryProvisioningChanged = (detail: {
  projectId: string
  businessLineId: string
}) => {
  if (!activeLineId.value || activeLineId.value !== detail.businessLineId) {
    return
  }
  if (loadingProjects.value) {
    return
  }
  void loadLineProjects(activeLineId.value)
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
  projectFormError.value = ''
  projectFormModalOpen.value = true
}

const openProjectRuntimeSettingsModal = (project: ProjectItem) => {
  if (!canUpdateProjectItem.value) {
    return
  }

  applyProjectRuntimeSettingsProject(project)
  projectRuntimeSettingsError.value = ''
  projectRuntimeSettingsModalOpen.value = true
}

const retryProjectRepositoryProvisioning = async (project: ProjectItem) => {
  if (!canUpdateProjectItem.value) {
    return
  }

  try {
    const updatedProject = await projectsApi.retryRepositoryProvisioning(project.id)
    replaceLineProject(updatedProject)
    message.success('已触发仓库重试，请稍后刷新查看状态')
  } catch (error) {
    message.error(toErrorMessage(error, '触发仓库重试失败'))
  }
}

const handleProjectRuntimeSettingsModalOpenChange = (open: boolean) => {
  projectRuntimeSettingsModalOpen.value = open
}

const submitProjectForm = async (payload: {
  name: string
  description: string
  gitUrl: string
  defaultBranch: string
}) => {
  if (!activeLineId.value) {
    return
  }

  projectFormSubmitting.value = true
  projectFormError.value = ''

  try {
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
      })
    }

    projectFormModalOpen.value = false
    await refreshForCurrentLine({ includeMembers: isMemberAccessTab() })
    message.success(
      projectFormMode.value === 'create'
        ? '新建项目成功，仓库正在后台准备中'
        : '保存项目成功',
    )
  } catch (error) {
    const errMsg = toErrorMessage(error, '保存项目失败')
    projectFormError.value = errMsg
    message.error(errMsg)
  } finally {
    projectFormSubmitting.value = false
  }
}

const submitProjectRuntimeSettings = async (payload: {
  containerRuntime?: ProjectContainerRuntimeConfig
}) => {
  const project = projectRuntimeSettingsProject.value
  if (!project || !canUpdateProjectItem.value) {
    return
  }

  projectRuntimeSettingsSubmitting.value = true
  projectRuntimeSettingsError.value = ''

  try {
    projectContainerRuntimeForm.syncFromContainerRuntime(payload.containerRuntime)

    const mergedConfigJson = projectContainerRuntimeForm.buildProjectConfigJson(
      projectRuntimeSettingsInitialConfigJson.value,
    )

    const updatedProject = await projectsApi.update(project.id, {
      name: project.name.trim(),
      description: project.description?.trim() ?? '',
      gitUrl: project.gitUrl.trim(),
      defaultBranch: project.defaultBranch.trim() || 'main',
      configJson: mergedConfigJson && Object.keys(mergedConfigJson).length > 0
        ? mergedConfigJson
        : undefined,
    })

    applyProjectRuntimeSettingsProject(updatedProject)
    replaceLineProject(updatedProject)
    emit('request-refresh')
    projectRuntimeSettingsModalOpen.value = false
    message.success('保存隔离容器设置成功')
  } catch (error) {
    const errMsg = toErrorMessage(error, '保存隔离容器设置失败')
    projectRuntimeSettingsError.value = errMsg
    message.error(errMsg)
  } finally {
    projectRuntimeSettingsSubmitting.value = false
  }
}

const openDbIsolationModal = (project: ProjectItem) => {
  if (!canUpdateProjectItem.value) {
    return
  }
  dbIsolationProject.value = project
  dbIsolationInitialConfigJson.value = project.configJson
    ? { ...project.configJson }
    : null
  dbIsolationError.value = ''
  dbIsolationModalOpen.value = true
}

const handleDbIsolationModalOpenChange = (open: boolean) => {
  dbIsolationModalOpen.value = open
}

const submitDbIsolation = async (payload: {
  dbIsolationConfigJson: Record<string, unknown>
}) => {
  const project = dbIsolationProject.value
  if (!project || !canUpdateProjectItem.value) {
    return
  }

  dbIsolationSubmitting.value = true
  dbIsolationError.value = ''

  try {
    const base = { ...dbIsolationInitialConfigJson.value }
    delete base.databaseIsolation
    delete base.dbIsolationAdminPassword
    const mergedConfigJson = {
      ...base,
      ...payload.dbIsolationConfigJson,
    }

    const updatedProject = await projectsApi.update(project.id, {
      name: project.name.trim(),
      description: project.description?.trim() ?? '',
      gitUrl: project.gitUrl.trim(),
      defaultBranch: project.defaultBranch.trim() || 'main',
      configJson: Object.keys(mergedConfigJson).length > 0
        ? mergedConfigJson
        : undefined,
    })

    const updatedItem = mapProjectItem(updatedProject)
    dbIsolationProject.value = updatedItem
    dbIsolationInitialConfigJson.value = updatedProject.configJson
      ? { ...(updatedProject.configJson as Record<string, unknown>) }
      : null
    replaceLineProject(updatedProject)
    emit('request-refresh')
    dbIsolationModalOpen.value = false
    message.success('保存数据库隔离设置成功')
  } catch (error) {
    const errMsg = toErrorMessage(error, '保存数据库隔离设置失败')
    dbIsolationError.value = errMsg
    message.error(errMsg)
  } finally {
    dbIsolationSubmitting.value = false
  }
}

onMounted(() => {
  removeProjectProvisioningChangedListener =
    addProjectRepositoryProvisioningChangedListener(
      handleProjectRepositoryProvisioningChanged,
    )
})

onBeforeUnmount(() => {
  if (removeProjectProvisioningChangedListener) {
    removeProjectProvisioningChangedListener()
    removeProjectProvisioningChangedListener = null
  }
  projectRuntimeSettingsModalOpen.value = false
  dbIsolationModalOpen.value = false
})

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
  return reactive({
    activeAgentCliToolId,
    activeAgentCliToolLabel,
    activeLineId,
    activeWorkflowCreateNode,
    activePermissionRoleTab,
    activeTab,
    addWorkflowCreateNode,
    agentCliValidationMessage,
    agentToolConfigForm,
    agentToolConfigModalOpen,
    agentToolConfigMode,
    agentToolConfigs,
    applyInviteToCreateMemberModal,
    applyProjectRuntimeSettingsProject,
    buildInviteUrl,
    businessLineRoleOptions,
    canCreateBusinessLineRole,
    canCreateProjectItem,
    canDeleteBusinessLineRole,
    canDeleteLine,
    canDeleteProjectItem,
    canInviteMembers,
    canManageActiveLine,
    canManagePermissionProjectRoles,
    canRemoveMembers,
    canUpdateBusinessLineRole,
    canUpdateMemberRole,
    canUpdateProjectItem,
    closeMcpJsonPreview,
    closeModal,
    closeSkillPreview,
    closeWorkflowCreateModal,
    confirmDeleteLine,
    confirmDeleteLineFinal,
    confirmDeleteProject,
    confirmRemoveMember,
    confirmRemoveWorkflowTemplate,
    customRoleInitialCapabilities,
    customRoleInitialDescription,
    customRoleInitialName,
    customRoleModalError,
    customRoleModalMode,
    customRoleModalOpen,
    customRoleModalSubmitting,
    deletingAgentToolConfigId,
    deletingCustomRoleId,
    deletingLine,
    deletingPermissionProjectRoleId,
    deletingProject,
    deletingProjectTarget,
    displayBusinessLineRoleLabel,
    displayUserLabel,
    displayUserMeta,
    downloadLocalSkill,
    downloadingLocalSkillId,
    editingCustomRoleId,
    editingPermissionProjectRoleId,
    editingProjectId,
    editingWorkflowTemplateId,
    emit,
    filteredMembers,
    filteredProjects,
    formatWorkflowNodeTabLabel,
    getLineCapabilities,
    getWorkflowNodeConfigSelectOptions,
    goToMainPage,
    handleProjectRuntimeSettingsModalOpenChange,
    handleWorkflowNodeCliToolChange,
    hasActiveLineCapability,
    hasAnyActiveLineCapability,
    importingLocalMcps,
    initializePanel,
    isMemberAccessTab,
    isModalMode,
    isPanelActive,
    isWorkflowNodeConfigLoading,
    lineCapabilitiesById,
    lineCustomRoles,
    lineDeleteFinalModalOpen,
    lineDeleteModalOpen,
    lineDetail,
    lineFormError,
    lineFormInitialDescription,
    lineFormInitialName,
    lineFormModalOpen,
    lineFormMode,
    lineFormSubmitting,
    lineMembers,
    lineProjects,
    loadAgentToolConfigs,
    loadLatestInviteForCreateMemberModal,
    loadLineAccess,
    loadLineContext,
    loadLineCustomRoles,
    loadLineDetail,
    loadLineMembers,
    loadLineProjects,
    loadLocalMcps,
    loadLocalSkills,
    loadPermissionProjectCustomRoles,
    loadSkillPreviewFile,
    loadUsers,
    loadWorkflowConfiguredCliTools,
    loadWorkflowTemplates,
    loadingAgentToolConfigs,
    loadingCustomRoles,
    loadingLineDetail,
    loadingLocalMcps,
    loadingLocalSkills,
    loadingMcpJsonPreview,
    loadingMembers,
    loadingPermissionProjectRoleLibrary,
    loadingProjects,
    loadingSkillPreview,
    loadingUsers,
    loadingWorkflowConfiguredCliTools,
    loadingWorkflowTemplates,
    localMcps,
    localSkills,
    mcpJsonImportError,
    mcpJsonImportModalOpen,
    mcpJsonPreviewDraft,
    mcpJsonPreviewError,
    mcpJsonPreviewItem,
    mcpJsonPreviewModalOpen,
    mcpJsonPreviewName,
    memberInvitationExpiresAt,
    memberInvitationLink,
    memberPermissionInitialBusinessRole,
    memberPermissionInitialProjectRoles,
    memberPermissionInitialUserId,
    memberPermissionModalError,
    memberPermissionModalMode,
    memberPermissionModalOpen,
    memberPermissionModalPreparing,
    memberPermissionModalSubmitting,
    memberPermissionProjectRoleOptions,
    memberQuery,
    memberRemoveModalOpen,
    message,
    openCreateAgentToolConfig,
    openCreateCustomRoleModal,
    openCreateLineModal,
    openCreateMemberModal,
    openCreatePermissionProjectRoleModal,
    openCreateProjectModal,
    openDeleteLineModal,
    openEditAgentToolConfig,
    openEditCustomRoleModal,
    openEditLineModal,
    openEditMemberModal,
    openEditPermissionProjectRoleModal,
    openEditProjectModal,
    openImportMcpJsonModal,
    openMcpJsonPreview,
    openDbIsolationModal,
    openProjectDeleteModal,
    openProjectRuntimeSettingsModal,
    retryProjectRepositoryProvisioning,
    openRemoveMemberModal,
    openSkillPreview,
    openUploadSkillModal,
    openWorkflowCreateModal,
    openWorkflowEditModal,
    permissionProjectRoleInitialCapabilities,
    permissionProjectRoleInitialDescription,
    permissionProjectRoleInitialName,
    permissionProjectRoleLibrary,
    permissionProjectRoleModalError,
    permissionProjectRoleModalMode,
    permissionProjectRoleModalOpen,
    permissionProjectRoleModalSubmitting,
    dbIsolationError,
    dbIsolationInitialConfigJson,
    dbIsolationModalOpen,
    dbIsolationProject,
    dbIsolationSubmitting,
    handleDbIsolationModalOpenChange,
    submitDbIsolation,
    projectContainerRuntimeForm,
    projectDeleteModalOpen,
    projectFormError,
    projectFormInitialDefaultBranch,
    projectFormInitialDescription,
    projectFormInitialGitUrl,
    projectFormInitialName,
    projectFormModalOpen,
    projectFormMode,
    projectFormSubmitting,
    projectQuery,
    projectRuntimeSettingsError,
    projectRuntimeSettingsInitialConfigJson,
    projectRuntimeSettingsInitialContainerRuntime,
    projectRuntimeSettingsModalOpen,
    projectRuntimeSettingsProject,
    projectRuntimeSettingsSubmitting,
    props,
    WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX,
    refreshForCurrentLine,
    refreshLinePermissionSection,
    refreshMemberAccessSection,
    removeAgentToolConfig,
    removeCustomRole,
    removeLocalMcp,
    removeLocalSkill,
    removePermissionProjectRole,
    removeWorkflowCreateNode,
    removeWorkflowTemplate,
    removingLocalMcpId,
    removingLocalSkillId,
    removingMember,
    removingMemberTarget,
    replaceLineProject,
    resetAgentToolConfigForm,
    resetMcpJsonPreviewState,
    resetSkillPreviewState,
    resetTabErrors,
    resetWorkflowCreateForm,
    roleBadgeClass,
    router,
    saveAgentToolConfig,
    saveMcpJsonPreview,
    savingMcpJsonPreview,
    selectCurrentProject,
    selectedLine,
    selectedLineDescription,
    selectedLineName,
    setAgentToolConfigAsDefault,
    setWorkflowTemplateDeleteModalOpen,
    skillKeyword,
    skillPreviewContent,
    skillPreviewError,
    skillPreviewExpandedDirs,
    skillPreviewFileLoading,
    skillPreviewId,
    skillPreviewItem,
    skillPreviewModalOpen,
    skillPreviewName,
    skillPreviewSelectedPath,
    skillPreviewTree,
    submitCustomRole,
    submitImportMcpJson,
    submitLineForm,
    submitMemberPermission,
    submitPermissionProjectRole,
    submitProjectForm,
    submitProjectRuntimeSettings,
    submitUploadSkill,
    submitWorkflowTemplate,
    testAgentToolConfig,
    testingAgentToolConfigId,
    submittingAgentToolConfig,
    submittingWorkflowTemplate,
    tabClass,
    toggleSkillPreviewDir,
    uploadSkillError,
    uploadSkillModalOpen,
    uploadingLocalSkill,
    userMap,
    users,
    workflowCliToolSelectOptions,
    workflowConfiguredCliTools,
    workflowEditorActiveNodeIndex,
    workflowCreateForm,
    workflowCreateModalOpen,
    workflowNodeConfigLoadingByTool,
    workflowNodeConfigsByTool,
    workflowTemplateActionId,
    workflowTemplateDeleteModalOpen,
    workflowTemplateDeleteTarget,
    workflowTemplateModalMode,
    workflowTemplateModalTitle,
    workflowTemplateInfoHint,
    workflowTemplateSubmitIdleText,
    workflowTemplateSubmitLoadingText,
    workflowTemplates,
    workflowValidationMessage,
  })
}
