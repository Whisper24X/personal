<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CodexTaskGroup } from './groupEntries'
import AssistantMessage from '../components/AssistantMessage.vue'
import type { NormalizedEntry } from '../types'
import { asRecord, getString, pickToolInputValue, stringify } from '../utils'

const props = defineProps<{
  group: CodexTaskGroup
}>()

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

const isRunning = computed(() =>
  groupItems.value.some((item) => {
    if (item.kind !== 'tool') return false

    const status = item.result?.metadata?.status || item.tool.metadata?.status
    return status === 'running' || status === 'pending'
  }),
)

const collapsed = ref(false)

watch(isRunning, (running) => {
  if (running) collapsed.value = false
})

const toolCount = computed(() => groupItems.value.filter((i) => i.kind === 'tool').length)
const thinkingCount = computed(() => groupItems.value.filter((i) => i.kind === 'thinking').length)
const isThinkingOnly = computed(() => toolCount.value === 0 && thinkingCount.value > 0)
const thinkingExpanded = ref(false)
const expandedToolId = ref<string | null>(null)
const statusMeta = computed(() => {
  if (isRunning.value) {
    return {
      dot: 'bg-amber-500 animate-pulse',
      badge: '执行中',
      badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    }
  }

  if (isThinkingOnly.value) {
    return {
      dot: 'bg-sky-500',
      badge: '思考中',
      badgeClass: 'border-sky-500/20 bg-sky-500/10 text-sky-700',
    }
  }

  return {
    dot: 'bg-emerald-500',
    badge: '已完成',
    badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  }
})
const summaryLabel = computed(() => {
  if (toolCount.value > 0 && thinkingCount.value > 0) {
    return `${toolCount.value} 个工具调用 · ${thinkingCount.value} 段思考`
  }

  if (toolCount.value > 0) {
    return `${toolCount.value} 个工具调用`
  }

  if (thinkingCount.value > 0) {
    return `${thinkingCount.value} 段思考`
  }

  return ''
})

const resolveToolName = (entry: NormalizedEntry) => {
  const name = entry.metadata?.toolName
  if (name) return name

  const typeMap: Record<string, string> = {
    command_run: 'Bash',
    file_edit: 'Edit',
    file_read: 'Read',
    tool_use: 'Tool',
  }
  return typeMap[entry.type] || 'Tool'
}

const resolveToolParamSummary = (entry: NormalizedEntry) => {
  const input = asRecord(entry.metadata?.toolInput)
  const cmd = getString(entry.metadata?.command)
  if (cmd) return `$ ${cmd}`

  const path = getString(entry.metadata?.filePath)
  if (path) return path

  const picked = pickToolInputValue(input)
  if (picked) return picked.length > 80 ? `${picked.slice(0, 80)}...` : picked

  return ''
}

const resolveToolResultSummary = (result?: NormalizedEntry) => {
  if (!result) return ''
  const content = result.content?.trim()
  if (!content) return 'completed'
  const lines = content.split('\n')
  if (lines.length > 1) return `${lines.length} lines of output`
  return content.length > 100 ? `${content.slice(0, 100)}...` : content
}

const resolveToolDotColor = (
  entry: NormalizedEntry,
  result?: NormalizedEntry,
) => {
  const status = result?.metadata?.status || entry.metadata?.status
  if (status === 'failed') return 'bg-red-500'
  if (status === 'success') return 'bg-emerald-500'
  if (status === 'running') return 'bg-yellow-500 animate-pulse'
  if (result) return 'bg-emerald-500'
  return 'bg-yellow-500 animate-pulse'
}

const resolveToolFullInput = (entry: NormalizedEntry) => {
  const input = asRecord(entry.metadata?.toolInput)
  if (!input) return ''
  return stringify(input)
}

const resolveToolFullOutput = (result?: NormalizedEntry) => {
  return result?.content?.trim() || ''
}

const toggleTool = (entryId: string) => {
  expandedToolId.value = expandedToolId.value === entryId ? null : entryId
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-sm">
    <button
      type="button"
      class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
      @click="collapsed = !collapsed"
    >
      <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="statusMeta.dot" />

      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
            :class="statusMeta.badgeClass"
          >
            {{ statusMeta.badge }}
          </span>
          <span v-if="summaryLabel" class="text-xs text-muted-foreground">{{ summaryLabel }}</span>
        </div>

        <p
          v-if="group.description && collapsed"
          class="text-sm leading-6 text-foreground"
        >
          {{ group.title || group.description }}
        </p>

        <div
          v-else-if="group.description"
          class="text-sm text-foreground"
        >
          <AssistantMessage :content="group.description" />
        </div>
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
        :class="{ 'rotate-90': !collapsed }"
      >
        <path
          d="M6 3.5L10.5 8L6 12.5"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <div
      v-if="!collapsed && groupItems.length > 0"
      class="space-y-2 border-t border-border/40 bg-muted/10 px-3 py-2.5"
    >
      <template v-for="(item, idx) in groupItems" :key="idx">
        <div v-if="item.kind === 'thinking'" class="rounded-lg border border-dashed border-border/50 bg-background/70 px-3 py-2.5">
          <div
            v-if="!isThinkingOnly"
            class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
            @click="thinkingExpanded = !thinkingExpanded"
          >
            <span class="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              思考过程
            </span>
            <span class="text-[10px]">{{ thinkingExpanded ? '收起' : '展开' }}</span>
          </div>
          <div
            v-if="isThinkingOnly || thinkingExpanded"
            class="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
          >{{ item.entry.content }}</div>
        </div>

        <div
          v-else
          class="group cursor-pointer select-none rounded-lg border border-border/40 bg-background/80 px-3 py-2.5 transition-colors hover:bg-background"
          @click="toggleTool(item.tool.id)"
        >
          <div class="flex items-start gap-3 text-sm">
            <span
              class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              :class="resolveToolDotColor(item.tool, item.result)"
            />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-foreground">{{ resolveToolName(item.tool) }}</span>
                <span
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {{ item.result?.metadata?.status === 'failed' ? '失败' : item.result || item.tool.metadata?.status === 'success' ? '完成' : item.tool.metadata?.status === 'running' ? '运行中' : '等待中' }}
                </span>
              </div>
              <div v-if="resolveToolParamSummary(item.tool)" class="mt-1 break-words text-xs text-muted-foreground">
                {{ resolveToolParamSummary(item.tool) }}
              </div>
              <div
                v-if="resolveToolResultSummary(item.result)"
                class="mt-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                {{ resolveToolResultSummary(item.result) }}
              </div>
            </div>
            <span class="mt-0.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {{ expandedToolId === item.tool.id ? '收起' : '展开' }}
            </span>
          </div>

          <div
            v-if="expandedToolId === item.tool.id"
            class="mt-3 space-y-2 border-t border-border/40 pt-3"
            @click.stop
          >
            <div v-if="resolveToolFullInput(item.tool)" class="rounded-lg bg-muted/50 p-3">
              <div class="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">输入</div>
              <pre class="max-h-48 overflow-auto text-xs text-foreground">{{ resolveToolFullInput(item.tool) }}</pre>
            </div>
            <div v-if="resolveToolFullOutput(item.result)" class="rounded-lg bg-muted/50 p-3">
              <div class="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">输出</div>
              <pre class="max-h-48 overflow-auto text-xs text-foreground">{{ resolveToolFullOutput(item.result) }}</pre>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
