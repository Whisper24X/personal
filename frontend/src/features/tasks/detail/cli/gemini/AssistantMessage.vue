<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
})

const renderedHtml = computed(() => {
  const raw = props.content.trim()
  if (!raw) return ''
  const html = md.render(raw)
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
})
</script>

<template>
  <div
    class="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-p:my-1 prose-li:text-foreground prose-code:text-foreground prose-strong:text-foreground prose-pre:bg-muted/50 prose-pre:p-3 prose-pre:rounded-lg prose-pre:text-foreground prose-a:text-primary prose-a:underline"
    v-html="renderedHtml"
  />
</template>
