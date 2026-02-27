<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useMessage } from '@/hooks'
import {
  businessLinesApi,
  type BusinessLine,
  type BusinessLineMember,
  type BusinessLineMemberRole,
} from '@/api/business-lines'
import { usersApi } from '@/api/users'
import type { User } from '@/types/api/users'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'
import BusinessLineFormModal from '@/views/business-lines/components/BusinessLineFormModal.vue'

defineOptions({
  name: 'BusinessLinesView',
})

type BusinessLinesTab = 'lines' | 'members'

const loadingLines = ref(false)
const loadingMembers = ref(false)
const savingLine = ref(false)
const savingMember = ref(false)
const removingLineId = ref('')
const updatingMemberUserId = ref('')
const removingMemberUserId = ref('')
const validationMessage = ref('')
const message = useMessage()

const lines = ref<BusinessLine[]>([])
const members = ref<BusinessLineMember[]>([])
const users = ref<User[]>([])
const selectedLineId = ref('')
const activeTab = ref<BusinessLinesTab>('lines')

const lineFormModalOpen = ref(false)
const lineFormMode = ref<'create' | 'edit'>('create')
const lineFormInitialName = ref('')
const lineFormInitialDescription = ref('')
const editingLineId = ref('')

const memberForm = reactive<{
  userId: string
  role: BusinessLineMemberRole
}>({
  userId: '',
  role: 'member',
})

const memberRoleDrafts = ref<Record<string, BusinessLineMemberRole>>({})

const selectedLine = computed(() => {
  return lines.value.find((line) => line.id === selectedLineId.value) ?? null
})

const userMap = computed(() => {
  return new Map(users.value.map((user) => [user.id, user]))
})

const roleOptions: Array<{ label: string; value: BusinessLineMemberRole }> = [
  { label: 'owner', value: 'owner' },
  { label: 'admin', value: 'admin' },
  { label: 'member', value: 'member' },
]

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
  const nextDrafts: Record<string, BusinessLineMemberRole> = {}
  for (const member of members.value) {
    nextDrafts[member.userId] = member.role
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
    const response = await fetchAllPages((page, limit) =>
      businessLinesApi.list({ page, limit }),
    )
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
    const response = await businessLinesApi.listMembers(selectedLineId.value)
    members.value = response
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
  if (!window.confirm(`确认删除业务线「${line.name}」吗？`)) {
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
      role: memberForm.role,
    })
    memberForm.userId = ''
    memberForm.role = 'member'
    await loadMembers()
    message.success('添加成员成功')
  } catch (error) {
    message.error(toErrorMessage(error, '添加成员失败'))
  } finally {
    savingMember.value = false
  }
}

const updateMemberRole = async (member: BusinessLineMember) => {
  const nextRole = memberRoleDrafts.value[member.userId] ?? member.role

  updatingMemberUserId.value = member.userId

  try {
    await businessLinesApi.updateMember(member.businessLineId, member.userId, {
      role: nextRole,
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
          :class="line.id === selectedLineId ? 'border-primary bg-primary/5' : 'border-border bg-background/70 hover:bg-background'"
          type="button"
          @click="selectedLineId = line.id"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ line.name }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ line.description || '暂无描述' }}</p>
              <p class="mt-1 text-[11px] text-muted-foreground">更新时间：{{ formatDate(line.updatedAt) }}</p>
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
            :class="line.id === selectedLineId ? 'border-primary bg-primary/5' : 'border-border bg-background/70 hover:bg-background'"
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
        <div class="mb-4 flex items-center justify-between">
          <p class="text-sm font-semibold">业务线成员</p>
          <span class="text-xs text-muted-foreground">
            当前：{{ selectedLine?.name ?? '未选择业务线' }}
          </span>
        </div>

        <template v-if="selectedLine">
          <form class="grid gap-3 md:grid-cols-[1fr_160px_auto]" @submit.prevent="addMember">
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
              <select
                v-model="memberForm.role"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option v-for="role in roleOptions" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
            </label>

            <div class="flex items-end">
              <button
                class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savingMember"
                type="submit"
              >
                {{ savingMember ? '添加中...' : '添加成员' }}
              </button>
            </div>
          </form>

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
                <tr v-for="member in members" v-else :key="member.id" class="transition hover:bg-background/70">
                  <td class="px-4 py-4">
                    <p class="font-semibold">{{ displayUserLabel(member.userId) }}</p>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ member.userId }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <select
                      v-model="memberRoleDrafts[member.userId]"
                      class="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    >
                      <option v-for="role in roleOptions" :key="role.value" :value="role.value">
                        {{ role.label }}
                      </option>
                    </select>
                  </td>
                  <td class="px-4 py-4 text-muted-foreground">{{ formatDate(member.updatedAt) }}</td>
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
                  <td class="px-4 py-5 text-sm text-muted-foreground" colspan="4">暂无成员，请先添加。</td>
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

    <BusinessLineFormModal
      :open="lineFormModalOpen"
      :mode="lineFormMode"
      :submitting="savingLine"
      :initial-name="lineFormInitialName"
      :initial-description="lineFormInitialDescription"
      @update:open="lineFormModalOpen = $event"
      @submit="submitLineForm"
    />
  </div>
</template>
