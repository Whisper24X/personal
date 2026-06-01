<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    confirming?: boolean
    tone?: 'danger' | 'primary'
  }>(),
  {
    confirmText: '确认',
    cancelText: '取消',
    confirming: false,
    tone: 'danger',
  },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'confirm'): void
}>()

const close = () => {
  emit('update:open', false)
}

const confirm = () => {
  emit('confirm')
}
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
        aria-label="关闭确认弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        class="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header class="border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold">{{ props.title }}</h2>
        </header>

        <div class="space-y-4 px-4 py-4">
          <p class="text-sm leading-relaxed text-muted-foreground">{{ props.description }}</p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              {{ props.cancelText }}
            </button>
            <button
              type="button"
              class="h-10 rounded-lg px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :class="props.tone === 'danger' ? 'bg-destructive' : 'bg-primary'"
              :disabled="props.confirming"
              @click="confirm"
            >
              {{ props.confirming ? '处理中...' : props.confirmText }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
