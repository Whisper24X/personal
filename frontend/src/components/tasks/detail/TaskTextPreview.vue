<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  highlightTaskCodeLine,
  resolveTaskCodeLanguage,
  resolveTaskCodeLanguageLabel,
} from './task-preview'

defineOptions({
  name: 'TaskTextPreview',
})

const props = withDefaults(
  defineProps<{
    lines: string[]
    selectedPath?: string | null
    mimeType?: string | null
  }>(),
  {
    selectedPath: null,
    mimeType: null,
  },
)

const copyState = ref<'idle' | 'success' | 'error'>('idle')
const forceHighlight = ref(false)
let copyResetTimer: ReturnType<typeof window.setTimeout> | null = null

const sourceText = computed(() => props.lines.join('\n'))
const language = computed(() => resolveTaskCodeLanguage(props.selectedPath, props.mimeType))
const languageLabel = computed(() => resolveTaskCodeLanguageLabel(language.value))
const byteSize = computed(() => new TextEncoder().encode(sourceText.value).length)
const isLargeFile = computed(() => props.lines.length > 1000 || byteSize.value > 200 * 1024)
const shouldHighlight = computed(() => forceHighlight.value || !isLargeFile.value)
const renderedLines = computed(() => {
  if (!shouldHighlight.value) {
    return props.lines.map((line) => (line ? line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') : '&nbsp;'))
  }

  return props.lines.map((line) => highlightTaskCodeLine(line, language.value))
})
const copyButtonText = computed(() => {
  if (copyState.value === 'success') {
    return '已复制'
  }

  if (copyState.value === 'error') {
    return '复制失败'
  }

  return '复制代码'
})

const resetCopyStateLater = () => {
  if (copyResetTimer) {
    window.clearTimeout(copyResetTimer)
  }

  copyResetTimer = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 2000)
}

const copyCode = async () => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    copyState.value = 'error'
    resetCopyStateLater()
    return
  }

  try {
    await navigator.clipboard.writeText(sourceText.value)
    copyState.value = 'success'
  } catch {
    copyState.value = 'error'
  }

  resetCopyStateLater()
}

const enableHighlight = () => {
  forceHighlight.value = true
}

onBeforeUnmount(() => {
  if (copyResetTimer) {
    window.clearTimeout(copyResetTimer)
  }
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="grid h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 px-4 text-[11px] text-muted-foreground">
      <div class="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
        <span class="shrink-0 whitespace-nowrap rounded-full border border-border bg-muted/40 px-2.5 py-1">
          {{ languageLabel }}
        </span>
        <span class="shrink-0 whitespace-nowrap">{{ props.lines.length }} 行</span>
        <span v-if="!shouldHighlight" class="shrink-0 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
          大文件已关闭高亮
        </span>
      </div>

      <div class="flex items-center gap-2 whitespace-nowrap">
        <button
          v-if="!shouldHighlight"
          class="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          type="button"
          @click="enableHighlight"
        >
          启用高亮
        </button>
        <button
          class="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          type="button"
          @click="copyCode"
        >
          {{ copyButtonText }}
        </button>
      </div>
    </div>

    <div class="code-scroll min-h-0 overflow-y-scroll overflow-x-hidden bg-muted/20 text-foreground">
      <div class="min-w-full font-mono text-[12px] leading-6">
        <div
          v-for="(line, index) in renderedLines"
          :key="`${props.selectedPath || 'preview'}-${index}`"
          class="group relative min-w-full pl-[52px]"
        >
          <div
            class="pointer-events-none absolute inset-y-0 left-0 flex w-[52px] select-none justify-end px-3 py-0.5 text-right text-[11px] leading-6 text-muted-foreground/70"
          >
            <span>{{ index + 1 }}</span>
          </div>
          <div class="min-w-0 border-l border-border/40 bg-transparent px-4 py-0.5 group-hover:bg-muted/20">
            <code class="code-line block whitespace-pre-wrap break-words leading-6" v-html="line" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-scroll {
  scrollbar-gutter: stable;
}

.code-line {
  color: inherit;
}

.dark .code-line,
.code-line {
  font-variant-ligatures: none;
}

:deep(.token-comment) {
  color: rgb(22 163 74);
}

:deep(.token-keyword),
:deep(.token-tag) {
  color: rgb(147 51 234);
}

:deep(.token-string) {
  color: rgb(234 88 12);
}

:deep(.token-number),
:deep(.token-constant) {
  color: rgb(3 105 161);
}

:deep(.token-function),
:deep(.token-attr) {
  color: rgb(202 138 4);
}

:deep(.token-key) {
  color: rgb(2 132 199);
}

:deep(.token-decorator) {
  color: rgb(13 148 136);
}

.dark :deep(.token-comment) {
  color: rgb(22 163 74);
}

.dark :deep(.token-keyword),
.dark :deep(.token-tag) {
  color: rgb(147 51 234);
}

.dark :deep(.token-string) {
  color: rgb(234 88 12);
}

.dark :deep(.token-number),
.dark :deep(.token-constant) {
  color: rgb(3 105 161);
}

.dark :deep(.token-function),
.dark :deep(.token-attr) {
  color: rgb(202 138 4);
}

.dark :deep(.token-key) {
  color: rgb(2 132 199);
}

.dark :deep(.token-decorator) {
  color: rgb(13 148 136);
}
</style>
