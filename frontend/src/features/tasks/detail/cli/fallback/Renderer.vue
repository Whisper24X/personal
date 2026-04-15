<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseFallbackMessages } from './parser'
import AssistantMessageShell from '../AssistantMessageShell.vue'
import { formatTime } from '../utils'

defineOptions({ name: 'CliFallbackRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseFallbackMessages(props.messages))
const shellTimeLabel = computed(() => {
  const first = entries.value[0]
  return first ? formatTime(first.timestamp) : ''
})
</script>

<template>
  <div v-if="entries.length > 0" class="space-y-1.5">
    <AssistantMessageShell
      :time-label="shellTimeLabel"
      :wrap-body="false"
    >
      <div class="space-y-3">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="rounded-md border px-3 py-2"
          :class="entry.type === 'error' ? 'border-red-500/20 bg-red-500/5' : 'border-border/50 bg-muted/20'"
        >
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{{ entry.type === 'error' ? '⚠' : '📄' }}</span>
            <span :class="entry.type === 'error' ? 'text-red-600 font-medium' : ''">
              {{ entry.type === 'error' ? 'Error' : 'Output' }}
            </span>
          </div>
          <pre class="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs text-foreground">{{ entry.content }}</pre>
        </div>
      </div>
    </AssistantMessageShell>
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
