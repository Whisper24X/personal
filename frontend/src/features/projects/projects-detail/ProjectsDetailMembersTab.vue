<script setup lang="ts">
import AppSelect from '@shared/components/select'

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailMembersTab' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
  <section
    v-if="!ctx.workflowOnlyMode && ctx.tab === 'members' && ctx.canManageProjectMembers"
    class="space-y-4"
  >
    <div class="panel-card p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">成员管理</p>
          <p class="mt-1 text-xs text-muted-foreground">
            新增成员支持直接分配项目角色。
          </p>
        </div>
        <button
          v-if="ctx.canManageProjectMembers"
          class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          type="button"
          @click="ctx.openMemberFormModal"
        >
          添加成员
        </button>
      </div>
    </div>

    <div class="panel-card overflow-hidden">
      <table class="w-full min-w-[680px] text-left text-sm">
        <thead class="border-b border-border bg-background/60">
          <tr class="text-xs font-semibold text-muted-foreground">
            <th class="px-5 py-3">用户</th>
            <th class="px-5 py-3">角色</th>
            <th class="px-5 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="member in ctx.projectMembers"
            :key="member.id"
            class="transition hover:bg-background/70"
          >
            <td class="px-5 py-4">
              <p class="text-sm font-semibold">{{ ctx.displayUserName(member.userId) }}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ ctx.displayUserMeta(member.userId) }}
              </p>
              <p class="mt-1 font-mono text-[11px] text-muted-foreground">
                {{ member.userId }}
              </p>
            </td>
            <td class="px-5 py-4">
              <AppSelect
                :model-value="ctx.memberRoleDrafts[member.userId] ?? ''"
                aria-label="项目成员角色"
                :disabled="!ctx.canManageProjectMembers || ctx.updatingMemberId === member.userId"
                :block="false"
                :options="ctx.projectRoleSelectOptions"
                trigger-class="h-9 rounded-lg border-border bg-background px-3 text-sm shadow-none"
                @update:model-value="ctx.memberRoleDrafts[member.userId] = String($event ?? '')"
              />
              <p v-if="member.customRoleName" class="mt-1 text-[11px] text-muted-foreground">
                当前：{{ member.customRoleName }}
              </p>
            </td>
            <td class="px-5 py-4">
              <div class="flex justify-end gap-2">
                <button
                  v-if="ctx.canManageProjectMembers"
                  class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="ctx.updatingMemberId === member.userId"
                  type="button"
                  @click="ctx.updateMemberRole(member)"
                >
                  {{ ctx.updatingMemberId === member.userId ? '保存中...' : '保存角色' }}
                </button>
                <button
                  v-if="ctx.canManageProjectMembers"
                  class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="ctx.removingMemberId === member.userId"
                  type="button"
                  @click="ctx.removeMember(member)"
                >
                  {{ ctx.removingMemberId === member.userId ? '移除中...' : '移除' }}
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="ctx.projectMembers.length === 0">
            <td class="px-5 py-6 text-sm text-muted-foreground" colspan="3">
              暂无成员，请先添加。
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
