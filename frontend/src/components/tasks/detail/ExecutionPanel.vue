<script setup lang="ts">
import type { TaskMessage, TaskStatus } from '@/types/api/tasks'
import CliLogRenderer from './cli/CliLogRenderer.vue'

defineOptions({
  name: 'TaskDetailExecutionPanel',
})

const props = defineProps<{
  title: string
  loading: boolean
  agentCliId: string
  taskStatus: TaskStatus | null
  taskStatusLabel: string
  taskStatusClass: string
  streamConnected: boolean
  messages: TaskMessage[]
  formatDate: (value?: string) => string
}>()
</script>

<template>
  <section class="border-border/50 bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
    <div class="border-border/50 bg-background/95 sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur">
      <div class="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
        <span>{{ props.title }}</span>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div v-if="props.loading" class="flex h-full items-center justify-center text-sm text-muted-foreground">加载执行内容中...</div>

      <CliLogRenderer
        v-else
        :agent-cli-id="props.agentCliId"
        :messages="props.messages"
      />
    </div>
  </section>
</template>
