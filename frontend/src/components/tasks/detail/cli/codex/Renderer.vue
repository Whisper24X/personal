<script setup lang="ts">
import { computed } from 'vue'
import type { TaskMessage } from '@/types/api/tasks'
import { parseCodexMessages } from './parser'
import { groupCodexEntries } from './groupEntries'
import TaskGroupCard from './TaskGroupCard.vue'
import UserMessage from '../components/UserMessage.vue'
import AssistantMessage from '../components/AssistantMessage.vue'
import TodoListCard from '../components/TodoListCard.vue'
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

function patchSuccess(entry: NormalizedEntry): boolean {
  return entry.metadata?.success === true
}

function resolvePatchMeta(entry: NormalizedEntry): { icon: string; badge: string; cardClass: string; badgeClass: string } {
  if (patchSuccess(entry)) {
    return {
      icon: '✓',
      badge: '补丁已应用',
      cardClass: 'border-emerald-500/20 bg-emerald-500/6',
      badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
    }
  }

  return {
    icon: '⏳',
    badge: '补丁处理中',
    cardClass: 'border-amber-500/20 bg-amber-500/6',
    badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
  }
}

function resolveLifecycleMeta(entry: NormalizedEntry): { badge: string; cardClass: string; badgeClass: string } {
  const eventType = getString(entry.metadata?.codexEventType)

  if (eventType === 'thread_started') {
    return {
      badge: '线程已启动',
      cardClass: 'border-sky-500/20 bg-sky-500/6',
      badgeClass: 'border-sky-500/20 bg-sky-500/10 text-sky-700',
    }
  }

  if (eventType === 'turn_started') {
    return {
      badge: '回合进行中',
      cardClass: 'border-blue-500/20 bg-blue-500/6',
      badgeClass: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
    }
  }

  return {
    badge: '回合已完成',
    cardClass: 'border-border/50 bg-muted/15',
    badgeClass: 'border-border/50 bg-background/80 text-muted-foreground',
  }
}

function resolveErrorMeta(entry: NormalizedEntry): {
  badge: string
  title: string
  detail?: string
  cardClass: string
  badgeClass: string
} {
  const parsed = tryParseJson(entry.content)
  const record = asRecord(parsed)
  const type = getString(record?.type)
  const message =
    getString(record?.message) ||
    getString(record?.error) ||
    getString(record?.warning) ||
    entry.content.trim()

  const lower = message.toLowerCase()

  if (
    lower.includes('reconnecting') ||
    lower.includes('stream disconnected') ||
    lower.includes('transport error') ||
    lower.includes('network error')
  ) {
    return {
      badge: '连接异常',
      title: message,
      detail: type,
      cardClass: 'border-amber-500/20 bg-amber-500/6',
      badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    }
  }

  if (lower.includes('permission') || lower.includes('denied') || lower.includes('forbidden')) {
    return {
      badge: '权限问题',
      title: message,
      detail: type,
      cardClass: 'border-red-500/20 bg-red-500/6',
      badgeClass: 'border-red-500/20 bg-red-500/10 text-red-700',
    }
  }

  return {
    badge: '运行错误',
    title: message,
    detail: type,
    cardClass: 'border-red-500/20 bg-red-500/6',
    badgeClass: 'border-red-500/20 bg-red-500/10 text-red-700',
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

      <!-- Patch apply event -->
      <section
        v-else-if="group.type === 'other' && isPatchEvent(group.entry)"
        class="rounded-xl border px-4 py-3 shadow-sm"
        :class="resolvePatchMeta(group.entry).cardClass"
      >
        <div class="flex items-start gap-3">
          <span class="mt-0.5 text-sm">{{ resolvePatchMeta(group.entry).icon }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                :class="resolvePatchMeta(group.entry).badgeClass"
              >
                {{ resolvePatchMeta(group.entry).badge }}
              </span>
              <span class="text-[11px] text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
            </div>
            <p class="mt-2 text-sm font-medium leading-6 text-foreground">{{ group.entry.content }}</p>
          </div>
        </div>
      </section>

      <!-- Lifecycle events -->
      <section
        v-else-if="group.type === 'other' && isLifecycleEvent(group.entry)"
        class="rounded-xl border px-4 py-3 shadow-sm"
        :class="resolveLifecycleMeta(group.entry).cardClass"
      >
        <div class="flex items-start gap-3">
          <span class="mt-0.5 text-sm">{{ lifecycleIcon(group.entry) }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                :class="resolveLifecycleMeta(group.entry).badgeClass"
              >
                {{ resolveLifecycleMeta(group.entry).badge }}
              </span>
              <span class="text-[11px] text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
            </div>
            <p class="mt-2 text-sm leading-6 text-foreground">{{ group.entry.content }}</p>
          </div>
        </div>
      </section>

      <!-- Error -->
      <section
        v-else-if="group.type === 'other' && group.entry.type === 'error'"
        class="rounded-xl border px-4 py-3 shadow-sm"
        :class="resolveErrorMeta(group.entry).cardClass"
      >
        <div class="flex items-start gap-3">
          <span class="mt-0.5 text-sm text-red-500">⚠</span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                :class="resolveErrorMeta(group.entry).badgeClass"
              >
                {{ resolveErrorMeta(group.entry).badge }}
              </span>
              <span
                v-if="resolveErrorMeta(group.entry).detail"
                class="rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {{ resolveErrorMeta(group.entry).detail }}
              </span>
              <span class="text-[11px] text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</span>
            </div>
            <p class="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-foreground">
              {{ resolveErrorMeta(group.entry).title }}
            </p>
          </div>
        </div>
      </section>

      <!-- System message -->
      <section
        v-else-if="group.type === 'other'"
        class="rounded-xl border border-border/50 bg-card/70 px-4 py-3 shadow-sm"
      >
        <div class="flex items-start gap-3">
          <span class="mt-0.5 text-sm text-muted-foreground">⋯</span>
          <div class="min-w-0 flex-1">
            <div class="mb-2 text-[11px] text-muted-foreground">{{ formatTime(group.entry.timestamp) }}</div>
            <AssistantMessage :content="group.entry.content" />
          </div>
        </div>
      </section>
    </template>
  </div>
  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    暂无执行日志
  </div>
</template>
