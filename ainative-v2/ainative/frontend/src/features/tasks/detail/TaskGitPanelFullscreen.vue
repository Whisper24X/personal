<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import TaskDiffViewer from './TaskDiffViewer.vue'

defineOptions({
  name: 'TaskGitPanelFullscreen',
})

const props = defineProps<{
  open: boolean
  selectedPath: string | null
  viewMode: 'unified' | 'split'
  diffText: string
  fallbackText: string
  diffLoading: boolean
}>()

const emit = defineEmits<{
  close: []
  setViewMode: [mode: 'unified' | 'split']
}>()

const dialogRoot = useTemplateRef<HTMLElement>('dialogRoot')

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      return
    }

    await nextTick()
    dialogRoot.value?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[140] flex bg-background/85 p-3 backdrop-blur-sm sm:p-6"
      @click.self="emit('close')"
    >
      <section
        ref="dialogRoot"
        class="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Git Diff 全屏预览"
        tabindex="-1"
        @keydown.esc="emit('close')"
      >
        <header
          class="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3"
        >
          <p class="min-w-0 truncate font-mono text-sm text-foreground">
            {{ props.selectedPath || 'Git Diff' }}
          </p>
          <div class="flex items-center gap-2">
            <div
              class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm"
            >
              <button
                class="rounded px-2.5 py-1 text-[11px] transition-colors"
                :class="
                  props.viewMode === 'unified'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                "
                type="button"
                @click="emit('setViewMode', 'unified')"
              >
                统一视图
              </button>
              <button
                class="rounded px-2.5 py-1 text-[11px] transition-colors"
                :class="
                  props.viewMode === 'split'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                "
                type="button"
                @click="emit('setViewMode', 'split')"
              >
                分栏视图
              </button>
            </div>
            <button
              class="rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              type="button"
              @click="emit('close')"
            >
              退出全屏
            </button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TaskDiffViewer
            :diff-text="props.diffText"
            :fallback-text="props.fallbackText"
            :loading="props.diffLoading"
            :empty-text="'选择文件查看差异'"
            :fallback-path="props.selectedPath"
            :view-mode="props.viewMode"
            :show-view-mode-toolbar="false"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>
