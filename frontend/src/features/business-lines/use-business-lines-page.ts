import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useMessage } from '@app/composables/useMessage'
import { useAccessStore } from '@app/stores/modules/access'
import { businessLinesApi, type BusinessLine, type BusinessLineCustomRole, type BusinessLineMember } from '@/api/business-lines'
import { buildBusinessLineRoleAssignmentOptions } from '@shared/constants/access'
import { usersApi } from '@/api/users'
import type { User } from '@/types/api/users'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'

export type BusinessLinesTab = 'lines' | 'members'

export type BusinessLinesPageContext = ReturnType<typeof useBusinessLinesPage>

export function useBusinessLinesPage() {
const loadingLines = ref(false)
const loadingMembers = ref(false)
const savingLine = ref(false)
const savingMember = ref(false)
const removingLineId = ref('')
const lineDeleteModalOpen = ref(false)
const removingLineTarget = ref<BusinessLine | null>(null)
const updatingMemberUserId = ref('')
const removingMemberUserId = ref('')
const validationMessage = ref('')
const message = useMessage()
const accessStore = useAccessStore()

const canCreateBusinessLine = computed(() => accessStore.isPlatformAdmin)

const lines = ref<BusinessLine[]>([])
const members = ref<BusinessLineMember[]>([])
const lineRoles = ref<BusinessLineCustomRole[]>([])
const users = ref<User[]>([])
const selectedLineId = ref('')
const activeTab = ref<BusinessLinesTab>('lines')

const lineFormModalOpen = ref(false)
const lineFormMode = ref<'create' | 'edit'>('create')
const lineFormInitialName = ref('')
const lineFormInitialDescription = ref('')
const editingLineId = ref('')
const memberFormModalOpen = ref(false)

const memberForm = reactive<{
  userId: string
  roleId: string
}>({
  userId: '',
  roleId: '',
})

const memberRoleDrafts = ref<Record<string, string>>({})

const selectedLine = computed(() => {
  return lines.value.find((line) => line.id === selectedLineId.value) ?? null
})

const userMap = computed(() => {
  return new Map(users.value.map((user) => [user.id, user]))
})

const roleOptions = computed(() =>
  buildBusinessLineRoleAssignmentOptions(lineRoles.value).map((item) => ({
    label: item.label,
    value: item.roleId,
  })),
)

const tabClass = (key: BusinessLinesTab) =>
  key === activeTab.value
    ? 'bg-background text-foreground shadow-sm'
    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'

const displayUserLabel = (userId: string) => {
  const user = userMap.value.get(userId)
  if (!user) {
    return userId
  }

  return user.nickname?.trim() || user.username
}

const normalizeOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const syncMemberRoleDrafts = () => {
  const nextDrafts: Record<string, string> = {}
  for (const member of members.value) {
    nextDrafts[member.userId] = member.roleId
  }
  memberRoleDrafts.value = nextDrafts
}

const loadUsers = async () => {
  try {
    users.value = await fetchAllPages((page, limit) => usersApi.list({ page, limit }))
  } catch (error) {
    message.error(toErrorMessage(error, '加载用户失败'))
  }
}

const loadLines = async (preferredSelectedId?: string) => {
  loadingLines.value = true

  try {
    const response = await fetchAllPages((page, limit) => businessLinesApi.list({ page, limit }))
    lines.value = response

    if (preferredSelectedId && response.some((line) => line.id === preferredSelectedId)) {
      selectedLineId.value = preferredSelectedId
      return
    }

    const hasSelected = response.some((line) => line.id === selectedLineId.value)
    if (!hasSelected) {
      selectedLineId.value = response[0]?.id ?? ''
    }
  } catch (error) {
    message.error(toErrorMessage(error, '加载业务线失败'))
  } finally {
    loadingLines.value = false
  }
}

const loadMembers = async () => {
  if (!selectedLineId.value) {
    members.value = []
    memberRoleDrafts.value = {}
    return
  }

  loadingMembers.value = true

  try {
    const [response, roles] = await Promise.all([
      businessLinesApi.listMembers(selectedLineId.value),
      businessLinesApi.listCustomRoles(selectedLineId.value),
    ])
    members.value = response
    lineRoles.value = roles
    if (!memberForm.roleId) {
      memberForm.roleId = roleOptions.value[0]?.value ?? ''
    }
    syncMemberRoleDrafts()
  } catch (error) {
    message.error(toErrorMessage(error, '加载业务线成员失败'))
  } finally {
    loadingMembers.value = false
  }
}

const ensureMembersContextLoaded = async () => {
  if (users.value.length === 0) {
    await loadUsers()
  }

  await loadMembers()
}

const openCreateLineModal = () => {
  if (!canCreateBusinessLine.value) {
    return
  }

  lineFormMode.value = 'create'
  editingLineId.value = ''
  lineFormInitialName.value = ''
  lineFormInitialDescription.value = ''
  lineFormModalOpen.value = true
}

const openEditLineModal = (line: BusinessLine) => {
  lineFormMode.value = 'edit'
  editingLineId.value = line.id
  lineFormInitialName.value = line.name
  lineFormInitialDescription.value = line.description ?? ''
  lineFormModalOpen.value = true
}

const submitLineForm = async (payload: { name: string; description: string }) => {
  savingLine.value = true
  validationMessage.value = ''

  const requestPayload = {
    name: payload.name.trim(),
    description: normalizeOptionalText(payload.description),
  }

  try {
    if (lineFormMode.value === 'edit' && editingLineId.value) {
      await businessLinesApi.update(editingLineId.value, requestPayload)
      await loadLines(editingLineId.value)
    } else {
      const createdLine = await businessLinesApi.create(requestPayload)
      await loadLines(createdLine.id)
    }

    lineFormModalOpen.value = false
    message.success(lineFormMode.value === 'edit' ? '保存业务线成功' : '创建业务线成功')
  } catch (error) {
    message.error(toErrorMessage(error, '保存业务线失败'))
  } finally {
    savingLine.value = false
  }
}

const removeLine = async (line: BusinessLine) => {
  if (!canCreateBusinessLine.value) {
    return
  }

  removingLineTarget.value = line
  lineDeleteModalOpen.value = true
}

const setLineDeleteModalOpen = (open: boolean) => {
  lineDeleteModalOpen.value = open
  if (!open) {
    removingLineTarget.value = null
  }
}

const confirmRemoveLine = async () => {
  const line = removingLineTarget.value
  if (!line || !canCreateBusinessLine.value) {
    return
  }

  removingLineId.value = line.id

  try {
    await businessLinesApi.remove(line.id)

    if (selectedLineId.value === line.id) {
      selectedLineId.value = ''
      members.value = []
      memberRoleDrafts.value = {}
    }

    await loadLines()
    message.success('删除业务线成功')
    setLineDeleteModalOpen(false)
  } catch (error) {
    message.error(toErrorMessage(error, '删除业务线失败'))
  } finally {
    removingLineId.value = ''
  }
}

const openMembersTabForLine = (line: BusinessLine) => {
  selectedLineId.value = line.id
  activeTab.value = 'members'
}

const openMemberFormModal = () => {
  if (!selectedLine.value) {
    return
  }

  validationMessage.value = ''
  memberFormModalOpen.value = true
}

const closeMemberFormModal = () => {
  memberFormModalOpen.value = false
  validationMessage.value = ''
}

const addMember = async () => {
  if (!selectedLineId.value || !memberForm.userId.trim()) {
    validationMessage.value = '请先选择业务线并填写用户 ID'
    return
  }

  savingMember.value = true
  validationMessage.value = ''

  try {
    await businessLinesApi.addMember(selectedLineId.value, {
      userId: memberForm.userId.trim(),
      roleId: memberForm.roleId,
    })
    memberForm.userId = ''
    memberForm.roleId = roleOptions.value[0]?.value ?? ''
    closeMemberFormModal()
    await loadMembers()
    message.success('添加成员成功')
  } catch (error) {
    message.error(toErrorMessage(error, '添加成员失败'))
  } finally {
    savingMember.value = false
  }
}

const updateMemberRole = async (member: BusinessLineMember) => {
  const nextRole = memberRoleDrafts.value[member.userId] ?? member.roleId

  updatingMemberUserId.value = member.userId

  try {
    await businessLinesApi.updateMember(member.businessLineId, member.userId, {
      roleId: nextRole,
    })
    await loadMembers()
    message.success('更新成员角色成功')
  } catch (error) {
    message.error(toErrorMessage(error, '更新成员角色失败'))
  } finally {
    updatingMemberUserId.value = ''
  }
}

const removeMember = async (member: BusinessLineMember) => {
  removingMemberUserId.value = member.userId

  try {
    await businessLinesApi.removeMember(member.businessLineId, member.userId)
    await loadMembers()
    message.success('移除成员成功')
  } catch (error) {
    message.error(toErrorMessage(error, '移除成员失败'))
  } finally {
    removingMemberUserId.value = ''
  }
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab !== 'members') {
      return
    }

    void ensureMembersContextLoaded()
  },
)

watch(
  () => selectedLineId.value,
  () => {
    if (activeTab.value !== 'members') {
      return
    }

    void loadMembers()
  },
)

onMounted(() => {
  void accessStore.loadContext()
  void loadLines()
})


  return reactive({
    activeTab,
    addMember,
    canCreateBusinessLine,
    closeMemberFormModal,
    confirmRemoveLine,
    displayUserLabel,
    editingLineId,
    ensureMembersContextLoaded,
    lineDeleteModalOpen,
    lineFormInitialDescription,
    lineFormInitialName,
    lineFormModalOpen,
    lineFormMode,
    lineRoles,
    lines,
    loadLines,
    loadMembers,
    loadUsers,
    loadingLines,
    loadingMembers,
    memberForm,
    memberFormModalOpen,
    memberRoleDrafts,
    members,
    message,
    normalizeOptionalText,
    openCreateLineModal,
    openEditLineModal,
    openMemberFormModal,
    openMembersTabForLine,
    removeLine,
    removeMember,
    removingLineId,
    removingLineTarget,
    removingMemberUserId,
    roleOptions,
    savingLine,
    savingMember,
    selectedLine,
    selectedLineId,
    setLineDeleteModalOpen,
    submitLineForm,
    syncMemberRoleDrafts,
    tabClass,
    updateMemberRole,
    updatingMemberUserId,
    userMap,
    users,
    validationMessage,
  })
}
