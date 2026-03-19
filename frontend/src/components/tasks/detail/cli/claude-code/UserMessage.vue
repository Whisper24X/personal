<script setup lang="ts">
import type { NormalizedEntry } from '../types'
import { formatTime } from '../utils'

defineOptions({ name: 'CliClaudeCodeUserMessage' })

defineProps<{
  entry: NormalizedEntry
}>()
</script>

<template>
  <div class="flex justify-end">
    <div class="max-w-[92%] overflow-hidden rounded-2xl rounded-br-sm border border-border/50 bg-accent/40 shadow-sm sm:max-w-[82%]">
      <div class="px-3 py-2.5">
        <p class="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {{ entry.content }}
        </p>
        <div class="mt-1.5 text-right">
          <span class="text-[10px] text-muted-foreground opacity-50">
            {{ formatTime(entry.timestamp) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
