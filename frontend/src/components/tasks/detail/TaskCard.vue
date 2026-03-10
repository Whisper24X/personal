<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Task } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailTaskCard',
})

const props = defineProps<{
  task: Task | null
  statusLabel: string
  statusClass: string
  modeLabel: string
  branchLabel: string
  actionLoading: boolean
  canExecute: boolean
  canRemove?: boolean
}>()

const emit = defineEmits<{
  execute: []
  refresh: []
  remove: []
}>()

const promptExpanded = ref(false)

const promptText = computed(() => {
  return (props.task?.prompt ?? '').trim()
})

const promptLineCount = computed(() => {
  if (!promptText.value) return 0
  return promptText.value.split(/\r?\n/).length
})

const canTogglePrompt = computed(() => {
  return promptText.value.length > 480 || promptLineCount.value > 3
})

watch(promptText, () => {
  promptExpanded.value = false
})
</script>

<template>
  <section class="border-border/50 bg-background/95 w-full rounded-xl border shadow-sm">
    <div class="flex items-center justify-between gap-3 px-4 py-2.5">
      <div class="flex items-center gap-2.5">
        <div class="flex size-6 items-center justify-center rounded-md bg-primary/10">
          <svg class="size-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clip-rule="evenodd" />
          </svg>
        </div>
        <span class="text-sm font-semibold text-foreground">任务</span>
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" :class="props.statusClass">
          {{ props.statusLabel }}
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          class="inline-flex h-6 items-center rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="props.actionLoading || !props.canExecute"
          type="button"
          @click="emit('execute')"
        >
          执行
        </button>
        <button
          class="flex size-6 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          type="button"
          aria-label="刷新"
          @click="emit('refresh')"
        >
          <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.364.363a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.112-.231Zm-1.624-8.3a.75.75 0 0 0-1.112-.231A5.5 5.5 0 0 0 3.576 5.36l.312.311H1.455a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V2.787a.75.75 0 0 0-1.5 0v2.033l-.364-.363A7 7 0 0 1 15.688 7.595a.75.75 0 0 0-2-4.471Z" clip-rule="evenodd" />
          </svg>
        </button>
        <button
          v-if="props.canRemove"
          class="flex size-6 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="props.actionLoading"
          type="button"
          aria-label="删除任务"
          @click="emit('remove')"
        >
          <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022 1.005 11.36A2.75 2.75 0 0 0 7.76 20h4.48a2.75 2.75 0 0 0 2.742-2.53l1.005-11.36.149.022a.75.75 0 1 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.5 5.5a.75.75 0 0 1-1.495-.137l.5-5.5a.75.75 0 0 1 .795-.662Zm2.84 0a.75.75 0 0 1 .795.662l.5 5.5a.75.75 0 1 1-1.495.136l-.5-5.5a.75.75 0 0 1 .7-.798Z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <div class="px-4 pb-3 pt-1">
      <p class="text-foreground break-words text-[13px] font-medium leading-snug">
        {{ props.task?.title ?? '任务详情' }}
      </p>

      <div v-if="promptText" class="relative mt-1.5">
        <p
          class="break-words text-xs leading-relaxed text-muted-foreground"
          :class="promptExpanded ? '' : 'line-clamp-3'"
        >{{ promptText }}</p>

        <button
          v-if="canTogglePrompt"
          class="mt-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          type="button"
          :aria-expanded="promptExpanded"
          aria-label="展开或收起 prompt"
          @click="promptExpanded = !promptExpanded"
        >
          {{ promptExpanded ? '收起' : '展开' }}
        </button>
      </div>
    </div>
  </section>
</template>
