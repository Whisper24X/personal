<script setup lang="ts">
import type { NormalizedEntry } from '../types'
import { formatTime } from '../utils'

defineOptions({ name: 'CliCodexUserMessage' })

defineProps<{
  entry: NormalizedEntry
}>()
</script>

<template>
  <div class="flex justify-end">
    <div
      class="max-w-[75%] overflow-hidden rounded-xl rounded-br-sm bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm"
    >
      <p class="whitespace-pre-wrap break-words text-sm leading-6">
        {{ entry.content }}
      </p>
      <div class="mt-1.5 text-right">
        <span class="text-[10px] text-primary-foreground/70">
          {{ formatTime(entry.timestamp) }}
        </span>
      </div>
    </div>
  </div>
</template>
