<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import TaskCreatePanel from '@features/tasks/TaskCreatePanel.vue'

const props = withDefaults(defineProps<{
  open: boolean
  projectId?: string
}>(), {
  projectId: '',
})

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''

const close = () => {
  emit('update:open', false)
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await nextTick()
      dialogRef.value?.focus()
      return
    }

    document.body.style.overflow = previousBodyOverflow
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭新建任务弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        ref="dialogRef"
        aria-labelledby="task-create-modal-title"
        aria-modal="true"
        role="dialog"
        tabindex="-1"
        class="relative z-10 h-[min(92vh,980px)] w-[min(1280px,96vw)] overflow-auto rounded-2xl border border-border bg-background shadow-2xl"
      >
        <h2 id="task-create-modal-title" class="sr-only">新建任务</h2>
        <button
          type="button"
          aria-label="关闭"
          class="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 text-foreground/70 shadow-sm transition hover:bg-muted hover:text-foreground sm:right-4 sm:top-4"
          @click="close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <TaskCreatePanel :project-id="props.projectId" @created="close" />
      </section>
    </div>
  </Teleport>
</template>
