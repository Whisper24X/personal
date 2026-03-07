<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { Task } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailTaskCard',
})

const props = defineProps<{
  taskId: string
  task: Task | null
  statusLabel: string
  statusClass: string
  modeLabel: string
  taskListRoute: RouteLocationRaw | string
  projectDetailRoute: string | null
  createdAtLabel: string
  updatedAtLabel: string
  branchLabel: string
  actionLoading: boolean
  canExecute: boolean
  canCancel: boolean
  canCleanupWorktree: boolean
  canEdit?: boolean
  canRemove?: boolean
}>()

const emit = defineEmits<{
  execute: []
  cancel: []
  cleanup: []
  refresh: []
  edit: []
  remove: []
}>()

const toolMeta = computed(() => {
  return {
    cliToolId: props.task?.cliToolId || '-',
    cliConfigId: props.task?.agentToolConfigId || '-',
  }
})
</script>

<template>
  <section class="border-border/50 bg-background/95 rounded-xl border shadow-sm">
    <div class="border-border/50 flex items-center justify-between border-b px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground text-xs font-semibold">Task</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="h-8 rounded-md border border-border bg-background px-2 text-xs font-semibold text-foreground"
          type="button"
          @click="emit('refresh')"
        >
          刷新
        </button>
      </div>
    </div>

    <div class="space-y-3 px-3 py-3">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <RouterLink :to="props.taskListRoute" class="hover:text-foreground hover:underline">任务列表</RouterLink>
        <span>/</span>
        <span class="font-mono">{{ props.taskId }}</span>
        <template v-if="props.projectDetailRoute">
          <span>/</span>
          <RouterLink :to="props.projectDetailRoute" class="hover:text-foreground hover:underline">项目详情</RouterLink>
        </template>
      </div>

      <p class="text-foreground break-words text-sm font-medium">
        {{ props.task?.title ?? '任务详情' }}
      </p>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="inline-flex items-center rounded-md px-2 py-1" :class="props.statusClass">
          {{ props.statusLabel }}
        </span>
        <span class="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">项目 {{ props.task?.projectId ?? '-' }}</span>
        <span class="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">模式 {{ props.modeLabel }}</span>
        <span class="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">分支 {{ props.branchLabel }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.actionLoading || !props.canExecute"
          type="button"
          @click="emit('execute')"
        >
          执行
        </button>
        <button
          class="h-8 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.actionLoading || !props.canCancel"
          type="button"
          @click="emit('cancel')"
        >
          停止
        </button>
        <button
          class="h-8 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.actionLoading || !props.canCleanupWorktree"
          type="button"
          @click="emit('cleanup')"
        >
          清理工作区
        </button>
        <button
          class="h-8 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!props.canEdit"
          type="button"
          @click="emit('edit')"
        >
          编辑
        </button>
        <button
          v-if="props.canRemove"
          class="h-8 rounded-md border border-destructive/40 bg-background px-3 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.actionLoading"
          type="button"
          @click="emit('remove')"
        >
          删除
        </button>
      </div>

      <div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span>创建：{{ props.createdAtLabel }}</span>
        <span>更新：{{ props.updatedAtLabel }}</span>
        <span>CLI 工具：{{ toolMeta.cliToolId }}</span>
        <span>CLI 配置：{{ toolMeta.cliConfigId }}</span>
      </div>
    </div>
  </section>
</template>
