<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseGeminiMessages } from './parser'
import { groupGeminiEntries, type GeminiMessageGroup } from './groupEntries'
import TaskGroupCard from '../claude-code/TaskGroupCard.vue'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import type { NormalizedEntry } from '../types'
import { formatTime, getString } from '../utils'

defineOptions({ name: 'CliGeminiRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseGeminiMessages(props.messages))
const groups = computed(() => groupGeminiEntries(entries.value))

function isResultEntry(entry: NormalizedEntry) {
  return entry.metadata?.isResult === true
}

function isInitEntry(entry: NormalizedEntry) {
  return entry.metadata?.isInit === true
}

function formatStatus(entry: NormalizedEntry): string {
  const status = getString(entry.metadata?.resultStatus)
  return status ? status.replace(/[_-]+/g, ' ') : 'completed'
}

function getGroupKey(group: GeminiMessageGroup): string {
  return group.id
}
</script>

<template>
  <div v-if="groups.length > 0" class="space-y-3">
    <template v-for="group in groups" :key="getGroupKey(group)">
      <TaskGroupCard v-if="group.type === 'task'" :group="group" />

      <UserMessage
        v-else-if="group.type === 'other' && group.entry.type === 'user_message'"
        :entry="group.entry"
      />

      <div
        v-else-if="group.type === 'other' && group.entry.type === 'assistant_message'"
        class="rounded-lg border border-border/50 bg-background px-3 py-2.5"
      >
        <AssistantMessage :content="group.entry.content" />
      </div>

      <div
        v-else-if="group.type === 'other' && isResultEntry(group.entry)"
        class="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600"
      >
        <span>✓</span>
        <span class="font-medium">Completed</span>
        <span class="text-muted-foreground">{{ formatStatus(group.entry) }}</span>
        <span class="ml-auto text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
      </div>

      <div
        v-else-if="group.type === 'other' && isInitEntry(group.entry)"
        class="flex flex-wrap items-center gap-2 rounded-md border border-border/30 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
      >
        <span>⚙</span>
        <span class="font-medium text-foreground">{{ group.entry.content }}</span>
        <span class="ml-auto">{{ formatTime(group.entry.timestamp) }}</span>
      </div>

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
