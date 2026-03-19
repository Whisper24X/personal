<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCodexMessages } from './parser'
import { groupCodexEntries } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import TodoListCard from '../components/TodoListCard.vue'
import FileChangeCard from '../components/FileChangeCard.vue'
import type { NormalizedEntry } from '../types'
import { asRecord, formatTime, getString, tryParseJson } from '../utils'

defineOptions({ name: 'CliCodexRenderer' })

const props = defineProps<{
  messages: TaskMessage[]
}>()

const entries = computed(() => parseCodexMessages(props.messages))
const groups = computed(() => groupCodexEntries(entries.value))

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
</script>

<template>
  <div v-if="groups.length > 0" class="space-y-3">
    <template v-for="(group, idx) in groups" :key="idx">
      <TaskGroupCard v-if="group.type === 'task'" :group="group" />

      <UserMessage
        v-else-if="group.type === 'other' && group.entry.type === 'user_message'"
        :entry="group.entry"
        variant="codex"
      />

      <TodoListCard
        v-else-if="group.type === 'other' && isTodoListEvent(group.entry)"
        :entry="group.entry"
      />

      <FileChangeCard
        v-else-if="group.type === 'other' && isFileChangeEvent(group.entry)"
        :entry="group.entry"
      />

      <!-- Patch apply event -->
      <div
        v-else-if="group.type === 'other' && isPatchEvent(group.entry)"
        class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
        :class="patchSuccess(group.entry) ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600' : 'border-amber-500/20 bg-amber-500/5 text-amber-600'"
      >
        <span>{{ patchSuccess(group.entry) ? '✓' : '⏳' }}</span>
        <span>{{ group.entry.content }}</span>
        <span class="ml-auto text-[10px] text-muted-foreground/55">{{ formatTime(group.entry.timestamp) }}</span>
      </div>

      <!-- Lifecycle events -->
      <div
        v-else-if="group.type === 'other' && isLifecycleEvent(group.entry)"
        class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
        :class="lifecycleClass(group.entry)"
      >
        <span>{{ lifecycleIcon(group.entry) }}</span>
        <span>{{ group.entry.content }}</span>
        <span class="ml-auto text-[10px] opacity-55">{{ formatTime(group.entry.timestamp) }}</span>
      </div>

      <!-- Error -->
      <div
        v-else-if="group.type === 'other' && group.entry.type === 'error'"
        class="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2"
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
                <span class="ml-auto text-[10px] text-muted-foreground/55">{{ formatTime(group.entry.timestamp) }}</span>
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
