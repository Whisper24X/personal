<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RoleAssignmentOption } from '@/constants/access'
import { resolveRoleAssignmentKey } from '@/constants/access'
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
  roleOptions: RoleAssignmentOption<string>[]
  initialUserId: string
  initialBusinessRole: string
  initialProjectRoles: Record<string, ProjectPermissionRole>
  showProjectRoles?: boolean
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
          businessRole: string
          projectRoles: Record<string, ProjectPermissionRole>
        }
      | {
          mode: 'edit'
          userId: string
          businessRole: string
          projectRoles: Record<string, ProjectPermissionRole>
        },
  ): void
  (event: 'update:open', value: boolean): void
}>()

const selectedUserId = ref('')
const selectedRoleKey = ref('')
const projectRoles = ref<Record<string, ProjectPermissionRole>>({})
const validationMessage = ref('')
const copyState = ref<'idle' | 'success' | 'error'>('idle')

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

const defaultRoleOptions = computed(() => {
  return props.roleOptions.filter((item) => item.source === 'default')
})

const customRoleOptions = computed(() => {
  return props.roleOptions.filter((item) => item.source === 'custom')
})

const selectedRoleOption = computed(() => {
  return (
    props.roleOptions.find((item) => item.key === selectedRoleKey.value) ??
    props.roleOptions[0] ??
    null
  )
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
  const resolvedRoleKey = resolveRoleAssignmentKey(props.initialBusinessRole, props.roleOptions)
  selectedRoleKey.value = props.roleOptions.some((item) => item.key === resolvedRoleKey)
    ? resolvedRoleKey
    : (props.roleOptions[0]?.key ?? '')
  validationMessage.value = ''
  copyState.value = 'idle'

  const nextProjectRoles: Record<string, ProjectPermissionRole> = {}
  if (props.showProjectRoles !== false) {
    for (const project of props.projects) {
      nextProjectRoles[project.id] = props.initialProjectRoles[project.id] ?? 'none'
    }
  }
  projectRoles.value = nextProjectRoles
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
  const selected = selectedRoleOption.value
  if (!selected) {
    validationMessage.value = props.roleOptions.length > 0 ? '请选择角色' : '请先创建角色'
    return
  }

  if (props.mode === 'create') {
    validationMessage.value = ''
    emit('submit', {
      mode: 'create',
      businessRole: selected.role,
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
    businessRole: selected.role,
    projectRoles: { ...projectRoles.value },
  })
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      syncState()
    }
  },
)

watch(
  () => [props.initialUserId, props.initialBusinessRole, props.initialProjectRoles, props.projects],
  () => {
    if (props.open) {
      syncState()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭成员权限弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        class="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold">{{ modeTitle }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">
              {{
                props.mode === 'create'
                  ? '生成业务线邀请链接，并选择默认成员角色。'
                  : '调整当前成员的业务线角色。'
              }}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
          >
            ×
          </button>
        </header>

        <form class="space-y-4 px-4 py-4" @submit.prevent="submit">
          <div v-if="props.mode === 'edit'" class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">成员</span>
            <div
              class="rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground"
            >
              <div class="font-semibold">{{ displayUserLabel(selectedUserId) }}</div>
              <div class="mt-1 text-xs text-muted-foreground">
                {{ displayUserMeta(selectedUserId) }}
              </div>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <section class="space-y-2">
              <p class="text-xs font-semibold text-muted-foreground">默认角色</p>
              <div class="space-y-2">
                <label
                  v-for="option in defaultRoleOptions"
                  :key="option.key"
                  class="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 transition hover:bg-muted/30"
                >
                  <input
                    v-model="selectedRoleKey"
                    class="mt-1 h-4 w-4 rounded border-border"
                    type="radio"
                    :value="option.key"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-foreground">{{
                      option.label
                    }}</span>
                    <span class="mt-1 block text-xs text-muted-foreground">{{
                      option.description
                    }}</span>
                  </span>
                </label>
              </div>
            </section>

            <section class="space-y-2">
              <p class="text-xs font-semibold text-muted-foreground">自定义角色</p>
              <div v-if="customRoleOptions.length > 0" class="space-y-2">
                <label
                  v-for="option in customRoleOptions"
                  :key="option.key"
                  class="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 transition hover:bg-muted/30"
                >
                  <input
                    v-model="selectedRoleKey"
                    class="mt-1 h-4 w-4 rounded border-border"
                    type="radio"
                    :value="option.key"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-foreground">{{
                      option.label
                    }}</span>
                    <span class="mt-1 block text-xs text-muted-foreground">{{
                      option.description
                    }}</span>
                  </span>
                </label>
              </div>
              <div
                v-else
                class="rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
              >
                暂无自定义角色
              </div>
            </section>
          </div>

          <section
            v-if="props.mode === 'create'"
            class="rounded-xl border border-border bg-background/70 px-4 py-3"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">邀请链接</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ inviteExpiresLabel }}</p>
              </div>
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!props.inviteLink"
                @click="copyInviteLink"
              >
                {{ copyButtonText }}
              </button>
            </div>

            <div
              class="mt-3 rounded-xl border border-dashed border-border bg-background px-3 py-3 text-xs text-muted-foreground"
            >
              <span v-if="props.inviteLink" class="break-all">{{ props.inviteLink }}</span>
              <span v-else>提交后生成最新邀请链接</span>
            </div>
          </section>

          <section
            v-if="props.showProjectRoles !== false"
            class="space-y-2 rounded-xl border border-border bg-background/70 p-3"
          >
            <div>
              <p class="text-xs font-semibold text-muted-foreground">项目默认权限</p>
              <p class="mt-1 text-xs text-muted-foreground">可按项目预分配默认项目角色。</p>
            </div>
            <div class="space-y-2">
              <div
                v-for="project in props.projects"
                :key="project.id"
                class="flex flex-col gap-2 rounded-xl border border-border bg-background px-3 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div class="text-sm font-semibold text-foreground">{{ project.name }}</div>
                  <div class="mt-1 font-mono text-[11px] text-muted-foreground">
                    {{ project.id }}
                  </div>
                </div>
                <select
                  v-model="projectRoles[project.id]"
                  class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground md:w-40"
                >
                  <option
                    v-for="option in projectRoleOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>
          </section>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.preparing || props.submitting"
            >
              {{ submitButtonText }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
