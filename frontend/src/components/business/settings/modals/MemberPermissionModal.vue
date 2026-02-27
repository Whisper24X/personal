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
  errorMessage?: string
}>()

const emit = defineEmits<{
  (
    event: 'submit',
    payload: {
      userId: string
      businessRole: BusinessLineMemberRole
      projectRoles: Record<string, ProjectPermissionRole>
    },
  ): void
  (event: 'update:open', value: boolean): void
}>()

const userKeyword = ref('')
const selectedUserId = ref('')
const businessRole = ref<BusinessLineMemberRole>('member')
const projectRoles = ref<Record<string, ProjectPermissionRole>>({})
const validationMessage = ref('')

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
  return props.mode === 'edit' ? '编辑成员权限' : '添加成员与权限'
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

  return user.email ?? user.username
}

const filteredUsers = computed(() => {
  const keyword = userKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return props.users
  }

  return props.users.filter((user) => {
    const nickname = user.nickname?.toLowerCase() ?? ''
    const username = user.username.toLowerCase()
    const email = user.email?.toLowerCase() ?? ''

    return nickname.includes(keyword) || username.includes(keyword) || email.includes(keyword)
  })
})

const syncState = () => {
  selectedUserId.value = props.initialUserId
  businessRole.value = props.initialBusinessRole
  validationMessage.value = ''

  const nextProjectRoles: Record<string, ProjectPermissionRole> = {}
  for (const project of props.projects) {
    nextProjectRoles[project.id] = props.initialProjectRoles[project.id] ?? 'none'
  }
  projectRoles.value = nextProjectRoles

  if (props.mode === 'edit' && props.initialUserId) {
    userKeyword.value = displayUserLabel(props.initialUserId)
    return
  }

  userKeyword.value = ''
}

const close = () => {
  emit('update:open', false)
}

const submit = () => {
  if (!selectedUserId.value.trim()) {
    validationMessage.value = '请选择成员'
    return
  }

  validationMessage.value = ''
  emit('submit', {
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
          <div class="grid gap-3 md:grid-cols-2">
            <label v-if="props.mode === 'create'" class="space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">搜索成员</span>
              <input
                v-model="userKeyword"
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="search"
                placeholder="按昵称/用户名/邮箱搜索"
              />
            </label>

            <label class="space-y-1" :class="props.mode === 'create' ? '' : 'md:col-span-2'">
              <span class="text-xs font-semibold text-muted-foreground">成员</span>
              <template v-if="props.mode === 'create'">
                <select
                  v-model="selectedUserId"
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="" disabled>请选择成员</option>
                  <option v-for="user in filteredUsers" :key="user.id" :value="user.id">
                    {{ user.nickname?.trim() || user.username }}
                  </option>
                </select>
              </template>
              <div v-else class="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground">
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
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting || props.preparing"
            >
              {{ props.preparing ? '加载中...' : props.submitting ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
