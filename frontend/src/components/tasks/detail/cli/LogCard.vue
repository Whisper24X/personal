<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NormalizedEntry } from './types'
import { asRecord, stringify } from './utils'
import { buildFacts, buildSummary, entryTitle, formatTime, logRowTone, statusBadge, stripToolInput } from './log-display'

const props = defineProps<{
  entry: NormalizedEntry
}>()

const expanded = ref(false)

const summaryData = computed(() => buildSummary(props.entry))
const facts = computed(() => buildFacts(props.entry))
const rawToolInput = computed(() => asRecord(props.entry.metadata?.toolInput))
const rawMetadata = computed(() => stripToolInput(props.entry.metadata))
const badge = computed(() => statusBadge(props.entry))

const isMessage = computed(() =>
  props.entry.type === 'assistant_message' || props.entry.type === 'user_message',
)

const hasToolInput = computed(() =>
  Boolean(rawToolInput.value && Object.keys(rawToolInput.value).length > 0),
)

const hasMetadata = computed(() =>
  Boolean(rawMetadata.value && Object.keys(rawMetadata.value).length > 0),
)

const hasDetails = computed(() =>
  !isMessage.value && (summaryData.value.hasHiddenContent || hasToolInput.value || hasMetadata.value || facts.value.length > 0),
)

const visibleContent = computed(() =>
  isMessage.value ? (props.entry.content || summaryData.value.summary) : summaryData.value.summary,
)

const title = computed(() => entryTitle(props.entry))
const time = computed(() => formatTime(props.entry.timestamp))
const tone = computed(() => logRowTone(props.entry.type))

const toolInputStr = computed(() => stringify(rawToolInput.value))
const metadataStr = computed(() => stringify(rawMetadata.value))

function toggleExpand() {
  if (hasDetails.value) {
    expanded.value = !expanded.value
  }
}

const iconMap: Record<string, string> = {
  assistant_message: '\u{1F916}',
  user_message: '\u{1F464}',
  tool_use: '\u{1F527}',
  command_run: '\u{1F527}',
  file_edit: '\u{1F527}',
  file_read: '\u{1F527}',
  tool_result: '\u{2699}\uFE0F',
  error: '\u26A0\uFE0F',
  system_message: '\u{1F4AC}',
}

const icon = computed(() => iconMap[props.entry.type] || '\u{1F4AC}')

const badgeToneClass = computed(() => {
  if (!badge.value) return ''
  if (badge.value.tone === 'ok') return 'border-emerald-500/30 text-emerald-600'
  if (badge.value.tone === 'warn') return 'border-amber-500/30 text-amber-600'
  if (badge.value.tone === 'error') return 'border-red-500/30 text-red-500'
  return ''
})
</script>

<template>
  <div class="rounded-md border" :class="tone">
    <button
      type="button"
      class="w-full px-3 py-2 text-left"
      :class="hasDetails ? 'cursor-pointer hover:bg-accent/30 transition-colors' : 'cursor-default'"
      @click="toggleExpand"
    >
      <div class="mb-1 flex items-center gap-2">
        <span v-if="hasDetails" class="size-3.5 text-muted-foreground text-[10px] leading-none flex items-center justify-center">
          {{ expanded ? '\u25BC' : '\u25B6' }}
        </span>
        <span v-else class="size-3.5" />

        <span class="text-xs">{{ icon }}</span>
        <span class="text-xs font-medium text-foreground">{{ title }}</span>

        <span
          v-if="badge"
          class="rounded border px-1.5 py-0.5 text-[10px]"
          :class="badgeToneClass"
        >
          {{ badge.label }}
        </span>

        <span class="ml-auto text-[11px] text-muted-foreground">{{ time }}</span>
      </div>
      <div class="pl-6 whitespace-pre-wrap break-words text-sm text-foreground">{{ visibleContent }}</div>
    </button>

    <div v-if="expanded && hasDetails" class="space-y-2 border-t border-border/60 px-3 py-2">
      <div v-if="facts.length > 0" class="flex flex-wrap gap-1.5">
        <span
          v-for="fact in facts"
          :key="`${fact.label}-${fact.value}`"
          class="rounded border border-border/70 bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {{ fact.label }}: {{ fact.value }}
        </span>
      </div>

      <div v-if="summaryData.hasHiddenContent && summaryData.fullContent">
        <div class="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Details</div>
        <pre class="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/30 p-2 text-xs text-foreground">{{ summaryData.fullContent }}</pre>
      </div>

      <div v-if="hasToolInput">
        <div class="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Raw arguments</div>
        <pre class="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/30 p-2 text-xs text-muted-foreground">{{ toolInputStr }}</pre>
      </div>

      <div v-if="hasMetadata">
        <div class="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Metadata</div>
        <pre class="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/30 p-2 text-xs text-muted-foreground">{{ metadataStr }}</pre>
      </div>
    </div>
  </div>
</template>
