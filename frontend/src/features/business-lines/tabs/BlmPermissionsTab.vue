<script setup lang="ts">
import type { BusinessLineCustomRole } from '@/api/business-lines'
import type { ProjectCustomRole } from '@/types/api/projects'
import {
  formatBusinessLineRoleCapabilitiesDisplay,
  formatProjectRoleCapabilitiesDisplay,
} from '@shared/constants/access'

defineOptions({ name: 'BlmPermissionsTab' })

const activePermissionRoleTab = defineModel<'business-line' | 'project'>('activePermissionRoleTab', {
  required: true,
})

defineProps<{
  activeLineId: string
  loadingCustomRoles: boolean
  lineCustomRoles: BusinessLineCustomRole[]
  canCreateBusinessLineRole: boolean
  canUpdateBusinessLineRole: boolean
  canDeleteBusinessLineRole: boolean
  deletingCustomRoleId: string
  loadingPermissionProjectRoleLibrary: boolean
  permissionProjectRoleLibrary: ProjectCustomRole[]
  canManagePermissionProjectRoles: boolean
  deletingPermissionProjectRoleId: string
}>()

const emit = defineEmits<{
  'refresh-line-roles': []
  'create-line-role': []
  'edit-line-role': [role: BusinessLineCustomRole]
  'remove-line-role': [role: BusinessLineCustomRole]
  'refresh-project-roles': []
  'create-project-role': []
  'edit-project-role': [role: ProjectCustomRole]
  'remove-project-role': [role: ProjectCustomRole]
}>()

const permissionRoleTabClass = (tab: 'business-line' | 'project') => {
  return tab === activePermissionRoleTab.value
    ? 'border border-border bg-background text-foreground shadow-sm shadow-primary/5'
    : 'border border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground'
}
</script>

<template>
  <section class="space-y-4">
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

    <div v-if="activePermissionRoleTab === 'business-line'" class="panel-card space-y-4 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">角色列表（{{ lineCustomRoles.length }}）</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            @click="emit('refresh-line-roles')"
          >
            刷新
          </button>
          <button
            v-if="canCreateBusinessLineRole"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
            @click="emit('create-line-role')"
          >
            新建
          </button>
        </div>
      </div>

      <div v-if="loadingCustomRoles" class="text-sm text-muted-foreground">加载业务线角色中...</div>
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
                @click="emit('edit-line-role', role)"
              >
                编辑
              </button>
              <button
                v-if="canDeleteBusinessLineRole"
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="deletingCustomRoleId === role.id"
                @click="emit('remove-line-role', role)"
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
          <p class="text-sm font-semibold">角色列表（{{ permissionProjectRoleLibrary.length }}）</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId"
            @click="emit('refresh-project-roles')"
          >
            刷新
          </button>
          <button
            v-if="canManagePermissionProjectRoles"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
            @click="emit('create-project-role')"
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
      <div v-else-if="loadingPermissionProjectRoleLibrary" class="text-sm text-muted-foreground">
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
            <div v-if="canManagePermissionProjectRoles" class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                @click="emit('edit-project-role', role)"
              >
                编辑
              </button>
              <button
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="deletingPermissionProjectRoleId === role.id"
                @click="emit('remove-project-role', role)"
              >
                {{ deletingPermissionProjectRoleId === role.id ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
