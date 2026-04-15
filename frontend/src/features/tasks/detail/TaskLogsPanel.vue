<script setup lang="ts">
import type { TaskLog, TaskLogLevel } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailTaskLogsPanel',
})

const props = defineProps<{
  logs: TaskLog[]
  formatDate: (value?: string) => string
}>()

const levelClass = (level: TaskLogLevel) => {
  if (level === 'error') {
    return 'text-destructive'
  }
  if (level === 'warn') {
    return 'text-amber-600 dark:text-amber-400'
  }
  return 'text-primary'
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="text-muted-foreground border-border/70 border-b px-4 py-2 text-xs font-medium">
      任务日志（{{ props.logs.length }}）
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div
        v-if="props.logs.length === 0"
        class="text-muted-foreground py-8 text-center text-xs"
      >
        暂无日志
      </div>
      <div
        v-for="log in props.logs"
        :key="log.id"
        class="border-border/40 font-mono text-[11px] leading-relaxed text-foreground/85 [&+&]:mt-1.5"
      >
        <span class="date">[{{ props.formatDate(log.createdAt) }}]</span>
        <span class="ml-1 uppercase" :class="levelClass(log.level)">{{ log.level }}</span>
        <span class="ml-1 break-all">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>
