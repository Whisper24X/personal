<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseGeminiMessages } from './parser'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import { formatTime } from '../utils'

defineOptions({ name: 'CliGeminiRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseGeminiMessages(props.messages))
</script>

<template>
  <div v-if="entries.length > 0" class="space-y-3">
    <template v-for="entry in entries" :key="entry.id">
      <UserMessage
        v-if="entry.type === 'user_message'"
        :entry="entry"
      />

      <div v-else-if="entry.type === 'assistant_message'" class="rounded-lg border border-border/50 bg-background px-3 py-2.5">
        <AssistantMessage :content="entry.content" />
      </div>

      <div
        v-else-if="entry.type === 'error'"
        class="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2"
      >
        <div class="flex items-center gap-2 text-xs">
          <span class="text-red-500">⚠</span>
          <span class="font-medium text-red-600">Error</span>
          <span class="ml-auto text-muted-foreground">{{ formatTime(entry.timestamp) }}</span>
        </div>
        <p class="mt-1 whitespace-pre-wrap text-sm text-red-600">{{ entry.content }}</p>
      </div>

      <div v-else class="px-2 py-1 text-xs text-muted-foreground">
        {{ entry.content }}
      </div>
    </template>
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
