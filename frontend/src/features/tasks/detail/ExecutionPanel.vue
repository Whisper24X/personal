<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TaskMessage, TaskStatus } from '@/types/api/tasks'
import CliLogRenderer from './cli/CliLogRenderer.vue'

defineOptions({
  name: 'TaskDetailExecutionPanel',
})

const props = defineProps<{
  title: string
  loading: boolean
  agentCliId: string
  taskStatus: TaskStatus | null
  taskStatusLabel: string
  taskStatusClass: string
  streamConnected: boolean
  messages: TaskMessage[]
  formatDate: (value?: string) => string
}>()

const scrollContainer = ref<HTMLDivElement | null>(null)
const userScrolledUp = ref(false)
const showScrollButton = ref(false)

const THRESHOLD = 200

const checkScroll = () => {
  const el = scrollContainer.value
  if (!el) return
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  userScrolledUp.value = distanceFromBottom > THRESHOLD
  showScrollButton.value = distanceFromBottom > THRESHOLD
}

const scrollToBottom = () => {
  const el = scrollContainer.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  userScrolledUp.value = false
  showScrollButton.value = false
}

watch(
  () => props.messages.length,
  async () => {
    if (userScrolledUp.value) return
    await nextTick()
    const el = scrollContainer.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  },
)

watch(
  () => props.loading,
  async (loading) => {
    if (!loading) {
      await nextTick()
      const el = scrollContainer.value
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }
  },
)

onMounted(async () => {
  scrollContainer.value?.addEventListener('scroll', checkScroll, { passive: true })
  await nextTick()
  const el = scrollContainer.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
})

onBeforeUnmount(() => {
  scrollContainer.value?.removeEventListener('scroll', checkScroll)
})
</script>

<template>
  <section class="relative border-border/50 bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border shadow-sm">
    <div class="border-border/50 bg-background/95 sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur">
      <div class="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
        <span>{{ props.title }}</span>
      </div>
    </div>

    <div ref="scrollContainer" class="relative min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <div v-if="props.loading" class="flex h-full items-center justify-center text-sm text-muted-foreground">加载执行内容中...</div>

      <template v-else>
        <CliLogRenderer
          :agent-cli-id="props.agentCliId"
          :messages="props.messages"
          :format-date="props.formatDate"
        />
      </template>
    </div>

    <!-- Scroll to bottom button -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <button
        v-if="showScrollButton"
        class="absolute bottom-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-accent transition-colors"
        title="滚动到底部"
        @click="scrollToBottom"
      >
        <span class="text-sm">↓</span>
      </button>
    </Transition>
  </section>
</template>
