<script setup lang="ts">
import type { TaskStepState } from './taskGroupStepState'

defineOptions({ name: 'CliAssistantTaskStepBar' })

defineProps<{
  steps: { label: string; fullLabel: string; state: TaskStepState }[]
}>()

function stepBoxClass(state: TaskStepState): string {
  switch (state) {
    case 'running':
      return 'border-amber-500/35 bg-amber-500/[0.06]'
    case 'failed':
      return 'border-destructive/35 bg-destructive/5'
    default:
      return 'border-border/50 bg-muted/25'
  }
}

function stepTextClass(state: TaskStepState): string {
  switch (state) {
    case 'running':
      return 'text-amber-700 dark:text-amber-500'
    case 'failed':
      return 'text-destructive'
    default:
      return 'text-emerald-700 dark:text-emerald-500'
  }
}
</script>

<template>
  <div class="mb-1 flex flex-wrap items-center gap-2">
    <template v-for="(step, i) in steps" :key="i">
      <div
        class="min-w-0 w-max max-w-[min(560px,calc(100vw-2rem))] rounded-md border px-2.5 py-1.5 text-xs shadow-sm"
        :class="stepBoxClass(step.state)"
      >
        <span
          class="block break-words font-medium leading-snug"
          :class="stepTextClass(step.state)"
          :title="step.fullLabel"
        >
          {{ step.label }}
        </span>
      </div>
      <span v-if="i < steps.length - 1" class="select-none text-muted-foreground/50" aria-hidden="true">→</span>
    </template>
  </div>
</template>
