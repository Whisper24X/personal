<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NormalizedEntry } from '../types'

defineOptions({ name: 'CliCodexTodoListCard' })

type TodoListItem = {
  text: string
  completed: boolean
}

const props = defineProps<{
  entry: NormalizedEntry
}>()

const todoItems = computed<TodoListItem[]>(() => {
  const rawItems = Array.isArray(props.entry.metadata?.todoItems) ? props.entry.metadata.todoItems : []
  return rawItems
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const record = raw as Record<string, unknown>
      const text = typeof record.text === 'string' ? record.text.trim() : ''
      if (!text) return null
      return {
        text,
        completed: record.completed === true,
      }
    })
    .filter((item): item is TodoListItem => Boolean(item))
})

const completedCount = computed(() => todoItems.value.filter((item) => item.completed).length)
const totalCount = computed(() => todoItems.value.length)
const isCompleted = computed(() => props.entry.metadata?.status === 'success')
const progressText = computed(() => `${completedCount.value}/${totalCount.value}`)
const statusText = computed(() => (isCompleted.value ? '已完成' : '进行中'))
const containerClass = computed(() =>
  isCompleted.value
    ? 'border-emerald-500/20 bg-emerald-500/5'
    : 'border-amber-500/20 bg-amber-500/5',
)
const badgeClass = computed(() =>
  isCompleted.value
    ? 'bg-emerald-500/10 text-emerald-700'
    : 'bg-amber-500/10 text-amber-700',
)
const iconClass = computed(() => (isCompleted.value ? 'text-emerald-600' : 'text-amber-600'))
const collapsed = ref(true)

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div class="rounded-xl border px-4 py-3 shadow-sm" :class="containerClass">
    <button
      type="button"
      class="flex w-full flex-wrap items-center gap-2 text-left text-xs"
      @click="toggleCollapsed"
    >
      <span class="text-sm font-medium" :class="iconClass">{{ isCompleted ? '✓' : '◌' }}</span>
      <span class="font-medium text-foreground">待办清单</span>
      <span class="rounded-full px-2 py-0.5 text-[11px] font-medium" :class="badgeClass">
        {{ statusText }}
      </span>
      <span class="rounded-full bg-background/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
        {{ progressText }}
      </span>
      <span class="ml-auto text-[10px] text-muted-foreground/60">
        {{ collapsed ? '展开' : '收起' }}
      </span>
    </button>

    <ul v-if="!collapsed && todoItems.length > 0" class="mt-3 space-y-2">
      <li
        v-for="(item, index) in todoItems"
        :key="`${entry.id}-${index}`"
        class="flex items-start gap-2 rounded-lg bg-background/70 px-3 py-2 text-sm"
      >
        <span class="mt-0.5 shrink-0 text-xs" :class="item.completed ? 'text-emerald-600' : 'text-muted-foreground'">
          {{ item.completed ? '✓' : '○' }}
        </span>
        <span class="whitespace-pre-wrap break-words" :class="item.completed ? 'text-muted-foreground line-through' : 'text-foreground'">
          {{ item.text }}
        </span>
      </li>
    </ul>

    <p v-else-if="!collapsed" class="mt-3 text-sm text-muted-foreground">
      暂无待办项
    </p>
  </div>
</template>
