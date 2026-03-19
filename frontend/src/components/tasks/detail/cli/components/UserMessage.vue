<script setup lang="ts">
import { computed } from 'vue'
import type { NormalizedEntry } from '../types'
import { formatTime } from '../utils'

const props = withDefaults(defineProps<{
  entry: NormalizedEntry
  variant?: 'default' | 'codex'
}>(), {
  variant: 'default',
})

const shellClass = computed(() => {
  if (props.variant === 'codex') {
    return 'border-border/60 bg-muted/[0.18]'
  }

  return 'border-border/50 bg-accent/40 shadow-sm'
})

const timeClass = computed(() => {
  if (props.variant === 'codex') {
    return 'text-muted-foreground/75'
  }

  return 'text-muted-foreground'
})
</script>

<template>
  <div class="flex justify-end">
    <div
      class="max-w-[92%] overflow-hidden rounded-2xl rounded-br-sm border sm:max-w-[82%]"
      :class="shellClass"
    >
      <div class="px-3 py-2.5">
        <p class="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {{ entry.content }}
        </p>
        <div class="mt-1.5 text-right">
          <span class="text-[10px] opacity-50" :class="timeClass">
            {{ formatTime(entry.timestamp) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
