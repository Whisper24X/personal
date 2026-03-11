<script setup lang="ts">
import type { NormalizedEntry } from '../types'
import { formatTime } from '../utils'

defineProps<{
  entry: NormalizedEntry
}>()
</script>

<template>
  <div class="flex justify-end">
    <div class="max-w-[85%] rounded-2xl rounded-br-sm bg-accent/50 px-4 py-2.5">
      <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ entry.content }}</p>
      <span class="mt-1 block text-right text-[10px] text-muted-foreground">
        {{ formatTime(entry.timestamp) }}
      </span>
    </div>
  </div>
</template>
