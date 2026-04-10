<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@shared/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'flex flex-col gap-6 rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color] duration-200 ease-out hover:border-border/90 hover:shadow-md',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
