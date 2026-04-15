<script setup lang="ts">
import type { BusinessLineMember } from '@/api/business-lines'

defineOptions({ name: 'BlmMembersTab' })

const memberQuery = defineModel<string>('memberQuery', { required: true })

defineProps<{
  activeLineId: string
  loadingMembers: boolean
  filteredMembers: BusinessLineMember[]
  canInviteMembers: boolean
  canUpdateMemberRole: boolean
  canRemoveMembers: boolean
  displayUserLabel: (userId: string) => string
  displayUserMeta: (userId: string) => string
  displayBusinessLineRoleLabel: (member: BusinessLineMember) => string
  formatDate: (value?: string) => string
  roleBadgeClass: (role: string) => string
}>()

const emit = defineEmits<{
  refresh: []
  'invite-member': []
  'edit-member': [member: BusinessLineMember]
  'remove-member': [member: BusinessLineMember]
}>()
</script>

<template>
  <section class="space-y-4">
    <div class="panel-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">成员列表（{{ filteredMembers.length }}）</p>
          <p class="mt-1 text-xs text-muted-foreground">
            管理业务线成员，并为成员分配默认角色或自定义角色。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            @click="emit('refresh')"
          >
            刷新
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId || !canInviteMembers"
            @click="emit('invite-member')"
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
            <tr
              v-for="member in filteredMembers"
              :key="member.id"
              class="transition hover:bg-background/70"
            >
              <td class="px-4 py-3">
                <p class="text-sm font-semibold">{{ displayUserLabel(member.userId) }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">{{ displayUserMeta(member.userId) }}</p>
                <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">{{ member.userId }}</p>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full border px-2 py-1 text-xs font-semibold"
                  :class="roleBadgeClass(displayBusinessLineRoleLabel(member))"
                >
                  {{ displayBusinessLineRoleLabel(member) }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">{{ formatDate(member.updatedAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    v-if="canUpdateMemberRole"
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                    @click="emit('edit-member', member)"
                  >
                    编辑角色
                  </button>
                  <button
                    v-if="canRemoveMembers"
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                    @click="emit('remove-member', member)"
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
</template>
