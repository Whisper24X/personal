<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailTaskCard',
})

const props = defineProps<{
  task: Task | null
  statusLabel: string
  statusClass: string
  modeLabel: string
  branchLabel: string
  actionLoading: boolean
  canExecute: boolean
  canRemove?: boolean
}>()

const emit = defineEmits<{
  execute: []
  refresh: []
  remove: []
}>()

const visibleMetaChips = computed(() => {
  return [
    {
      key: 'mode',
      label: `模式 ${props.modeLabel}`,
    },
  ]
})
</script>

<template>
  <section class="border-border/50 bg-background/95 w-full rounded-xl border shadow-sm">
    <div class="border-border/50 flex items-center justify-between gap-3 border-b px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground text-xs font-semibold">Task</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.actionLoading || !props.canExecute"
          type="button"
          @click="emit('execute')"
        >
          执行
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
      <p class="text-foreground break-words text-sm font-medium">
        {{ props.task?.title ?? '任务详情' }}
      </p>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="inline-flex items-center rounded-md px-2 py-1" :class="props.statusClass">
          {{ props.statusLabel }}
        </span>
        <span
          v-for="chip in visibleMetaChips"
          :key="chip.key"
          class="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground"
        >
          {{ chip.label }}
        </span>
      </div>
    </div>
  </section>
</template>
