<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RoleAssignmentOption } from '@/constants/access'
import { resolveRoleAssignmentKey } from '@/constants/access'
import type { User } from '@/types/api/users'

type ProjectRoleSelection = string

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
  roleOptions: RoleAssignmentOption[]
  initialUserId: string
  initialBusinessRole: string
  initialProjectRoles: Record<string, ProjectRoleSelection>
  showProjectRoles?: boolean
  projectRoleOptions: Array<{ label: string; value: ProjectRoleSelection }>
  inviteLink?: string
  inviteExpiresAt?: string
  errorMessage?: string
  size?: 'default' | 'large'
}>()

const emit = defineEmits<{
  (
    event: 'submit',
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
  ): void
  (event: 'update:open', value: boolean): void
}>()

const selectedUserId = ref('')
const selectedRoleKey = ref('')
const projectRoles = ref<Record<string, ProjectRoleSelection>>({})
const validationMessage = ref('')
const copyState = ref<'idle' | 'success' | 'error'>('idle')

const modeTitle = computed(() => {
  return props.mode === 'edit' ? '编辑成员权限' : '邀请成员'
})

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl'
    : 'relative z-10 flex max-h-[min(88vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl'
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

const activeProjectRoleCount = computed(() => {
  return Object.values(projectRoles.value).filter((value) => value.trim().length > 0).length
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

  const nextProjectRoles: Record<string, ProjectRoleSelection> = {}
  if (props.showProjectRoles !== false) {
    const availableProjectRoleValues = props.projectRoleOptions.map((option) => option.value)
    const defaultProjectRoleValue = availableProjectRoleValues[0] ?? ''

    for (const project of props.projects) {
      const initialProjectRole = props.initialProjectRoles[project.id] ?? ''
      nextProjectRoles[project.id] = availableProjectRoleValues.includes(initialProjectRole)
        ? initialProjectRole
        : defaultProjectRoleValue
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
      businessRole: selected.roleId,
      projectRoles: { ...projectRoles.value },
    })
    return
  }

  if (!selectedUserId.value.trim()) {
    validationMessage.value = '请选择成员'
    return
  }

  if (props.showProjectRoles !== false && props.projects.length > 0 && props.projectRoleOptions.length === 0) {
    validationMessage.value = '请先创建项目角色'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    mode: 'edit',
    userId: selectedUserId.value,
    businessRole: selected.roleId,
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

      <section :class="sectionClass">
        <header class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div class="space-y-1">
            <h2 class="text-base font-semibold text-foreground">{{ modeTitle }}</h2>
            <p class="text-sm text-muted-foreground">
              {{
                props.mode === 'create'
                  ? '选择业务线角色并生成邀请链接。'
                  : '统一调整成员的业务线角色和项目角色。'
              }}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
          >
            ×
          </button>
        </header>

        <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <section
              v-if="props.mode === 'edit'"
              class="rounded-2xl border border-border bg-muted/20 px-4 py-3"
            >
              <div class="flex flex-col gap-1">
                <p class="text-xs font-semibold text-muted-foreground">当前成员</p>
                <p class="text-sm font-semibold text-foreground">{{ displayUserLabel(selectedUserId) }}</p>
                <p class="text-xs text-muted-foreground">{{ displayUserMeta(selectedUserId) }}</p>
              </div>
            </section>

            <section class="rounded-2xl border border-border bg-muted/20 p-4">
              <div class="space-y-1">
                <p class="text-sm font-semibold text-foreground">业务线角色</p>
                <p class="text-xs text-muted-foreground">选择成员在当前业务线下的角色。</p>
              </div>

              <div class="mt-4 space-y-2">
                <label class="text-xs font-semibold text-muted-foreground">角色</label>
                <select
                  v-model="selectedRoleKey"
                  class="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                >
                  <optgroup v-if="defaultRoleOptions.length > 0" label="默认角色">
                    <option
                      v-for="option in defaultRoleOptions"
                      :key="option.key"
                      :value="option.key"
                    >
                      {{ option.label }}
                    </option>
                  </optgroup>
                  <optgroup v-if="customRoleOptions.length > 0" label="自定义角色">
                    <option
                      v-for="option in customRoleOptions"
                      :key="option.key"
                      :value="option.key"
                    >
                      {{ option.label }}
                    </option>
                  </optgroup>
                </select>
                <p
                  v-if="props.roleOptions.length === 0"
                  class="text-sm text-muted-foreground"
                >
                  请先创建角色
                </p>
              </div>
            </section>

            <section
              v-if="props.showProjectRoles !== false"
              class="rounded-2xl border border-border bg-muted/20 p-4"
            >
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p class="text-sm font-semibold text-foreground">项目角色</p>
                  <p class="mt-1 text-xs text-muted-foreground">按项目调整成员角色。</p>
                </div>
                <div class="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  已配置 {{ activeProjectRoleCount }} / {{ props.projects.length }} 个项目
                </div>
              </div>

              <div class="mt-4 space-y-2">
                <div
                  v-for="project in props.projects"
                  :key="project.id"
                  class="flex flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold text-foreground">{{ project.name }}</div>
                    <div class="mt-1 font-mono text-[11px] text-muted-foreground">{{ project.id }}</div>
                  </div>
                  <select
                    v-model="projectRoles[project.id]"
                    class="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground lg:w-44"
                  >
                    <option
                      v-for="option in props.projectRoleOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
            </section>

            <section
              v-if="props.mode === 'create'"
              class="rounded-2xl border border-border bg-muted/20 px-4 py-3"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p class="text-sm font-semibold text-foreground">邀请链接</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ inviteExpiresLabel }}</p>
                </div>
                <button
                  type="button"
                  class="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="!props.inviteLink"
                  @click="copyInviteLink"
                >
                  {{ copyButtonText }}
                </button>
              </div>

              <div
                class="mt-3 rounded-2xl border border-dashed border-border bg-background px-3 py-3 text-xs text-muted-foreground"
              >
                <span v-if="props.inviteLink" class="break-all">{{ props.inviteLink }}</span>
                <span v-else>提交后生成最新邀请链接</span>
              </div>
            </section>

            <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
            <p v-else-if="props.errorMessage" class="text-sm text-destructive">
              {{ props.errorMessage }}
            </p>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-border bg-background/95 px-5 py-4">
            <button
              type="button"
              class="h-10 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="submit"
              class="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
