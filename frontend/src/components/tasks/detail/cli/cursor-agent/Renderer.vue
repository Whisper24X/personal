<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCursorAgentMessages } from './parser'
import { groupEntries } from '../components/groupEntries'
import TaskGroupCard from '../components/TaskGroupCard.vue'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import type { NormalizedEntry } from '../types'
import { formatTime, getNumber, getString } from '../utils'

defineOptions({ name: 'CliCursorAgentRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseCursorAgentMessages(props.messages))
const groups = computed(() => groupEntries(entries.value))

function isResultEntry(entry: NormalizedEntry) {
  return entry.metadata?.isResult === true
}

function isSuccess(entry: NormalizedEntry): boolean {
  return entry.type !== 'error'
}

function formatUsage(entry: NormalizedEntry): string {
  const parts: string[] = []
  const input = getNumber(entry.metadata?.inputTokens)
  const output = getNumber(entry.metadata?.outputTokens)
  const cached = getNumber(entry.metadata?.cacheReadTokens)
  if (input) parts.push(`in: ${input}`)
  if (cached) parts.push(`cached: ${cached}`)
  if (output) parts.push(`out: ${output}`)
  return parts.join(', ')
}

function hasModel(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.model) !== undefined
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

      <!-- Result summary with duration + token usage -->
      <div
        v-else-if="group.type === 'other' && isResultEntry(group.entry)"
        class="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs"
        :class="isSuccess(group.entry) ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'"
      >
        <span :class="isSuccess(group.entry) ? 'text-emerald-600' : 'text-red-600'">
          {{ isSuccess(group.entry) ? '✓' : '✗' }}
        </span>
        <span class="font-medium" :class="isSuccess(group.entry) ? 'text-emerald-600' : 'text-red-600'">
          {{ group.entry.content }}
        </span>
        <span v-if="formatUsage(group.entry)" class="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {{ formatUsage(group.entry) }}
        </span>
        <span class="ml-auto text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
      </div>

      <!-- System init -->
      <div
        v-else-if="group.type === 'other' && hasModel(group.entry)"
        class="flex items-center gap-2 rounded-md border border-border/30 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground"
      >
        <span>⚙</span>
        <span>{{ group.entry.content }}</span>
        <span class="ml-auto">{{ formatTime(group.entry.timestamp) }}</span>
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

      <!-- Other system message -->
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
