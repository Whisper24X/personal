<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BusinessLineMemberRole } from '@/api/business-lines'
import type { User } from '@/types/api/users'

export type ProjectPermissionRole = 'none' | 'manage' | 'developer' | 'viewer'

type ProjectPermissionItem = {
  id: string
  name: string
}

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  submitting: boolean
  preparing: boolean
  users: User[]
  projects: ProjectPermissionItem[]
  initialUserId: string
  initialBusinessRole: BusinessLineMemberRole
  initialProjectRoles: Record<string, ProjectPermissionRole>
  inviteLink?: string
  inviteExpiresAt?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  (
    event: 'submit',
    payload:
      | {
          mode: 'create'
          businessRole: BusinessLineMemberRole
          projectRoles: Record<string, ProjectPermissionRole>
        }
      | {
          mode: 'edit'
          userId: string
          businessRole: BusinessLineMemberRole
          projectRoles: Record<string, ProjectPermissionRole>
        },
  ): void
  (event: 'update:open', value: boolean): void
}>()

const selectedUserId = ref('')
const businessRole = ref<BusinessLineMemberRole>('member')
const projectRoles = ref<Record<string, ProjectPermissionRole>>({})
const validationMessage = ref('')
const copyState = ref<'idle' | 'success' | 'error'>('idle')

const roleOptions: Array<{ label: string; value: BusinessLineMemberRole }> = [
  { label: 'owner', value: 'owner' },
  { label: 'admin', value: 'admin' },
  { label: 'member', value: 'member' },
]

const projectRoleOptions: Array<{ label: string; value: ProjectPermissionRole }> = [
  { label: '无权限', value: 'none' },
  { label: '管理', value: 'manage' },
  { label: '开发', value: 'developer' },
  { label: '只读', value: 'viewer' },
]

const modeTitle = computed(() => {
  return props.mode === 'edit' ? '编辑成员权限' : '邀请成员'
})

const userMap = computed(() => {
  return new Map(props.users.map((user) => [user.id, user]))
})

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

const inviteExpiresLabel = computed(() => {
  if (!props.inviteExpiresAt) {
    return '邀请链接默认 7 天后过期'
  }

  const inviteExpireAt = new Date(props.inviteExpiresAt)
  if (Number.isNaN(inviteExpireAt.getTime())) {
    return '邀请链接默认 7 天后过期'
  }

  return `邀请将于 ${inviteExpireAt.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })} 过期`
})

const copyButtonText = computed(() => {
  if (!props.inviteLink) {
    return '先生成邀请链接'
  }

  if (copyState.value === 'success') {
    return '复制成功'
  }

  if (copyState.value === 'error') {
    return '复制失败，请重试'
  }

  return '复制链接'
})

const submitButtonText = computed(() => {
  if (props.mode === 'create') {
    if (props.submitting) {
      return '生成中...'
    }

    return props.inviteLink ? '重新生成邀请链接' : '生成邀请链接'
  }

  if (props.preparing) {
    return '加载中...'
  }

  if (props.submitting) {
    return '保存中...'
  }

  return '保存'
})

const syncState = () => {
  selectedUserId.value = props.initialUserId
  businessRole.value = props.initialBusinessRole
  validationMessage.value = ''
  copyState.value = 'idle'

  const nextProjectRoles: Record<string, ProjectPermissionRole> = {}
  for (const project of props.projects) {
    nextProjectRoles[project.id] = props.initialProjectRoles[project.id] ?? 'none'
  }
  projectRoles.value = nextProjectRoles

  if (props.mode === 'edit' && props.initialUserId) {
    return
  }
}

const close = () => {
  emit('update:open', false)
}

const copyInviteLink = async () => {
  if (!props.inviteLink) {
    copyState.value = 'error'
    return
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.inviteLink)
      copyState.value = 'success'
      return
    }

    throw new Error('Clipboard API unavailable')
  } catch (error) {
    void error
    copyState.value = 'error'
  }
}

const submit = () => {
  if (props.mode === 'create') {
    validationMessage.value = ''
    emit('submit', {
      mode: 'create',
      businessRole: businessRole.value,
      projectRoles: { ...projectRoles.value },
    })
    return
  }

  if (!selectedUserId.value.trim()) {
    validationMessage.value = '请选择成员'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    mode: 'edit',
    userId: selectedUserId.value,
    businessRole: businessRole.value,
    projectRoles: { ...projectRoles.value },
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    syncState()
  },
)

watch(
  () => [props.initialUserId, props.initialBusinessRole, props.initialProjectRoles, props.projects, props.mode],
  () => {
    if (!props.open) {
      return
    }

    syncState()
  },
)

watch(
  () => props.inviteLink,
  () => {
    if (!props.open || props.mode !== 'create') {
      return
    }

    copyState.value = 'idle'
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭成员权限弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        class="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold">{{ modeTitle }}</h2>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
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

        <form class="space-y-4 px-4 py-4" @submit.prevent="submit">
          <div v-if="props.mode === 'edit'" class="grid gap-3 md:grid-cols-2">
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">成员</span>
              <div class="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground">
                <p class="font-semibold">{{ displayUserLabel(selectedUserId) }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">{{ displayUserMeta(selectedUserId) }}</p>
              </div>
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold text-muted-foreground">业务线角色</span>
              <select
                v-model="businessRole"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option v-for="role in roleOptions" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
            </label>
          </div>

          <div v-else class="space-y-3">
            <label class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">邀请后的业务线角色</span>
              <select
                v-model="businessRole"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                <option v-for="role in roleOptions" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
            </label>

            <section class="space-y-2 rounded-xl border border-border bg-background/70 p-3">
              <p class="text-xs font-semibold text-muted-foreground">邀请链接</p>
              <input
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
                readonly
                :value="props.inviteLink || '点击下方“生成邀请链接”后可复制发送'"
              />
              <p class="text-xs text-muted-foreground">{{ inviteExpiresLabel }}</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="props.submitting || props.preparing"
                >
                  {{ submitButtonText }}
                </button>
                <button
                  type="button"
                  class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="!props.inviteLink"
                  @click="copyInviteLink"
                >
                  {{ copyButtonText }}
                </button>
              </div>
            </section>
          </div>

          <section class="space-y-2">
            <p class="text-xs font-semibold text-muted-foreground">项目权限</p>
            <div class="max-h-[320px] overflow-auto rounded-xl border border-border">
              <table class="w-full min-w-[560px] text-left text-sm">
                <thead class="border-b border-border bg-background/70">
                  <tr class="text-xs font-semibold text-muted-foreground">
                    <th class="px-3 py-2">项目</th>
                    <th class="px-3 py-2">权限</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr v-for="project in props.projects" :key="project.id">
                    <td class="px-3 py-2">{{ project.name }}</td>
                    <td class="px-3 py-2">
                      <select
                        v-model="projectRoles[project.id]"
                        class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option v-for="option in projectRoleOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </option>
                      </select>
                    </td>
                  </tr>
                  <tr v-if="props.projects.length === 0">
                    <td colspan="2" class="px-3 py-4 text-sm text-muted-foreground">当前业务线暂无项目。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">{{ props.errorMessage }}</p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              v-if="props.mode === 'edit'"
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting || props.preparing"
            >
              {{ submitButtonText }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
