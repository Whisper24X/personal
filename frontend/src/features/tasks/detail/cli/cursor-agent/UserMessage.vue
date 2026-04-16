<script setup lang="ts">
import { computed } from 'vue'
import type { NormalizedEntry } from '../types'
import { formatTimestampForDialog } from '../utils'

defineOptions({ name: 'CliCursorAgentUserMessage' })

const props = defineProps<{
  entry: NormalizedEntry
  formatDate?: (value?: string) => string
}>()

const sentAtLabel = computed(() => formatTimestampForDialog(props.entry.timestamp, props.formatDate))
</script>

<template>
  <div class="flex justify-end">
    <div
      class="max-w-[75%] overflow-hidden rounded-xl rounded-br-sm bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm"
    >
      <p class="whitespace-pre-wrap break-words text-sm leading-6">
        {{ entry.content }}
      </p>
      <div v-if="sentAtLabel" class="mt-1.5 text-right">
        <span class="text-[10px] text-primary-foreground/70">{{ sentAtLabel }}</span>
      </div>
    </div>
  </div>
</template>
