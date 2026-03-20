<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCursorAgentMessages } from './parser'
import { groupCursorEntries } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from './UserMessage.vue'
import AssistantMessage from './AssistantMessage.vue'
import AssistantMessageShell from '../AssistantMessageShell.vue'
import AssistantTaskStepBar from '../AssistantTaskStepBar.vue'
import AssistantTurnContentBubble from '../AssistantTurnContentBubble.vue'
import { mergeAssistantTurns } from '../mergeAssistantTurns'
import type { CursorMessageGroup, CursorTaskGroup } from './groupEntries'
import type { NormalizedEntry } from '../types'
import { collapseDetailWhenTurnDone } from '../taskGroupCollapse'
import { buildStepBarClaudeLike, prepareTaskGroupsForStepBar, type StepBarModel } from '../taskGroupStepState'
import { assistantTurnTimeLabel, formatTime, getNumber, getString } from '../utils'

defineOptions({ name: 'CliCursorAgentRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseCursorAgentMessages(props.messages))
const groups = computed(() => groupCursorEntries(entries.value))
const turns = computed(() =>
  mergeAssistantTurns(groups.value, (g: CursorMessageGroup) => g.type === 'other' && g.entry.type === 'user_message'),
)

const assistantStepBars = computed(() =>
  turns.value.map((turn) => (turn.kind === 'assistant' ? cursorStepBarModel(turn.items) : null)),
)

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

function cursorStepBarModel(items: CursorMessageGroup[]): StepBarModel | null {
  const allTasks = items.filter((g): g is CursorTaskGroup => g.type === 'task')
  const hasSessionResult = items.some((g) => g.type === 'other' && isResultEntry(g.entry))
  const tasks = prepareTaskGroupsForStepBar(allTasks, hasSessionResult)
  return buildStepBarClaudeLike(tasks)
}

function cursorTurnFinished(items: CursorMessageGroup[]): boolean {
  return items.some((g) => g.type === 'other' && isResultEntry(g.entry))
}
</script>

<template>
  <div v-if="groups.length > 0" class="space-y-3">
    <template v-for="(turn, tIdx) in turns" :key="tIdx">
      <UserMessage v-if="turn.kind === 'user'" :entry="turn.item.entry" />

      <AssistantMessageShell
        v-else
        :time-label="assistantTurnTimeLabel(turn.items)"
        :wrap-body="false"
      >
        <div class="space-y-3">
          <AssistantTurnContentBubble>
            <template v-for="(group, idx) in turn.items" :key="idx">
              <TaskGroupCard
                v-if="group.type === 'task'"
                embedded
                :group="group"
                :collapse-detail-when-done="collapseDetailWhenTurnDone(cursorTurnFinished(turn.items), idx, turn.items)"
              />

              <!-- Result summary with duration + token usage -->
              <div
                v-else-if="group.type === 'other' && isResultEntry(group.entry)"
                class="flex flex-wrap items-center gap-2 border-0 px-3 py-2 text-xs"
                :class="isSuccess(group.entry) ? 'bg-emerald-500/5' : 'bg-red-500/5'"
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
              </div>

              <!-- System init -->
              <div
                v-else-if="group.type === 'other' && hasModel(group.entry)"
                class="flex items-center gap-2 border-0 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
              >
              <span>⚙</span>
              <span>{{ group.entry.content }}</span>
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

              <!-- Other system message -->
              <div
                v-else-if="group.type === 'other'"
                class="border-0 bg-muted/30 p-3.5 text-sm leading-relaxed text-foreground"
              >
                <AssistantMessage :content="group.entry.content" />
              </div>
            </template>
          </AssistantTurnContentBubble>
          <AssistantTaskStepBar v-if="assistantStepBars[tIdx]" v-bind="assistantStepBars[tIdx]!" />
        </div>
      </AssistantMessageShell>
    </template>
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
