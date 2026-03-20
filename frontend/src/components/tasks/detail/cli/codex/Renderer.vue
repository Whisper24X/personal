<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCodexMessages } from './parser'
import { groupCodexEntries } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from './UserMessage.vue'
import AssistantMessage from './AssistantMessage.vue'
import TodoListCard from './TodoListCard.vue'
import FileChangeCard from './FileChangeCard.vue'
import AssistantMessageShell from '../AssistantMessageShell.vue'
import AssistantTaskStepBar from '../AssistantTaskStepBar.vue'
import AssistantTurnContentBubble from '../AssistantTurnContentBubble.vue'
import { mergeAssistantTurns } from '../mergeAssistantTurns'
import type { CodexMessageGroup, CodexTaskGroup } from './groupEntries'
import type { NormalizedEntry } from '../types'
import { collapseDetailWhenTurnDone } from '../taskGroupCollapse'
import { buildStepBarCodex, prepareTaskGroupsForStepBar, type StepBarModel } from '../taskGroupStepState'
import { asRecord, assistantTurnTimeLabel, formatTime, getString, tryParseJson } from '../utils'

defineOptions({ name: 'CliCodexRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseCodexMessages(props.messages))
const groups = computed(() => groupCodexEntries(entries.value))
const turns = computed(() =>
  mergeAssistantTurns(groups.value, (g: CodexMessageGroup) => g.type === 'other' && g.entry.type === 'user_message'),
)

const assistantStepBars = computed(() =>
  turns.value.map((turn) => (turn.kind === 'assistant' ? codexStepBarModel(turn.items) : null)),
)

function isPatchEvent(entry: NormalizedEntry) {
  const t = getString(entry.metadata?.codexEventType)
  return t === 'patch_begin' || t === 'patch_end'
}

function isTodoListEvent(entry: NormalizedEntry) {
  return getString(entry.metadata?.codexCardType) === 'todo_list'
}

function isFileChangeEvent(entry: NormalizedEntry) {
  return getString(entry.metadata?.codexCardType) === 'file_change'
}

function isLifecycleEvent(entry: NormalizedEntry) {
  const eventType = getString(entry.metadata?.codexEventType)
  return eventType === 'thread_started' || eventType === 'turn_started' || eventType === 'turn_completed'
}

function lifecycleIcon(entry: NormalizedEntry): string {
  const eventType = getString(entry.metadata?.codexEventType)
  if (eventType === 'thread_started') return '◎'
  if (eventType === 'turn_started') return '▶'
  return '◦'
}

function lifecycleClass(entry: NormalizedEntry): string {
  const eventType = getString(entry.metadata?.codexEventType)
  if (eventType === 'turn_completed') {
    return 'border-border/30 bg-muted/20 text-muted-foreground'
  }
  return 'border-sky-500/20 bg-sky-500/5 text-sky-700'
}

/** 嵌在外层助手气泡内：无独立描边，仅保留底色与字色 */
function lifecycleClassEmbedded(entry: NormalizedEntry): string {
  const eventType = getString(entry.metadata?.codexEventType)
  if (eventType === 'turn_completed') {
    return 'bg-muted/20 text-muted-foreground'
  }
  return 'bg-sky-500/5 text-sky-700'
}

function patchSuccess(entry: NormalizedEntry): boolean {
  return entry.metadata?.success === true
}

function resolveErrorDisplay(entry: NormalizedEntry): {
  typeLabel?: string
  summary: string
  raw: string
  structured: boolean
} {
  const parsed = tryParseJson(entry.content)
  const record = asRecord(parsed)

  if (!record) {
    return {
      summary: entry.content,
      raw: entry.content,
      structured: false,
    }
  }

  const type = getString(record.type)

  return {
    typeLabel: type && type.toLowerCase() !== 'error' ? type : undefined,
    summary: getString(record.message) || getString(record.error) || entry.content,
    raw: JSON.stringify(parsed, null, 2),
    structured: true,
  }
}

function isTurnCompletedEvent(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.codexEventType) === 'turn_completed'
}

function codexStepBarModel(items: CodexMessageGroup[]): StepBarModel | null {
  const allTasks = items.filter((g): g is CodexTaskGroup => g.type === 'task')
  const hasTurnOutcome = items.some((g) => g.type === 'other' && isTurnCompletedEvent(g.entry))
  const tasks = prepareTaskGroupsForStepBar(allTasks, hasTurnOutcome)
  return buildStepBarCodex(tasks)
}

function codexTurnFinished(items: CodexMessageGroup[]): boolean {
  return items.some((g) => g.type === 'other' && isTurnCompletedEvent(g.entry))
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
                :collapse-detail-when-done="collapseDetailWhenTurnDone(codexTurnFinished(turn.items), idx, turn.items)"
              />

              <TodoListCard
                v-else-if="group.type === 'other' && isTodoListEvent(group.entry)"
                embedded
                :entry="group.entry"
              />

              <FileChangeCard
                v-else-if="group.type === 'other' && isFileChangeEvent(group.entry)"
                embedded
                :entry="group.entry"
              />

              <!-- Patch apply event -->
              <div
                v-else-if="group.type === 'other' && isPatchEvent(group.entry)"
                class="flex items-center gap-2 border-0 px-3 py-1.5 text-xs"
                :class="patchSuccess(group.entry) ? 'bg-emerald-500/5 text-emerald-600' : 'bg-amber-500/5 text-amber-600'"
              >
              <span>{{ patchSuccess(group.entry) ? '✓' : '⏳' }}</span>
              <span>{{ group.entry.content }}</span>
              </div>

              <!-- Lifecycle events -->
              <div
                v-else-if="group.type === 'other' && isLifecycleEvent(group.entry)"
                class="flex items-center gap-2 border-0 px-3 py-1.5 text-xs"
                :class="lifecycleClassEmbedded(group.entry)"
              >
              <span>{{ lifecycleIcon(group.entry) }}</span>
              <span>{{ group.entry.content }}</span>
            </div>

              <!-- Error -->
              <div
                v-else-if="group.type === 'other' && group.entry.type === 'error'"
                class="border-0 bg-red-500/5 px-3 py-2"
              >
              <details class="group">
                <summary class="flex cursor-pointer list-none items-start gap-2">
                  <span class="mt-0.5 text-xs text-red-500">⚠</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 text-[11px]">
                      <span class="font-medium text-red-600">Error</span>
                      <span
                        v-if="resolveErrorDisplay(group.entry).typeLabel"
                        class="rounded border border-red-500/15 bg-red-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-600"
                      >
                        {{ resolveErrorDisplay(group.entry).typeLabel }}
                      </span>
                    </div>
                    <p class="mt-0.5 pr-4 whitespace-pre-wrap text-sm leading-5 text-red-600">
                      {{ resolveErrorDisplay(group.entry).summary }}
                    </p>
                  </div>
                  <span class="mt-0.5 text-[11px] text-muted-foreground transition-transform group-open:rotate-180">▾</span>
                </summary>

                <pre class="mt-2 overflow-auto rounded-md bg-background/70 p-2.5 text-xs text-foreground">{{ resolveErrorDisplay(group.entry).raw }}</pre>
              </details>
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
          <AssistantTaskStepBar v-if="assistantStepBars[tIdx]" v-bind="assistantStepBars[tIdx]!" />
        </div>
      </AssistantMessageShell>
    </template>
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
