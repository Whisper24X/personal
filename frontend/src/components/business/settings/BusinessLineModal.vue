<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import type { BusinessLineItem } from '@/hooks/core/useLayout'

const props = defineProps<{
  open: boolean
  lines: BusinessLineItem[]
  activeBusinessLineId: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'select', businessLineId: string): void
}>()

const closeModal = () => {
  emit('update:open', false)
}

const onSelectLine = (businessLineId: string) => {
  emit('select', businessLineId)
}

const onKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key !== 'Escape') return
  closeModal()
}

let previousBodyOverflow = ''

watch(
  () => props.open,
  (open) => {
    if (open) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKeydown)
      return
    }

    document.body.style.overflow = previousBodyOverflow
    window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6" aria-live="polite">
      <button
        type="button"
        aria-label="关闭业务线弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-sm"
        @click="closeModal"
      />

      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="business-line-modal-title"
        class="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="business-line-modal-title" class="text-lg font-semibold tracking-tight">选择业务线</h2>
            <p class="mt-1 text-sm text-muted-foreground">切换左侧项目按钮和项目列表的上下文。</p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
            @click="closeModal"
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
        </header>

        <div class="max-h-[60vh] overflow-y-auto p-4">
          <button
            v-for="line in props.lines"
            :key="line.id"
            type="button"
            class="mb-2 w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="line.id === props.activeBusinessLineId ? 'border-primary/45 bg-primary/8 shadow-sm' : 'border-border bg-card hover:bg-muted/45'"
            @click="onSelectLine(line.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-foreground">{{ line.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">负责人：{{ line.owner }}</p>
              </div>
              <span class="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
                项目 {{ line.projectCount }}
              </span>
            </div>
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
