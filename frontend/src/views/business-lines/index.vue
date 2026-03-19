<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useMessage } from '@/hooks'
import { businessLinesApi, type BusinessLine, type BusinessLineCustomRole, type BusinessLineMember } from '@/api/business-lines'
import { buildBusinessLineRoleAssignmentOptions } from '@/constants/access'
import { usersApi } from '@/api/users'
import type { User } from '@/types/api/users'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'
import AppSelect from '@/components/core/select'
import BusinessLineFormModal from '@/views/business-lines/components/BusinessLineFormModal.vue'
import ConfirmActionModal from '@/components/business/settings/modals/ConfirmActionModal.vue'

defineOptions({
  name: 'BusinessLinesView',
})

type BusinessLinesTab = 'lines' | 'members'

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
  if (!line) {
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
  void loadLines()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">组织管理</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">业务线</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        对接业务线 CRUD 与成员管理接口，支持角色变更和移除。
      </p>
      <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
    </section>

    <section class="panel-card flex flex-wrap gap-2 p-2">
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('lines')"
        type="button"
        @click="activeTab = 'lines'"
      >
        业务线列表
      </button>
      <button
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="tabClass('members')"
        type="button"
        @click="activeTab = 'members'"
      >
        业务线成员
      </button>
    </section>

    <section v-if="activeTab === 'lines'" class="panel-card p-5">
      <div class="mb-4 flex items-center justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">业务线列表</p>
          <p class="text-xs text-muted-foreground">管理业务线基础信息，并可跳转成员管理。</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadLines()"
          >
            刷新
          </button>
          <button
            class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="openCreateLineModal"
          >
            创建业务线
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <div v-if="loadingLines" class="text-sm text-muted-foreground">加载中...</div>

        <button
          v-for="line in lines"
          :key="line.id"
          class="w-full rounded-xl border px-4 py-3 text-left transition"
          :class="
            line.id === selectedLineId
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background/70 hover:bg-background'
          "
          type="button"
          @click="selectedLineId = line.id"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ line.name }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ line.description || '暂无描述' }}</p>
              <p class="mt-1 text-[11px] text-muted-foreground">
                更新时间：{{ formatDate(line.updatedAt) }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
                type="button"
                @click.stop="openEditLineModal(line)"
              >
                编辑
              </button>
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
                type="button"
                @click.stop="openMembersTabForLine(line)"
              >
                成员
              </button>
              <button
                class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="removingLineId === line.id"
                type="button"
                @click.stop="removeLine(line)"
              >
                {{ removingLineId === line.id ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </button>

        <div
          v-if="!loadingLines && lines.length === 0"
          class="rounded-xl border border-dashed border-border bg-background/40 px-4 py-4 text-sm text-muted-foreground"
        >
          <p>暂无业务线，请先创建。</p>
          <button
            class="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            type="button"
            @click="openCreateLineModal"
          >
            创建业务线
          </button>
        </div>
      </div>
    </section>

    <section v-else class="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <article class="panel-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-semibold">业务线</p>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadLines()"
          >
            刷新
          </button>
        </div>

        <div class="space-y-2">
          <button
            v-for="line in lines"
            :key="line.id"
            class="w-full rounded-xl border px-3 py-3 text-left transition"
            :class="
              line.id === selectedLineId
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background/70 hover:bg-background'
            "
            type="button"
            @click="selectedLineId = line.id"
          >
            <p class="text-sm font-semibold">{{ line.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ line.description || '暂无描述' }}</p>
          </button>

          <div
            v-if="!loadingLines && lines.length === 0"
            class="rounded-xl border border-dashed border-border bg-background/40 px-3 py-4 text-sm text-muted-foreground"
          >
            <p>暂无业务线，请先创建。</p>
            <button
              class="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              type="button"
              @click="openCreateLineModal"
            >
              创建业务线
            </button>
          </div>
        </div>
      </article>

      <article class="panel-card p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">业务线成员</p>
            <p class="mt-1 text-xs text-muted-foreground">
              当前：{{ selectedLine?.name ?? '未选择业务线' }}
            </p>
          </div>
          <button
            class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!selectedLine"
            type="button"
            @click="openMemberFormModal"
          >
            添加成员
          </button>
        </div>

        <template v-if="selectedLine">
          <p class="text-xs text-muted-foreground">
            新增成员已迁移为弹窗表单，点击右上角“添加成员”。
          </p>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b border-border bg-background/60">
                <tr class="text-xs font-semibold text-muted-foreground">
                  <th class="px-4 py-3">用户</th>
                  <th class="px-4 py-3">角色</th>
                  <th class="px-4 py-3">更新时间</th>
                  <th class="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-if="loadingMembers">
                  <td class="px-4 py-5 text-sm text-muted-foreground" colspan="4">加载成员中...</td>
                </tr>
                <tr
                  v-for="member in members"
                  v-else
                  :key="member.id"
                  class="transition hover:bg-background/70"
                >
                  <td class="px-4 py-4">
                    <p class="font-semibold">{{ displayUserLabel(member.userId) }}</p>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ member.userId }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <AppSelect
                      :model-value="memberRoleDrafts[member.userId] ?? ''"
                      aria-label="成员角色"
                      :block="false"
                      :options="roleOptions"
                      trigger-class="h-9 rounded-lg border-border bg-background px-3 text-sm shadow-none"
                      @update:model-value="memberRoleDrafts[member.userId] = String($event ?? '')"
                    />
                  </td>
                  <td class="px-4 py-4 text-muted-foreground">
                    {{ formatDate(member.updatedAt) }}
                  </td>
                  <td class="px-4 py-4">
                    <div class="flex justify-end gap-2">
                      <button
                        class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="updatingMemberUserId === member.userId"
                        type="button"
                        @click="updateMemberRole(member)"
                      >
                        {{ updatingMemberUserId === member.userId ? '保存中...' : '保存角色' }}
                      </button>
                      <button
                        class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="removingMemberUserId === member.userId"
                        type="button"
                        @click="removeMember(member)"
                      >
                        {{ removingMemberUserId === member.userId ? '移除中...' : '移除' }}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!loadingMembers && members.length === 0">
                  <td class="px-4 py-5 text-sm text-muted-foreground" colspan="4">
                    暂无成员，请先添加。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <div
          v-else
          class="rounded-xl border border-dashed border-border bg-background/40 px-4 py-6 text-sm text-muted-foreground"
        >
          请先创建业务线后再管理成员。
        </div>
      </article>
    </section>

    <ConfirmActionModal
      :open="lineDeleteModalOpen"
      :confirming="removingLineId === (removingLineTarget?.id ?? '')"
      title="删除业务线"
      :description="`确认删除业务线「${removingLineTarget?.name ?? ''}」吗？`"
      confirm-text="删除"
      @update:open="setLineDeleteModalOpen"
      @confirm="confirmRemoveLine"
    />

    <BusinessLineFormModal
      :open="lineFormModalOpen"
      :mode="lineFormMode"
      :submitting="savingLine"
      :initial-name="lineFormInitialName"
      :initial-description="lineFormInitialDescription"
      @update:open="lineFormModalOpen = $event"
      @submit="submitLineForm"
    />

    <Teleport to="body">
      <div
        v-if="memberFormModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-line-member-modal-title"
        @click.self="closeMemberFormModal"
      >
        <section
          class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="business-line-member-modal-title" class="text-sm font-semibold">添加成员</h2>
            <button
              class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
              type="button"
              aria-label="关闭成员弹窗"
              @click="closeMemberFormModal"
            >
              关闭
            </button>
          </header>

          <form class="grid gap-3 px-4 py-4 md:grid-cols-[1fr_160px]" @submit.prevent="addMember">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">用户 ID</span>
              <input
                v-model="memberForm.userId"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                list="business-line-user-options"
                placeholder="输入或选择用户 ID"
                type="text"
              />
              <datalist id="business-line-user-options">
                <option v-for="user in users" :key="user.id" :value="user.id">
                  {{ user.nickname?.trim() || user.username }}
                </option>
              </datalist>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">角色</span>
              <AppSelect
                v-model="memberForm.roleId"
                aria-label="业务线角色"
                :options="roleOptions"
                trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
              />
            </label>

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
                :disabled="savingMember"
                type="submit"
              >
                {{ savingMember ? '添加中...' : '添加成员' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
