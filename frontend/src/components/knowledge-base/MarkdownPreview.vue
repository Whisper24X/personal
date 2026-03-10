<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

defineOptions({
  name: 'MarkdownPreview',
})

const props = defineProps<{
  content: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let mermaidInstance: (typeof import('mermaid'))['default'] | null = null
let mermaidInitialized = false

const escapeHtml = (text: string) => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const markdownParser = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
})

const defaultFenceRenderer = markdownParser.renderer.rules.fence
markdownParser.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (!token) {
    return self.renderToken(tokens, idx, options)
  }

  const language = token.info.trim()

  if (language === 'mermaid') {
    return `<div class="mermaid">${escapeHtml(token.content)}</div>`
  }

  if (defaultFenceRenderer) {
    return defaultFenceRenderer(tokens, idx, options, env, self)
  }

  return self.renderToken(tokens, idx, options)
}

const htmlContent = computed(() => {
  const raw = props.content.trim()
  if (!raw) return ''

  const html = markdownParser.render(raw)
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
  })
})

const ensureMermaid = async () => {
  if (mermaidInstance) return mermaidInstance
  const module = await import('mermaid')
  mermaidInstance = module.default
  return mermaidInstance
}

const renderMermaid = async () => {
  const el = containerRef.value
  if (!el) return

  const mermaidNodes = el.querySelectorAll<HTMLElement>('.mermaid')
  if (mermaidNodes.length === 0) return

  try {
    const mermaid = await ensureMermaid()
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
      })
      mermaidInitialized = true
    }

    let index = 0
    for (const node of mermaidNodes) {
      const source = node.textContent?.trim() ?? ''
      if (!source) continue

      const id = `kb-mermaid-${Date.now()}-${index}`
      index += 1

      try {
        const { svg } = await mermaid.render(id, source)
        node.innerHTML = svg
      } catch (error) {
        node.innerHTML = `<pre class="rounded-lg bg-destructive/10 p-3 text-destructive text-xs overflow-x-auto">${escapeHtml(String(error))}</pre>`
      }
    }
  } catch {
    // Ignore mermaid load/render errors in preview mode.
  }
}

const renderAll = async () => {
  await nextTick()
  await renderMermaid()
}

onMounted(() => {
  void renderAll()
})

watch(
  () => htmlContent.value,
  () => {
    void renderAll()
  },
)
</script>

<template>
  <div
    ref="containerRef"
    class="markdown-preview prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-blockquote:text-foreground prose-code:text-foreground prose-strong:text-foreground prose-td:text-foreground prose-th:text-foreground prose-pre:bg-muted/50 prose-pre:p-3 prose-pre:rounded-lg prose-pre:text-foreground prose-img:rounded-lg prose-a:text-primary prose-a:underline"
    v-html="htmlContent"
  />
</template>
