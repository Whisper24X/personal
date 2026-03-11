<script setup lang="ts">
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-git'
import 'prismjs/components/prism-ignore'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-makefile'
import 'prismjs/components/prism-go-module'
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  highlightCodeLine,
  resolveCodeLanguage,
  resolveCodeLanguageLabel,
  resolvePrismLanguage,
} from './preview'

defineOptions({
  name: 'CodePreview',
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
const copyPathState = ref<'idle' | 'success' | 'error'>('idle')
const forceHighlight = ref(false)
let copyResetTimer: number | null = null
let copyPathResetTimer: number | null = null

const sourceText = computed(() => props.lines.join('\n'))
const language = computed(() => resolveCodeLanguage(props.selectedPath, props.mimeType))
const prismLanguage = computed(() => resolvePrismLanguage(language.value))
const languageLabel = computed(() => resolveCodeLanguageLabel(language.value))
const byteSize = computed(() => new TextEncoder().encode(sourceText.value).length)
const isLargeFile = computed(() => props.lines.length > 1000 || byteSize.value > 200 * 1024)
const shouldHighlight = computed(() => forceHighlight.value || !isLargeFile.value)
const prismGrammar = computed(() => {
  if (!prismLanguage.value) {
    return null
  }

  return Prism.languages[prismLanguage.value] ?? null
})
const usePrismHighlight = computed(() => shouldHighlight.value && Boolean(prismGrammar.value))
const highlightedHtmlLines = computed(() => {
  if (!shouldHighlight.value) {
    return props.lines.map((line) =>
      line
        ? line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        : '&nbsp;',
    )
  }

  if (usePrismHighlight.value && prismLanguage.value && prismGrammar.value) {
    const grammar = prismGrammar.value
    const lang = prismLanguage.value
    return props.lines.map((line) => {
      if (!line) {
        return '&nbsp;'
      }

      try {
        return Prism.highlight(line, grammar, lang) || '&nbsp;'
      } catch {
        return highlightCodeLine(line, language.value)
      }
    })
  }

  return props.lines.map((line) => highlightCodeLine(line, language.value))
})
const displayLineIndexes = computed(() => {
  return Array.from({ length: highlightedHtmlLines.value.length }, (_, index) => index)
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
const copyPathButtonText = computed(() => {
  if (copyPathState.value === 'success') {
    return '已复制路径'
  }

  if (copyPathState.value === 'error') {
    return '路径复制失败'
  }

  return '复制路径'
})

const resetCopyStateLater = () => {
  if (copyResetTimer) {
    window.clearTimeout(copyResetTimer)
  }

  copyResetTimer = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 2000)
}

const resetCopyPathStateLater = () => {
  if (copyPathResetTimer) {
    window.clearTimeout(copyPathResetTimer)
  }

  copyPathResetTimer = window.setTimeout(() => {
    copyPathState.value = 'idle'
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

const copyPath = async () => {
  if (!props.selectedPath || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    copyPathState.value = 'error'
    resetCopyPathStateLater()
    return
  }

  try {
    await navigator.clipboard.writeText(props.selectedPath)
    copyPathState.value = 'success'
  } catch {
    copyPathState.value = 'error'
  }

  resetCopyPathStateLater()
}

const enableHighlight = () => {
  forceHighlight.value = true
}

onBeforeUnmount(() => {
  if (copyResetTimer) {
    window.clearTimeout(copyResetTimer)
  }

  if (copyPathResetTimer) {
    window.clearTimeout(copyPathResetTimer)
  }
})
</script>

<template>
  <div class="flex flex-1 min-h-0 flex-col overflow-hidden">
    <div class="code-scroll min-h-0 flex-1 overflow-y-scroll overflow-x-hidden bg-muted/20 text-foreground">
      <div class="sticky top-0 z-10 grid h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background/95 px-4 text-[11px] text-muted-foreground backdrop-blur">
        <div class="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
          <span class="shrink-0 whitespace-nowrap rounded-full border border-border bg-muted/40 px-2.5 py-1">
            {{ languageLabel }}
          </span>
          <span class="shrink-0 whitespace-nowrap">{{ props.lines.length }} 行</span>
          <span
            v-if="!shouldHighlight"
            class="shrink-0 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300"
          >
            大文件已关闭高亮
          </span>
        </div>

        <div class="flex items-center gap-2 whitespace-nowrap">
          <button
            v-if="props.selectedPath"
            class="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
            type="button"
            @click="copyPath"
          >
            {{ copyPathButtonText }}
          </button>
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

      <div class="min-w-full font-mono text-[12px] leading-6">
        <div
          v-for="index in displayLineIndexes"
          :key="`${props.selectedPath || 'preview'}-${index}`"
          class="group relative min-w-full pl-[52px]"
        >
          <div
            class="pointer-events-none absolute inset-y-0 left-0 flex w-[52px] select-none justify-end px-3 py-0.5 text-right text-[11px] leading-6 text-muted-foreground/70"
          >
            <span>{{ index + 1 }}</span>
          </div>
          <div class="min-w-0 border-l border-border/40 bg-transparent px-4 py-0.5 group-hover:bg-muted/20">
            <code
              class="code-line prism-code block whitespace-pre-wrap break-words leading-6"
              v-html="highlightedHtmlLines[index] || '&nbsp;'"
            />
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
  font-variant-ligatures: none;
}

:deep(.token.comment),
:deep(.token.prolog),
:deep(.token.doctype),
:deep(.token.cdata),
:deep(.token-comment) {
  color: color-mix(in oklab, var(--muted-foreground) 82%, transparent);
}

:deep(.token.punctuation),
:deep(.token.operator) {
  color: color-mix(in oklab, var(--foreground) 72%, transparent);
}

:deep(.token.property),
:deep(.token.tag),
:deep(.token.boolean),
:deep(.token.number),
:deep(.token.constant),
:deep(.token.symbol),
:deep(.token.deleted),
:deep(.token-number),
:deep(.token-constant) {
  color: #b45309;
}

:deep(.token.selector),
:deep(.token.attr-name),
:deep(.token.string),
:deep(.token.char),
:deep(.token.builtin),
:deep(.token.inserted),
:deep(.token-string),
:deep(.token-key) {
  color: #15803d;
}

:deep(.token.atrule),
:deep(.token.attr-value),
:deep(.token.keyword),
:deep(.token-keyword) {
  color: #7c3aed;
}

:deep(.token.function),
:deep(.token.class-name),
:deep(.token-function),
:deep(.token-decorator) {
  color: #2563eb;
}

:deep(.token.regex),
:deep(.token.important),
:deep(.token.variable) {
  color: #db2777;
}

:deep(.token.important),
:deep(.token.bold) {
  font-weight: 600;
}

:deep(.token.italic) {
  font-style: italic;
}

:deep(.token.entity) {
  cursor: help;
}

:global(.dark) :deep(.token.comment),
:global(.dark) :deep(.token.prolog),
:global(.dark) :deep(.token.doctype),
:global(.dark) :deep(.token.cdata),
:global(.dark) :deep(.token-comment) {
  color: color-mix(in oklab, var(--muted-foreground) 88%, transparent);
}

:global(.dark) :deep(.token.property),
:global(.dark) :deep(.token.tag),
:global(.dark) :deep(.token.boolean),
:global(.dark) :deep(.token.number),
:global(.dark) :deep(.token.constant),
:global(.dark) :deep(.token.symbol),
:global(.dark) :deep(.token.deleted),
:global(.dark) :deep(.token-number),
:global(.dark) :deep(.token-constant) {
  color: #f59e0b;
}

:global(.dark) :deep(.token.selector),
:global(.dark) :deep(.token.attr-name),
:global(.dark) :deep(.token.string),
:global(.dark) :deep(.token.char),
:global(.dark) :deep(.token.builtin),
:global(.dark) :deep(.token.inserted),
:global(.dark) :deep(.token-string),
:global(.dark) :deep(.token-key) {
  color: #4ade80;
}

:global(.dark) :deep(.token.atrule),
:global(.dark) :deep(.token.attr-value),
:global(.dark) :deep(.token.keyword),
:global(.dark) :deep(.token-keyword) {
  color: #c084fc;
}

:global(.dark) :deep(.token.function),
:global(.dark) :deep(.token.class-name),
:global(.dark) :deep(.token-function),
:global(.dark) :deep(.token-decorator) {
  color: #60a5fa;
}

:global(.dark) :deep(.token.regex),
:global(.dark) :deep(.token.important),
:global(.dark) :deep(.token.variable) {
  color: #f472b6;
}
</style>
