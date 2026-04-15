<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseClaudeCodeMessages } from './parser'
import { groupClaudeEntries } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from './UserMessage.vue'
import AssistantMessage from './AssistantMessage.vue'
import AssistantMessageShell from '../AssistantMessageShell.vue'
import AssistantTurnContentBubble from '../AssistantTurnContentBubble.vue'
import { mergeAssistantTurns } from '../mergeAssistantTurns'
import type { ClaudeMessageGroup } from './groupEntries'
import type { NormalizedEntry } from '../types'
import { collapseDetailWhenTurnDone } from '../taskGroupCollapse'
import { assistantTurnTimeLabel, getNumber, getString } from '../utils'

defineOptions({ name: 'CliClaudeCodeRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
  formatDate?: (value?: string) => string
}>()

const entries = computed(() => parseClaudeCodeMessages(props.messages))
const groups = computed(() => groupClaudeEntries(entries.value))
const turns = computed(() =>
  mergeAssistantTurns(groups.value, (g: ClaudeMessageGroup) => g.type === 'other' && g.entry.type === 'user_message'),
)

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

function claudeTurnFinished(items: ClaudeMessageGroup[]): boolean {
  return items.some((g) => g.type === 'other' && isResultEntry(g.entry))
}
</script>

<template>
  <div v-if="groups.length > 0" class="space-y-3">
    <template v-for="(turn, tIdx) in turns" :key="tIdx">
      <UserMessage
        v-if="turn.kind === 'user' && turn.item.type === 'other'"
        :entry="turn.item.entry"
        :format-date="props.formatDate"
      />

      <AssistantMessageShell
        v-else-if="turn.kind === 'assistant'"
        :time-label="assistantTurnTimeLabel(turn.items, props.formatDate)"
        :wrap-body="false"
      >
        <div class="space-y-3">
          <AssistantTurnContentBubble>
            <template v-for="(group, idx) in turn.items" :key="idx">
              <TaskGroupCard
                v-if="group.type === 'task'"
                embedded
                :group="group"
                :collapse-detail-when-done="collapseDetailWhenTurnDone(claudeTurnFinished(turn.items), idx, turn.items)"
              />

              <!-- Result summary with cost/duration -->
              <div
                v-else-if="group.type === 'other' && isResultEntry(group.entry)"
                class="flex flex-wrap items-center gap-2 border-0 px-3 py-2 text-xs"
                :class="isSuccess(group.entry) ? 'bg-emerald-500/5 text-emerald-600' : 'bg-red-500/5 text-red-600'"
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
              </div>

              <div
                v-else-if="group.type === 'other' && isInitEntry(group.entry)"
                class="flex flex-wrap items-center gap-2 border-0 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
              >
              <span>⚙</span>
              <span class="font-medium text-foreground">{{ group.entry.content }}</span>
              <span v-if="formatInitMeta(group.entry)" class="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px]">
                {{ formatInitMeta(group.entry) }}
              </span>
              </div>

              <!-- Error -->
              <div
                v-else-if="group.type === 'other' && group.entry.type === 'error'"
                class="border-0 bg-red-500/5 px-3 py-2"
              >
              <div class="flex items-center gap-2 text-xs">
                <span class="text-red-500">⚠</span>
                <span class="font-medium text-red-600">Error</span>
              </div>
              <p class="mt-1 whitespace-pre-wrap text-sm text-red-600">{{ group.entry.content }}</p>
              </div>

              <!-- System message -->
              <div
                v-else-if="group.type === 'other'"
                class="border-0 bg-muted/30 p-3.5 text-sm leading-relaxed text-foreground"
              >
                <AssistantMessage :content="group.entry.content" />
              </div>
            </template>
          </AssistantTurnContentBubble>
        </div>
      </AssistantMessageShell>
    </template>
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
