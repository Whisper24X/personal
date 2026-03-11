<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseClaudeCodeMessages } from './parser'
import { groupEntries } from '../components/groupEntries'
import TaskGroupCard from '../components/TaskGroupCard.vue'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import type { NormalizedEntry } from '../types'
import { formatTime, getNumber, getString } from '../utils'

defineOptions({ name: 'CliClaudeCodeRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseClaudeCodeMessages(props.messages))
const groups = computed(() => groupEntries(entries.value))

function isResultEntry(entry: NormalizedEntry) {
  return entry.type === 'system_message' && entry.metadata?.resultSubtype !== undefined
}

function formatDuration(entry: NormalizedEntry): string {
  const ms = getNumber(entry.metadata?.durationMs)
  if (!ms) return ''
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCost(entry: NormalizedEntry): string {
  const cost = getNumber(entry.metadata?.totalCostUsd)
  if (!cost) return ''
  return `$${cost.toFixed(4)}`
}

function isSuccess(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.resultSubtype) === 'success'
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

      <!-- Result summary with cost/duration -->
      <div
        v-else-if="group.type === 'other' && isResultEntry(group.entry)"
        class="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
        :class="isSuccess(group.entry) ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600' : 'border-red-500/20 bg-red-500/5 text-red-600'"
      >
        <span>{{ isSuccess(group.entry) ? '✓' : '✗' }}</span>
        <span class="font-medium">Completed</span>
        <span v-if="formatDuration(group.entry)" class="text-muted-foreground">
          in {{ formatDuration(group.entry) }}
        </span>
        <span v-if="formatCost(group.entry)" class="text-muted-foreground">
          ({{ formatCost(group.entry) }})
        </span>
        <span class="ml-auto text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
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
