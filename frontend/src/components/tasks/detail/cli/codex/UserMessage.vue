<script setup lang="ts">
import type { NormalizedEntry } from '../types'

defineOptions({ name: 'CliCodexUserMessage' })

defineProps<{
  entry: NormalizedEntry
}>()
</script>

<template>
  <div class="flex justify-end">
    <div class="max-w-[92%] overflow-hidden rounded-2xl rounded-br-sm border border-border/60 bg-muted/[0.18] sm:max-w-[82%]">
      <div class="px-3 py-2.5">
        <p class="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {{ entry.content }}
        </p>
      </div>
    </div>
  </div>
</template>
