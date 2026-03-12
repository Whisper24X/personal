<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseClaudeCodeMessages } from './parser'
import { groupClaudeEntries } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import type { NormalizedEntry } from '../types'
import { formatTime, getNumber, getString } from '../utils'

defineOptions({ name: 'CliClaudeCodeRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseClaudeCodeMessages(props.messages))
const groups = computed(() => groupClaudeEntries(entries.value))

function isResultEntry(entry: NormalizedEntry) {
  return entry.metadata?.isResult === true
}

function isInitEntry(entry: NormalizedEntry) {
  return entry.metadata?.isInit === true
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

function formatUsage(entry: NormalizedEntry): string {
  const parts: string[] = []
  const input = getNumber(entry.metadata?.inputTokens)
  const cacheRead = getNumber(entry.metadata?.cacheReadTokens)
  const output = getNumber(entry.metadata?.outputTokens)
  if (input) parts.push(`in: ${input}`)
  if (cacheRead) parts.push(`cached: ${cacheRead}`)
  if (output) parts.push(`out: ${output}`)
  return parts.join(', ')
}

function formatTurns(entry: NormalizedEntry): string {
  const turns = getNumber(entry.metadata?.numTurns)
  return turns ? `${turns} turns` : ''
}

function formatStopReason(entry: NormalizedEntry): string {
  const reason = getString(entry.metadata?.stopReason)
  return reason ? `stop: ${reason}` : ''
}

function formatInitMeta(entry: NormalizedEntry): string {
  const parts: string[] = []
  const permissionMode = getString(entry.metadata?.permissionMode)
  const mcpConnected = getNumber(entry.metadata?.mcpConnectedCount)
  const mcpTotal = getNumber(entry.metadata?.mcpServerCount)
  const cwdName = getString(entry.metadata?.cwdName)
  const version = getString(entry.metadata?.claudeCodeVersion)
  if (permissionMode) parts.push(`perm: ${permissionMode}`)
  if (typeof mcpConnected === 'number' && typeof mcpTotal === 'number') {
    parts.push(`mcp: ${mcpConnected}/${mcpTotal}`)
  }
  if (cwdName) parts.push(`cwd: ${cwdName}`)
  if (version) parts.push(`v${version}`)
  return parts.join(' · ')
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
        class="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs"
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
        <span v-if="formatTurns(group.entry)" class="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {{ formatTurns(group.entry) }}
        </span>
        <span v-if="formatUsage(group.entry)" class="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {{ formatUsage(group.entry) }}
        </span>
        <span v-if="formatStopReason(group.entry)" class="text-muted-foreground">
          {{ formatStopReason(group.entry) }}
        </span>
        <span class="ml-auto text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
      </div>

      <div
        v-else-if="group.type === 'other' && isInitEntry(group.entry)"
        class="flex flex-wrap items-center gap-2 rounded-md border border-border/30 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
      >
        <span>⚙</span>
        <span class="font-medium text-foreground">{{ group.entry.content }}</span>
        <span v-if="formatInitMeta(group.entry)" class="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px]">
          {{ formatInitMeta(group.entry) }}
        </span>
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
