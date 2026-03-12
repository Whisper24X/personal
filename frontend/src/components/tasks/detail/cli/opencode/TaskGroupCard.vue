<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  buildOpencodeTaskGroupItems,
  type OpencodeTaskGroup,
  type OpencodeGroupItem,
} from './groupEntries'
import AssistantMessage from '../components/AssistantMessage.vue'
import ToolItem from '../components/ToolItem.vue'

const props = defineProps<{
  group: OpencodeTaskGroup
}>()

const isRunning = computed(() => props.group.status === 'running')
const collapsed = ref(!isRunning.value)

watch(isRunning, (running) => {
  if (running) collapsed.value = false
})

const groupItems = computed<OpencodeGroupItem[]>(() => buildOpencodeTaskGroupItems(props.group))
const toolCount = computed(() => groupItems.value.filter((item) => item.kind === 'tool').length)
const systemCount = computed(() => groupItems.value.filter((item) => item.kind === 'system').length)

const statusMeta = computed(() => {
  if (props.group.status === 'failed') {
    return {
      dot: 'bg-red-500',
      badge: '有错误',
      badgeClass: 'border-red-500/20 bg-red-500/10 text-red-600',
    }
  }

  if (props.group.status === 'running') {
    return {
      dot: 'bg-amber-500 animate-pulse',
      badge: '进行中',
      badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
    }
  }

  return {
    dot: 'bg-emerald-500',
    badge: '已完成',
    badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
  }
})
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-sm">
    <button
      type="button"
      class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
      @click="collapsed = !collapsed"
    >
      <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="statusMeta.dot" />

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-foreground">{{ group.title }}</span>
          <span
            class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
            :class="statusMeta.badgeClass"
          >
            {{ statusMeta.badge }}
          </span>
        </div>

        <div v-if="group.description" class="mt-2 text-sm text-foreground">
          <AssistantMessage :content="group.description" />
        </div>

        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{{ group.summary }}</span>
          <span v-if="toolCount > 0">{{ toolCount }} 个工具调用</span>
          <span v-if="systemCount > 0">{{ systemCount }} 条步骤信息</span>
        </div>
      </div>

      <span
        class="mt-0.5 shrink-0 text-xs text-muted-foreground transition-transform"
        :class="{ 'rotate-180': !collapsed }"
      >
        ▾
      </span>
    </button>

    <div v-if="!collapsed && groupItems.length > 0" class="border-t border-border/40 bg-muted/10 px-3 py-2">
      <div class="space-y-1.5">
        <template v-for="(item, idx) in groupItems" :key="idx">
          <div
            v-if="item.kind === 'thinking'"
            class="rounded-lg border border-dashed border-border/50 bg-background/60 px-3 py-2"
          >
            <div class="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Thinking</div>
            <div class="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {{ item.entry.content }}
            </div>
          </div>

          <div
            v-else-if="item.kind === 'system'"
            class="rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-xs text-muted-foreground"
          >
            {{ item.entry.content }}
          </div>

          <ToolItem
            v-else
            :entry="item.tool"
            :result="item.result"
          />
        </template>
      </div>
    </div>
  </div>
</template>
