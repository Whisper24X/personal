<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CursorTaskGroup } from './groupEntries'
import AssistantMessage from './AssistantMessage.vue'
import ToolItem from './ToolItem.vue'
import type { NormalizedEntry } from '../types'

const props = defineProps<{
  group: CursorTaskGroup
}>()

const isRunning = computed(() =>
  props.group.tools.some((t) => t.metadata?.status === 'running' || t.metadata?.status === 'pending'),
)

const collapsed = ref(!isRunning.value)

watch(isRunning, (running) => {
  if (running) collapsed.value = false
})

type ToolPairItem = { kind: 'tool'; tool: NormalizedEntry; result?: NormalizedEntry }
type ThinkingItem = { kind: 'thinking'; entry: NormalizedEntry }
type GroupItem = ToolPairItem | ThinkingItem

const groupItems = computed<GroupItem[]>(() => {
  const items: GroupItem[] = []
  const tools = props.group.tools

  for (let i = 0; i < tools.length; i += 1) {
    const entry = tools[i]
    if (!entry) continue

    if (entry.type === 'tool_result') continue
    if (entry.type === 'system_message') continue

    if (entry.type === 'thinking') {
      items.push({ kind: 'thinking', entry })
      continue
    }

    let result: NormalizedEntry | undefined
    const next = tools[i + 1]
    if (next && next.type === 'tool_result') {
      result = next
    }
    items.push({ kind: 'tool', tool: entry, result })
  }
  return items
})

const toolCount = computed(() => groupItems.value.filter((i) => i.kind === 'tool').length)
const thinkingCount = computed(() => groupItems.value.filter((i) => i.kind === 'thinking').length)
const isThinkingOnly = computed(() => toolCount.value === 0 && thinkingCount.value > 0)
const thinkingExpanded = ref(false)
</script>

<template>
  <div class="rounded-lg border border-border/50 bg-background">
    <div
      class="flex cursor-pointer items-start gap-2 px-3 py-2.5"
      @click="collapsed = !collapsed"
    >
      <span v-if="isRunning" class="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-yellow-500" />
      <span v-else-if="isThinkingOnly" class="mt-0.5 shrink-0 text-purple-400">💭</span>
      <span v-else class="mt-0.5 shrink-0 text-emerald-500">✓</span>

      <div class="min-w-0 flex-1">
        <div v-if="group.description" class="mb-1">
          <AssistantMessage :content="group.description" />
        </div>
        <span v-if="isThinkingOnly" class="text-xs text-muted-foreground italic">思考中...</span>
        <span v-else-if="toolCount > 0" class="text-xs text-muted-foreground">
          {{ toolCount }} 个工具调用
        </span>
      </div>

      <span class="mt-0.5 text-xs text-muted-foreground transition-transform" :class="{ 'rotate-180': !collapsed }">
        ▾
      </span>
    </div>

    <div v-if="!collapsed && groupItems.length > 0" class="space-y-0.5 border-t border-border/30 px-2 py-1.5">
      <template v-for="(item, idx) in groupItems" :key="idx">
        <div v-if="item.kind === 'thinking'" class="rounded-md px-2 py-1">
          <div
            v-if="!isThinkingOnly"
            class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
            @click="thinkingExpanded = !thinkingExpanded"
          >
            <span class="h-2 w-2 shrink-0 rounded-full bg-purple-400/60" />
            <span class="italic">思考过程</span>
            <span class="text-[10px]">{{ thinkingExpanded ? '▴' : '▾' }}</span>
          </div>
          <div
            v-if="isThinkingOnly || thinkingExpanded"
            class="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-muted/30 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground"
            :class="isThinkingOnly ? '' : 'ml-4'"
          >{{ item.entry.content }}</div>
        </div>

        <ToolItem
          v-else
          :entry="item.tool"
          :result="item.result"
        />
      </template>
    </div>
  </div>
</template>
