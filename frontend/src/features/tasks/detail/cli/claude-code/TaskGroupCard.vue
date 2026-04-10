<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildClaudeTaskGroupItems, type ClaudeGroupItem, type ClaudeTaskGroup } from './groupEntries'
import AssistantMessage from './AssistantMessage.vue'
import ToolItem from './ToolItem.vue'
import { formatTime } from '../utils'

const props = defineProps<{
  group: ClaudeTaskGroup
  /** 本轮对话已结束：true=折叠详情（优先于 isRunning，避免刷新后陈旧状态撑开）；false=展开；undefined=仅按 isRunning */
  collapseDetailWhenDone?: boolean
  /** 嵌在外层助手气泡内时去掉独立卡片描边 */
  embedded?: boolean
}>()

const rootClass = computed(() =>
  props.embedded
    ? 'overflow-hidden rounded-none border-0 bg-transparent'
    : 'overflow-hidden rounded-lg border border-border/50 bg-background',
)

const isRunning = computed(() =>
  props.group.tools.some((t) => t.metadata?.status === 'running' || t.metadata?.status === 'pending'),
)

const collapsed = ref(!isRunning.value)

watch(
  () => [isRunning.value, props.collapseDetailWhenDone] as const,
  ([running, pref]) => {
    // 本轮已结束：优先折叠，避免历史日志里残留的 running/pending 在刷新后把卡片撑开
    if (pref === true) {
      collapsed.value = true
      return
    }
    if (running) {
      collapsed.value = false
      return
    }
    if (pref === false) {
      collapsed.value = false
      return
    }
    collapsed.value = true
  },
  { immediate: true },
)

const groupItems = computed<ClaudeGroupItem[]>(() => buildClaudeTaskGroupItems(props.group))

const toolCount = computed(() => groupItems.value.filter((i) => i.kind === 'tool').length)
const thinkingCount = computed(() => groupItems.value.filter((i) => i.kind === 'thinking').length)
const isThinkingOnly = computed(() => toolCount.value === 0 && thinkingCount.value > 0)
const thinkingExpanded = ref(false)
const summaryLabel = computed(() => {
  if (toolCount.value > 0) {
    return `${toolCount.value} 个工具调用`
  }
  if (thinkingCount.value > 0) {
    return `${thinkingCount.value} 段思考`
  }
  return ''
})

function getGroupItemKey(item: ClaudeGroupItem): string {
  if (item.kind === 'tool') {
    return `${item.tool.id}:${item.result?.id ?? 'pending'}`
  }

  return item.entry.id
}
</script>

<template>
  <div :class="rootClass">
    <div
      class="flex cursor-pointer items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/20"
      @click="collapsed = !collapsed"
    >
      <span
        class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        :class="
          isRunning
            ? 'bg-amber-500'
            : isThinkingOnly
              ? 'bg-fuchsia-400'
              : 'bg-emerald-500'
        "
      />

      <div class="min-w-0 flex-1 space-y-2">
        <div v-if="group.description">
          <AssistantMessage :content="group.description" />
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{{ isRunning ? '执行中' : isThinkingOnly ? '思考中' : '已完成' }}</span>
          <span v-if="summaryLabel">· {{ summaryLabel }}</span>
          <span v-if="thinkingCount > 0 && toolCount > 0">· {{ thinkingCount }} 段思考</span>
        </div>
      </div>

      <span
        class="mt-0.5 shrink-0 text-xs text-muted-foreground transition-transform"
        :class="{ 'rotate-180': !collapsed }"
      >
        ▾
      </span>
    </div>

    <div
      v-if="!collapsed && groupItems.length > 0"
      class="space-y-2 border-t border-border/30 px-3 py-2.5"
    >
      <template v-for="item in groupItems" :key="getGroupItemKey(item)">
        <div
          v-if="item.kind === 'thinking'"
          class="rounded-md bg-muted/30 px-2.5 py-2"
        >
          <div
            v-if="!isThinkingOnly"
            class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
            @click="thinkingExpanded = !thinkingExpanded"
          >
            <span>思考过程</span>
            <span class="text-[10px]">{{ thinkingExpanded ? '收起' : '展开' }}</span>
          </div>
          <div
            v-if="isThinkingOnly || thinkingExpanded"
            class="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"
          >{{ item.entry.content }}</div>
        </div>

        <div
          v-else-if="item.kind === 'system'"
          class="flex items-center gap-2 rounded-md bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground"
        >
          <span>⚙</span>
          <span class="min-w-0 flex-1 break-words">{{ item.entry.content }}</span>
          <span class="shrink-0">{{ formatTime(item.entry.timestamp) }}</span>
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
