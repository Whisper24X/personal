<script setup lang="ts">
import type { TaskMessage, TaskStatus } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailExecutionPanel',
})

const props = defineProps<{
  title: string
  loading: boolean
  taskStatus: TaskStatus | null
  taskStatusLabel: string
  taskStatusClass: string
  streamConnected: boolean
  messages: TaskMessage[]
  formatDate: (value?: string) => string
}>()

const roleClassMap: Record<TaskMessage['role'], string> = {
  user: 'bg-primary/10 text-primary',
  assistant: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  system: 'bg-muted text-muted-foreground',
  error: 'bg-destructive/10 text-destructive',
}

const roleLabelMap: Record<TaskMessage['role'], string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System',
  error: 'Error',
}
</script>

<template>
  <section class="border-border/50 bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
    <div class="border-border/50 bg-background/95 sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur">
      <div class="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
        <span>{{ props.title }}</span>
        <span class="text-[10px]" :class="props.streamConnected ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'">
          {{ props.streamConnected ? 'SSE 已连接' : 'SSE 未连接' }}
        </span>
      </div>

      <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="props.taskStatusClass">
        {{ props.taskStatusLabel }}
      </span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div v-if="props.loading" class="flex h-full items-center justify-center text-sm text-muted-foreground">加载执行内容中...</div>

      <div v-else-if="props.messages.length > 0" class="space-y-2">
        <article
          v-for="(message, index) in props.messages"
          :key="`${index}-${message.createdAt}`"
          class="rounded-lg border border-border bg-background/80 px-3 py-2"
        >
          <div class="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span class="rounded-md px-1.5 py-0.5" :class="roleClassMap[message.role]">{{ roleLabelMap[message.role] }}</span>
            <span class="text-muted-foreground">{{ props.formatDate(message.createdAt) }}</span>
          </div>
          <p class="whitespace-pre-wrap break-words text-xs text-foreground">
            {{ message.content }}
          </p>
        </article>
      </div>

      <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
        暂无执行消息。
      </div>
    </div>
  </section>
</template>
