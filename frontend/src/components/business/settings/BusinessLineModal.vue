<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMessage } from '@/hooks'
import {
  businessLinesApi,
  type BusinessLine,
  type BusinessLineInvite,
  type BusinessLineMember,
  type BusinessLineMemberRole,
} from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import { usersApi } from '@/api/users'
import type { BusinessLineItem, ProjectItem } from '@/hooks/core/useLayout'
import type { Project, ProjectMember } from '@/types/api/projects'
import type { User } from '@/types/api/users'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'
import BusinessLineFormModal from './modals/BusinessLineFormModal.vue'
import ConfirmActionModal from './modals/ConfirmActionModal.vue'
import MemberPermissionModal from './modals/MemberPermissionModal.vue'
import ProjectFormModal from './modals/ProjectFormModal.vue'

type MainTab = 'projects' | 'members' | 'settings'
type ProjectPermissionRole = 'none' | 'manage' | 'developer' | 'viewer'
type ExistingProjectRole = ProjectMember['role'] | null

defineOptions({
  name: 'BusinessLineModal',
})

const props = defineProps<{
  open: boolean
  lines: BusinessLineItem[]
  projects: ProjectItem[]
  activeBusinessLineId: string
  selectedProjectId?: string
  canCreateBusinessLine: boolean
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'select-line', businessLineId: string): void
  (event: 'select-project', projectId: string): void
  (event: 'request-refresh'): void
}>()

const activeLineId = ref('')
const activeTab = ref<MainTab>('projects')

const projectQuery = ref('')
const memberQuery = ref('')

const lineDetail = ref<BusinessLine | null>(null)
const lineProjects = ref<ProjectItem[]>([])
const lineMembers = ref<BusinessLineMember[]>([])
const users = ref<User[]>([])

const loadingLineDetail = ref(false)
const loadingProjects = ref(false)
const loadingMembers = ref(false)
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

const memberPermissionModalOpen = ref(false)
const memberPermissionModalMode = ref<'create' | 'edit'>('create')
const memberPermissionModalSubmitting = ref(false)
const memberPermissionModalPreparing = ref(false)
const memberPermissionModalError = ref('')
const memberPermissionInitialUserId = ref('')
const memberPermissionInitialBusinessRole = ref<BusinessLineMemberRole>('member')
const memberPermissionInitialProjectRoles = ref<Record<string, ProjectPermissionRole>>({})
const memberInvitationLink = ref('')
const memberInvitationExpiresAt = ref('')

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

const selectedLine = computed(() => {
  return props.lines.find((line) => line.id === activeLineId.value) ?? null
})

const selectedLineName = computed(() => {
  return lineDetail.value?.name ?? selectedLine.value?.name ?? '业务线'
})

const selectedLineDescription = computed(() => {
  return lineDetail.value?.description ?? selectedLine.value?.description ?? ''
})

const canDeleteLine = computed(() => {
  return lineProjects.value.length === 0 && Boolean(activeLineId.value)
})

const hasNestedModalOpen = computed(() => {
  return (
    lineFormModalOpen.value ||
    projectFormModalOpen.value ||
    memberPermissionModalOpen.value ||
    projectDeleteModalOpen.value ||
    memberRemoveModalOpen.value ||
    lineDeleteModalOpen.value ||
    lineDeleteFinalModalOpen.value
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
      member.role.toLowerCase().includes(query) ||
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

const normalizeProjectShort = (projectName: string) => {
  return projectName
    .trim()
    .replace(/\s+/g, '')
    .slice(0, 4)
    .toUpperCase()
}

const mapProjectItem = (project: Project): ProjectItem => {
  return {
    id: project.id,
    name: project.name,
    to: `/projects/${project.id}`,
    short: normalizeProjectShort(project.name),
    businessLineId: project.businessLineId,
    description: project.description ?? null,
    gitUrl: project.gitUrl,
    defaultBranch: project.defaultBranch,
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

const roleBadgeClass = (role: BusinessLineMemberRole) => {
  if (role === 'owner') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
  }

  if (role === 'admin') {
    return 'border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300'
  }

  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
}

const mapProjectRoleToPermissionRole = (role: ExistingProjectRole): ProjectPermissionRole => {
  if (!role) {
    return 'none'
  }

  if (role === 'owner' || role === 'maintainer') {
    return 'manage'
  }

  if (role === 'developer') {
    return 'developer'
  }

  return 'viewer'
}

const mapPermissionRoleToProjectRole = (
  permissionRole: ProjectPermissionRole,
  currentRole: ExistingProjectRole,
): ExistingProjectRole => {
  if (permissionRole === 'none') {
    return null
  }

  if (permissionRole === 'manage') {
    return currentRole === 'owner' ? 'owner' : 'maintainer'
  }

  if (permissionRole === 'developer') {
    return 'developer'
  }

  return 'viewer'
}

const tabClass = (tab: MainTab) => {
  return tab === activeTab.value
    ? 'bg-background text-foreground shadow-sm'
    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
}

const resetTabErrors = () => {
  lineFormError.value = ''
  projectFormError.value = ''
  memberPermissionModalError.value = ''
}

const closeModal = () => {
  emit('update:open', false)
}

const closeNestedModals = () => {
  lineFormModalOpen.value = false
  projectFormModalOpen.value = false
  memberPermissionModalOpen.value = false
  projectDeleteModalOpen.value = false
  memberRemoveModalOpen.value = false
  lineDeleteModalOpen.value = false
  lineDeleteFinalModalOpen.value = false
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
    return
  }

  const lineId = activeLineId.value
  await Promise.all([loadLineDetail(lineId), loadLineProjects(lineId)])

  if (includeMembers) {
    await loadLineMembers(lineId)
  }
}

const refreshForCurrentLine = async ({ includeMembers = false }: { includeMembers?: boolean } = {}) => {
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
  if (!activeLineId.value) {
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
      if (!activeLineId.value) {
        return
      }

      await businessLinesApi.update(activeLineId.value, {
        name: payload.name.trim(),
        description: payload.description.trim(),
      })
    }

    lineFormModalOpen.value = false
    await refreshForCurrentLine({ includeMembers: activeTab.value === 'members' })
    message.success(lineFormMode.value === 'create' ? '创建业务线成功' : '保存业务线成功')
  } catch (error) {
    message.error(toErrorMessage(error, '保存业务线失败'))
  } finally {
    lineFormSubmitting.value = false
  }
}

const openCreateProjectModal = () => {
  if (!activeLineId.value) {
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
  projectFormMode.value = 'edit'
  editingProjectId.value = project.id
  projectFormInitialName.value = project.name
  projectFormInitialDescription.value = project.description ?? ''
  projectFormInitialGitUrl.value = project.gitUrl
  projectFormInitialDefaultBranch.value = project.defaultBranch
  projectFormError.value = ''
  projectFormModalOpen.value = true
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
      await projectsApi.create({
        businessLineId: activeLineId.value,
        name: payload.name.trim(),
        description: normalizeOptionalText(payload.description),
        gitUrl: payload.gitUrl.trim(),
        defaultBranch: payload.defaultBranch.trim() || 'main',
      })
    } else {
      if (!editingProjectId.value) {
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
    await refreshForCurrentLine({ includeMembers: activeTab.value === 'members' })
    message.success(projectFormMode.value === 'create' ? '创建项目成功' : '保存项目成功')
  } catch (error) {
    message.error(toErrorMessage(error, '保存项目失败'))
  } finally {
    projectFormSubmitting.value = false
  }
}

const openProjectDeleteModal = (project: ProjectItem) => {
  deletingProjectTarget.value = project
  projectDeleteModalOpen.value = true
}

const confirmDeleteProject = async () => {
  if (!deletingProjectTarget.value) {
    return
  }

  deletingProject.value = true

  try {
    await projectsApi.remove(deletingProjectTarget.value.id)
    projectDeleteModalOpen.value = false
    deletingProjectTarget.value = null
    await refreshForCurrentLine({ includeMembers: activeTab.value === 'members' })
    message.success('删除项目成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除项目失败'))
  } finally {
    deletingProject.value = false
  }
}

const buildEmptyProjectRoles = (defaultRole: ProjectPermissionRole = 'none') => {
  const projectRoles: Record<string, ProjectPermissionRole> = {}

  for (const project of lineProjects.value) {
    projectRoles[project.id] = defaultRole
  }

  return projectRoles
}

const buildInviteUrl = (token: string) => {
  const inviteUrl = new URL('/business-lines/invite', window.location.origin)
  inviteUrl.searchParams.set('token', token)
  return inviteUrl.toString()
}

const applyInviteToCreateMemberModal = (invite: BusinessLineInvite | null) => {
  if (!invite) {
    memberPermissionInitialBusinessRole.value = 'member'
    memberPermissionInitialProjectRoles.value = buildEmptyProjectRoles('developer')
    memberInvitationLink.value = ''
    memberInvitationExpiresAt.value = ''
    return
  }

  const nextProjectRoles = buildEmptyProjectRoles()
  for (const project of lineProjects.value) {
    nextProjectRoles[project.id] = invite.projectRoles[project.id] ?? 'none'
  }

  memberPermissionInitialBusinessRole.value = invite.role
  memberPermissionInitialProjectRoles.value = nextProjectRoles
  memberInvitationLink.value = buildInviteUrl(invite.token)
  memberInvitationExpiresAt.value = invite.expiresAt
}

const loadLatestInviteForCreateMemberModal = async (businessLineId: string) => {
  const latestInvite = await businessLinesApi.getLatestInvitation(businessLineId)
  applyInviteToCreateMemberModal(latestInvite)
  return latestInvite
}

const fetchProjectRoleMapForUser = async (userId: string) => {
  const projectRoles = buildEmptyProjectRoles()
  const rawProjectRoles: Record<string, ExistingProjectRole> = {}
  const failedProjects: string[] = []

  for (const project of lineProjects.value) {
    rawProjectRoles[project.id] = null
  }

  const settledMembers = await Promise.allSettled(
    lineProjects.value.map((project) => projectsApi.listMembers(project.id)),
  )

  settledMembers.forEach((result, index) => {
    const project = lineProjects.value[index]
    if (!project) {
      return
    }

    if (result.status === 'rejected') {
      failedProjects.push(project.name)
      return
    }

    const matchedMember = result.value.find((member) => member.userId === userId)
    const matchedRole = matchedMember?.role ?? null
    rawProjectRoles[project.id] = matchedRole
    projectRoles[project.id] = mapProjectRoleToPermissionRole(matchedRole)
  })

  return {
    projectRoles,
    rawProjectRoles,
    failedProjects,
  }
}

const openCreateMemberModal = async () => {
  if (!activeLineId.value) {
    return
  }

  const businessLineId = activeLineId.value
  memberPermissionModalMode.value = 'create'
  memberPermissionInitialUserId.value = ''
  memberPermissionInitialBusinessRole.value = 'member'
  memberPermissionInitialProjectRoles.value = buildEmptyProjectRoles('developer')
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
  if (!activeLineId.value) {
    return
  }

  memberPermissionModalMode.value = 'edit'
  memberPermissionInitialUserId.value = member.userId
  memberPermissionInitialBusinessRole.value = member.role
  memberPermissionInitialProjectRoles.value = buildEmptyProjectRoles()
  memberPermissionModalPreparing.value = true
  memberPermissionModalError.value = ''
  memberPermissionModalOpen.value = true

  if (users.value.length === 0) {
    await loadUsers()
  }

  try {
    const roleMapResult = await fetchProjectRoleMapForUser(member.userId)
    memberPermissionInitialProjectRoles.value = roleMapResult.projectRoles

    if (roleMapResult.failedProjects.length > 0) {
      message.warning(`以下项目权限加载失败：${roleMapResult.failedProjects.join('、')}`)
    }
  } catch (error) {
    message.error(toErrorMessage(error, '加载成员项目权限失败'))
  } finally {
    memberPermissionModalPreparing.value = false
  }
}

const syncMemberProjectPermissions = async (
  userId: string,
  targetRoles: Record<string, ProjectPermissionRole>,
) => {
  const failedProjectNames = new Set<string>()
  const currentRoleResult = await fetchProjectRoleMapForUser(userId)

  for (const projectName of currentRoleResult.failedProjects) {
    failedProjectNames.add(projectName)
  }

  for (const project of lineProjects.value) {
    const nextRole = targetRoles[project.id] ?? 'none'
    const currentPermissionRole = currentRoleResult.projectRoles[project.id] ?? 'none'
    const currentRawRole = currentRoleResult.rawProjectRoles[project.id] ?? null

    if (nextRole === currentPermissionRole) {
      continue
    }

    try {
      if (nextRole === 'none') {
        if (currentRawRole) {
          await projectsApi.removeMember(project.id, userId)
        }
        continue
      }

      const nextRawRole = mapPermissionRoleToProjectRole(nextRole, currentRawRole)
      if (!nextRawRole) {
        continue
      }

      if (!currentRawRole) {
        await projectsApi.addMember(project.id, {
          userId,
          role: nextRawRole,
        })
        continue
      }

      if (nextRawRole === currentRawRole) {
        continue
      }

      await projectsApi.updateMember(project.id, userId, {
        role: nextRawRole,
      })
    } catch (error) {
      void error
      failedProjectNames.add(project.name)
    }
  }

  return Array.from(failedProjectNames)
}

const submitMemberPermission = async (payload: {
  mode: 'create'
  businessRole: BusinessLineMemberRole
  projectRoles: Record<string, ProjectPermissionRole>
} | {
  mode: 'edit'
  userId: string
  businessRole: BusinessLineMemberRole
  projectRoles: Record<string, ProjectPermissionRole>
}) => {
  if (!activeLineId.value) {
    return
  }

  memberPermissionModalSubmitting.value = true
  memberPermissionModalError.value = ''

  try {
    if (payload.mode === 'create') {
      const businessLineId = activeLineId.value
      const createdInvite = await businessLinesApi.createInvitation(businessLineId, {
        role: payload.businessRole,
        projectRoles: payload.projectRoles,
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
      const currentMember = lineMembers.value.find((member) => member.userId === payload.userId)
      if (currentMember && currentMember.role !== payload.businessRole) {
        await businessLinesApi.updateMember(activeLineId.value, payload.userId, {
          role: payload.businessRole,
        })
      }

      const failedProjects = await syncMemberProjectPermissions(payload.userId, payload.projectRoles)
      if (failedProjects.length > 0) {
        message.warning(`部分项目权限更新失败：${failedProjects.join('、')}`)
      }

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

const openRemoveMemberModal = (member: BusinessLineMember) => {
  removingMemberTarget.value = member
  memberRemoveModalOpen.value = true
}

const confirmRemoveMember = async () => {
  if (!activeLineId.value || !removingMemberTarget.value) {
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

    await refreshForCurrentLine({ includeMembers: activeTab.value === 'members' })
    message.success('删除业务线成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除业务线失败'))
  } finally {
    deletingLine.value = false
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (!props.open || hasNestedModalOpen.value) {
    return
  }

  if (event.key !== 'Escape') {
    return
  }

  event.preventDefault()
  closeModal()
}

let previousBodyOverflow = ''

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetTabErrors()
      activeTab.value = 'projects'
      projectQuery.value = ''
      memberQuery.value = ''

      activeLineId.value = props.activeBusinessLineId || props.lines[0]?.id || ''
      if (activeLineId.value) {
        emit('select-line', activeLineId.value)
      }

      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKeydown)

      void loadLineContext({ includeMembers: false })
      return
    }

    closeNestedModals()
    document.body.style.overflow = previousBodyOverflow
    window.removeEventListener('keydown', onKeydown)
  },
)

watch(
  () => props.activeBusinessLineId,
  (lineId) => {
    if (!props.open || !lineId || lineId === activeLineId.value) {
      return
    }

    activeLineId.value = lineId
  },
)

watch(
  () => props.lines,
  (lines) => {
    if (!props.open) {
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
    if (!props.open || lineId === previousLineId) {
      return
    }

    projectQuery.value = ''
    memberQuery.value = ''

    if (!lineId) {
      lineDetail.value = null
      lineProjects.value = []
      lineMembers.value = []
      return
    }

    emit('select-line', lineId)
    void loadLineContext({ includeMembers: activeTab.value === 'members' })
  },
)

watch(
  () => activeTab.value,
  (tab) => {
    if (!props.open || !activeLineId.value) {
      return
    }

    if (tab === 'projects') {
      void loadLineProjects(activeLineId.value)
      return
    }

    if (tab === 'members') {
      void Promise.all([loadLineMembers(activeLineId.value), loadUsers()])
      return
    }

    void loadLineDetail(activeLineId.value)
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6" aria-live="polite">
      <button
        type="button"
        aria-label="关闭业务线弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-sm"
        @click="closeModal"
      />

      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="business-line-modal-title"
        class="relative z-10 h-[min(760px,92vh)] w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
      >
        <div class="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside class="flex min-h-0 flex-col border-b border-border bg-muted/30 lg:border-r lg:border-b-0">
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
                <p class="mt-1 text-xs text-muted-foreground">{{ line.description || '暂无描述' }}</p>
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
                :title="props.canCreateBusinessLine ? '创建业务线' : '仅管理员可创建业务线'"
                @click="openCreateLineModal"
              >
                创建业务线
              </button>
              <p v-if="!props.canCreateBusinessLine" class="mt-2 text-[11px] text-muted-foreground">仅管理员可创建业务线</p>
            </footer>
          </aside>

          <div class="flex min-h-0 flex-1 flex-col">
            <header class="flex h-16 items-center justify-between border-b border-border px-5">
              <div>
                <p class="text-xs font-semibold tracking-wide text-muted-foreground">业务线管理</p>
                <h2 id="business-line-modal-title" class="text-sm font-semibold">{{ selectedLineName }}</h2>
              </div>
              <button
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
                  成员/权限
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
                        @click="loadLineProjects(activeLineId)"
                      >
                        刷新
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId"
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

                  <div v-if="loadingProjects" class="mt-4 text-sm text-muted-foreground">加载项目中...</div>

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
                          <p class="text-xs text-muted-foreground">{{ project.description || '暂无描述' }}</p>
                          <p class="font-mono text-[11px] text-muted-foreground">{{ project.gitUrl }}</p>
                          <p class="text-xs text-muted-foreground">默认分支：{{ project.defaultBranch }}</p>
                        </div>

                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                            @click.stop="openEditProjectModal(project)"
                          >
                            编辑
                          </button>
                          <button
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
                    <p class="text-sm font-semibold">成员列表（{{ filteredMembers.length }}）</p>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        @click="loadLineMembers(activeLineId)"
                      >
                        刷新
                      </button>
                      <button
                        type="button"
                        class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId"
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

                  <div v-if="loadingMembers" class="mt-4 text-sm text-muted-foreground">加载成员中...</div>

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
                        <tr v-for="member in filteredMembers" :key="member.id" class="transition hover:bg-background/70">
                          <td class="px-4 py-3">
                            <p class="text-sm font-semibold">{{ displayUserLabel(member.userId) }}</p>
                            <p class="mt-0.5 text-xs text-muted-foreground">{{ displayUserMeta(member.userId) }}</p>
                            <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">{{ member.userId }}</p>
                          </td>
                          <td class="px-4 py-3">
                            <span
                              class="inline-flex rounded-full border px-2 py-1 text-xs font-semibold"
                              :class="roleBadgeClass(member.role)"
                            >
                              {{ member.role }}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-muted-foreground">{{ formatDate(member.updatedAt) }}</td>
                          <td class="px-4 py-3">
                            <div class="flex justify-end gap-2">
                              <button
                                type="button"
                                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                                @click="openEditMemberModal(member)"
                              >
                                编辑权限
                              </button>
                              <button
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
                          <td colspan="4" class="px-4 py-5 text-sm text-muted-foreground">暂无成员，请先邀请。</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
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
                        class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                        :disabled="!activeLineId || loadingLineDetail"
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
                      <p class="mt-1 text-sm text-foreground">{{ selectedLineDescription || '暂无描述' }}</p>
                    </div>
                  </div>
                </article>
              </section>
            </div>
          </div>
        </div>
      </section>

      <BusinessLineFormModal
        :open="lineFormModalOpen"
        :mode="lineFormMode"
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
        :submitting="projectFormSubmitting"
        :initial-name="projectFormInitialName"
        :initial-description="projectFormInitialDescription"
        :initial-git-url="projectFormInitialGitUrl"
        :initial-default-branch="projectFormInitialDefaultBranch"
        :error-message="projectFormError"
        @update:open="projectFormModalOpen = $event"
        @submit="submitProjectForm"
      />

      <MemberPermissionModal
        :open="memberPermissionModalOpen"
        :mode="memberPermissionModalMode"
        :submitting="memberPermissionModalSubmitting"
        :preparing="memberPermissionModalPreparing"
        :users="users"
        :projects="lineProjects"
        :initial-user-id="memberPermissionInitialUserId"
        :initial-business-role="memberPermissionInitialBusinessRole"
        :initial-project-roles="memberPermissionInitialProjectRoles"
        :invite-link="memberInvitationLink"
        :invite-expires-at="memberInvitationExpiresAt"
        :error-message="memberPermissionModalError"
        @update:open="memberPermissionModalOpen = $event"
        @submit="submitMemberPermission"
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
  </Teleport>
</template>
