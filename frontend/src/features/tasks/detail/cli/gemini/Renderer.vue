<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseGeminiMessages } from './parser'
import { groupGeminiEntries, type GeminiMessageGroup } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from './UserMessage.vue'
import AssistantMessage from './AssistantMessage.vue'
import AssistantMessageShell from '../AssistantMessageShell.vue'
import AssistantTurnContentBubble from '../AssistantTurnContentBubble.vue'
import { mergeAssistantTurns } from '../mergeAssistantTurns'
import type { NormalizedEntry } from '../types'
import { collapseDetailWhenTurnDone } from '../taskGroupCollapse'
import { assistantTurnTimeLabel, getString } from '../utils'

defineOptions({ name: 'CliGeminiRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseGeminiMessages(props.messages))
const groups = computed(() => groupGeminiEntries(entries.value))
const turns = computed(() =>
  mergeAssistantTurns(groups.value, (g: GeminiMessageGroup) => g.type === 'other' && g.entry.type === 'user_message'),
)

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

function geminiTurnFinished(items: GeminiMessageGroup[]): boolean {
  return items.some((g) => g.type === 'other' && isResultEntry(g.entry))
}

</script>

<template>
  <div v-if="groups.length > 0" class="space-y-3">
    <template v-for="(turn, tIdx) in turns" :key="tIdx">
      <UserMessage v-if="turn.kind === 'user' && turn.item.type === 'other'" :entry="turn.item.entry" />

      <AssistantMessageShell
        v-else-if="turn.kind === 'assistant'"
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
                :collapse-detail-when-done="collapseDetailWhenTurnDone(geminiTurnFinished(turn.items), idx, turn.items)"
              />

              <div
                v-else-if="group.type === 'other' && group.entry.type === 'assistant_message'"
                class="border-0 bg-muted/30 p-3.5 text-sm leading-relaxed text-foreground"
              >
                <AssistantMessage :content="group.entry.content" />
              </div>

              <div
                v-else-if="group.type === 'other' && isResultEntry(group.entry)"
                class="flex flex-wrap items-center gap-2 border-0 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600"
              >
              <span>✓</span>
              <span class="font-medium">Completed</span>
              <span class="text-muted-foreground">{{ formatStatus(group.entry) }}</span>
              </div>

              <div
                v-else-if="group.type === 'other' && isInitEntry(group.entry)"
                class="flex flex-wrap items-center gap-2 border-0 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
              >
              <span>⚙</span>
              <span class="font-medium text-foreground">{{ group.entry.content }}</span>
              </div>

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
