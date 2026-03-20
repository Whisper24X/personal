<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CodexTaskGroup } from './groupEntries'
import AssistantMessage from './AssistantMessage.vue'
import type { NormalizedEntry } from '../types'
import { asRecord, getString, pickToolInputValue, stringify } from '../utils'

const props = defineProps<{
  group: CodexTaskGroup
  collapseDetailWhenDone?: boolean
  embedded?: boolean
}>()

const rootClass = computed(() =>
  props.embedded
    ? 'rounded-none border-0 bg-transparent shadow-none'
    : 'rounded-lg border border-border/50 bg-background',
)

type ToolPairItem = { kind: 'tool'; tool: NormalizedEntry; result?: NormalizedEntry }
type ThinkingItem = { kind: 'thinking'; entry: NormalizedEntry }
type GroupItem = ToolPairItem | ThinkingItem

const groupItems = computed<GroupItem[]>(() => {
  const items: GroupItem[] = []
  const tools = props.group.tools
  const resultQueues = new Map<string, NormalizedEntry[]>()
  const consumedResultIds = new Set<string>()

  tools.forEach((entry) => {
    if (entry.type !== 'tool_result') return

    const toolUseId = getString(entry.metadata?.toolUseId)
    if (!toolUseId) return

    const queue = resultQueues.get(toolUseId) ?? []
    queue.push(entry)
    resultQueues.set(toolUseId, queue)
  })

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
    const toolUseId = getString(entry.metadata?.toolUseId)
    if (toolUseId) {
      const queue = resultQueues.get(toolUseId)
      const nextResult = queue?.shift()
      if (nextResult) {
        result = nextResult
        consumedResultIds.add(nextResult.id)
      }
    }

    const next = tools[i + 1]
    if (!result && next && next.type === 'tool_result' && !consumedResultIds.has(next.id)) {
      result = next
      consumedResultIds.add(next.id)
    }
    items.push({ kind: 'tool', tool: entry, result })
  }
  return items
})

const isRunning = computed(() =>
  groupItems.value.some(
    (item) =>
      item.kind === 'tool' &&
      !item.result &&
      (item.tool.metadata?.status === 'running' || item.tool.metadata?.status === 'pending'),
  ),
)

const collapsed = ref(!isRunning.value)

watch(
  () => [isRunning.value, props.collapseDetailWhenDone] as const,
  ([running, pref]) => {
    if (running) {
      collapsed.value = false
      return
    }
    if (pref === true) {
      collapsed.value = true
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

const toolCount = computed(() => groupItems.value.filter((i) => i.kind === 'tool').length)
const thinkingCount = computed(() => groupItems.value.filter((i) => i.kind === 'thinking').length)
const isThinkingOnly = computed(() => toolCount.value === 0 && thinkingCount.value > 0)
const thinkingExpanded = ref(false)
const expandedToolId = ref<string | null>(null)

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
  <div :class="rootClass">
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

      <span
        class="mt-0.5 text-xs text-muted-foreground transition-transform"
        :class="{ 'rotate-180': !collapsed }"
      >
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

        <div
          v-else
          class="group cursor-pointer select-none rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
          @click="toggleTool(item.tool.id)"
        >
          <div class="flex items-start gap-2 text-sm">
            <span
              class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              :class="resolveToolDotColor(item.tool, item.result)"
            />
            <div class="min-w-0 flex-1">
              <span class="font-medium text-foreground">{{ resolveToolName(item.tool) }}</span>
              <span v-if="resolveToolParamSummary(item.tool)" class="text-muted-foreground">
                ({{ resolveToolParamSummary(item.tool) }})
              </span>
              <div v-if="resolveToolResultSummary(item.result)" class="text-xs text-muted-foreground">
                └ {{ resolveToolResultSummary(item.result) }}
              </div>
            </div>
            <span class="mt-0.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {{ expandedToolId === item.tool.id ? '收起' : '展开' }}
            </span>
          </div>

          <div
            v-if="expandedToolId === item.tool.id"
            class="ml-4 mt-2 space-y-2"
            @click.stop
          >
            <div v-if="resolveToolFullInput(item.tool)" class="rounded-md bg-muted/50 p-2">
              <div class="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">输入</div>
              <pre class="max-h-48 overflow-auto text-xs text-foreground">{{ resolveToolFullInput(item.tool) }}</pre>
            </div>
            <div v-if="resolveToolFullOutput(item.result)" class="rounded-md bg-muted/50 p-2">
              <div class="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">输出</div>
              <pre class="max-h-48 overflow-auto text-xs text-foreground">{{ resolveToolFullOutput(item.result) }}</pre>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
