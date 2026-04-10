<script setup lang="ts">
import AppSelect from '@shared/components/select'

import { useProjectsDetailPageInject } from '../use-projects-detail-page-inject'

defineOptions({ name: 'ProjectsDetailMemberFormModal' })

const ctx = useProjectsDetailPageInject()
</script>

<template>
<Teleport to="body">
  <div
    v-if="ctx.memberFormModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="project-member-form-modal-title"
    @click.self="ctx.closeMemberFormModal"
  >
    <section
      class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
    >
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="project-member-form-modal-title" class="text-sm font-semibold">添加成员</h2>
        <button
          class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          type="button"
          aria-label="关闭成员弹窗"
          @click="ctx.closeMemberFormModal"
        >
          关闭
        </button>
      </header>

      <form
        class="grid gap-3 px-4 py-4 md:grid-cols-[1fr_200px]"
        @submit.prevent="ctx.createMember"
      >
        <input
          v-model="ctx.newMemberForm.userId"
          class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          list="project-member-user-options"
          placeholder="输入或选择用户"
          type="text"
        />
        <datalist id="project-member-user-options">
          <option v-for="user in ctx.users" :key="user.id" :value="user.id">
            {{ user.nickname?.trim() || user.username }}
          </option>
        </datalist>
        <AppSelect
          v-model="ctx.newMemberForm.roleKey"
          aria-label="新成员角色"
          :options="ctx.projectRoleSelectOptions"
          trigger-class="h-10 rounded-lg border-border bg-background px-3 text-sm shadow-none"
        />
        <div class="md:col-span-2 flex justify-end gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground"
            type="button"
            @click="ctx.closeMemberFormModal"
          >
            取消
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="ctx.creatingMember"
            type="submit"
          >
            {{ ctx.creatingMember ? '添加中...' : '添加成员' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</Teleport>
</template>
