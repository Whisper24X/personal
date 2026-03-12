<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseOpencodeMessages } from './parser'
import { groupOpencodeEntries } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import type { NormalizedEntry } from '../types'
import { formatTime, getString } from '../utils'

defineOptions({ name: 'CliOpencodeRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseOpencodeMessages(props.messages))
const groups = computed(() => groupOpencodeEntries(entries.value))

function isSdkEvent(entry: NormalizedEntry) {
  return entry.type === 'system_message' && getString(entry.metadata?.sdkEventType) !== undefined
}
</script>

<template>
  <div v-if="groups.length > 0" class="space-y-3">
    <template v-for="(group, idx) in groups" :key="idx">
      <TaskGroupCard v-if="group.type === 'task'" :group="group" />

      <UserMessage
        v-else-if="group.type === 'other' && group.entry.type === 'user_message'"
        :entry="group.entry"
      />

      <!-- SDK event -->
      <div
        v-else-if="group.type === 'other' && isSdkEvent(group.entry)"
        class="flex items-center gap-2 rounded-md border border-border/30 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground"
      >
        <span>⚙</span>
        <span class="font-mono">{{ getString(group.entry.metadata?.sdkEventType) }}</span>
        <span class="truncate">{{ group.entry.content }}</span>
        <span class="ml-auto shrink-0">{{ formatTime(group.entry.timestamp) }}</span>
      </div>

      <!-- Error -->
      <div
        v-else-if="group.type === 'other' && group.entry.type === 'error'"
        class="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2"
      >
        <div class="flex items-center gap-2 text-xs">
          <span class="text-red-500">⚠</span>
          <span class="font-medium text-red-600">Error</span>
          <span class="ml-auto text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
        </div>
        <p class="mt-1 whitespace-pre-wrap text-sm text-red-600">{{ group.entry.content }}</p>
      </div>

      <!-- System message -->
      <div
        v-else-if="group.type === 'other'"
        class="px-2 py-1 text-xs text-muted-foreground"
      >
        <AssistantMessage :content="group.entry.content" />
      </div>
    </template>
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
