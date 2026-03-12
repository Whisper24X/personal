<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NormalizedEntry } from '../types'
import { asRecord, getString, pickToolInputValue, stringify } from '../utils'

const props = defineProps<{
  entry: NormalizedEntry
  result?: NormalizedEntry
}>()

const expanded = ref(false)

const toolName = computed(() => {
  const name = props.entry.metadata?.toolName
  if (name) return name

  const typeMap: Record<string, string> = {
    command_run: 'Bash',
    file_edit: 'Edit',
    file_read: 'Read',
    tool_use: 'Tool',
  }
  return typeMap[props.entry.type] || 'Tool'
})

const paramSummary = computed(() => {
  const input = asRecord(props.entry.metadata?.toolInput)
  const cmd = getString(props.entry.metadata?.command)
  if (cmd) return `$ ${cmd}`

  const path = getString(props.entry.metadata?.filePath)
  if (path) return path

  const picked = pickToolInputValue(input)
  if (picked) return picked.length > 80 ? `${picked.slice(0, 80)}...` : picked

  return ''
})

const resultSummary = computed(() => {
  if (!props.result) return ''
  const content = props.result.content?.trim()
  if (!content) return 'completed'
  const lines = content.split('\n')
  if (lines.length > 1) return `${lines.length} lines of output`
  return content.length > 100 ? `${content.slice(0, 100)}...` : content
})

const dotColor = computed(() => {
  const status = props.result?.metadata?.status || props.entry.metadata?.status
  if (status === 'failed') return 'bg-red-500'
  if (status === 'success') return 'bg-emerald-500'
  if (status === 'running') return 'bg-yellow-500 animate-pulse'
  if (props.result) return 'bg-emerald-500'
  return 'bg-yellow-500 animate-pulse'
})

const fullInput = computed(() => {
  const input = asRecord(props.entry.metadata?.toolInput)
  if (!input) return ''
  return stringify(input)
})

const fullOutput = computed(() => {
  const output = getString(props.result?.metadata?.toolOutput) || props.result?.content?.trim() || ''
  return output
})

const toggle = () => {
  expanded.value = !expanded.value
}
</script>

<template>
  <div
    class="group cursor-pointer select-none rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
    @click="toggle"
  >
    <div class="flex items-start gap-2 text-sm">
      <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="dotColor" />
      <div class="min-w-0 flex-1">
        <span class="font-medium text-foreground">{{ toolName }}</span>
        <span v-if="paramSummary" class="text-muted-foreground">({{ paramSummary }})</span>
        <div v-if="resultSummary" class="text-xs text-muted-foreground">
          └ {{ resultSummary }}
        </div>
      </div>
      <span class="mt-0.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {{ expanded ? '收起' : '展开' }}
      </span>
    </div>

    <div v-if="expanded" class="ml-4 mt-2 space-y-2" @click.stop>
      <div v-if="fullInput" class="rounded-md bg-muted/50 p-2">
        <div class="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">输入</div>
        <pre class="max-h-48 overflow-auto text-xs text-foreground">{{ fullInput }}</pre>
      </div>
      <div v-if="fullOutput" class="rounded-md bg-muted/50 p-2">
        <div class="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">输出</div>
        <pre class="max-h-48 overflow-auto text-xs text-foreground">{{ fullOutput }}</pre>
      </div>
    </div>
  </div>
</template>
