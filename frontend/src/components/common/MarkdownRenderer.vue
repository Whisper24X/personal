<template>
  <div class="markdown-renderer" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';

const props = defineProps<{
  content: string;
  options?: {
    html?: boolean;
    linkify?: boolean;
    typographer?: boolean;
  };
}>();

const md = new MarkdownIt({
  html: props.options?.html ?? true,
  linkify: props.options?.linkify ?? true,
  typographer: props.options?.typographer ?? true,
});

const renderedContent = computed(() => {
  if (!props.content) return '';
  return md.render(props.content);
});
</script>

<style scoped>
.markdown-renderer {
  line-height: 1.6;
  color: var(--el-text-color-primary);
}

.markdown-renderer :deep(h1),
.markdown-renderer :deep(h2),
.markdown-renderer :deep(h3),
.markdown-renderer :deep(h4),
.markdown-renderer :deep(h5),
.markdown-renderer :deep(h6) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-renderer :deep(h1) {
  font-size: 1.5em;
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 0.3em;
}

.markdown-renderer :deep(h2) {
  font-size: 1.3em;
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 0.3em;
}

.markdown-renderer :deep(h3) {
  font-size: 1.1em;
}

.markdown-renderer :deep(p) {
  margin: 0.5em 0;
}

.markdown-renderer :deep(ul),
.markdown-renderer :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-renderer :deep(li) {
  margin: 0.25em 0;
}

.markdown-renderer :deep(code) {
  background: var(--el-bg-color-page);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: var(--el-text-color-primary);
}

.markdown-renderer :deep(pre) {
  background: var(--el-bg-color-page);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.5em 0;
  border: 1px solid var(--el-border-color-lighter);
}

.markdown-renderer :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
}

.markdown-renderer :deep(blockquote) {
  border-left: 4px solid var(--el-border-color);
  padding-left: 1em;
  margin: 0.5em 0;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color-page);
  padding: 0.5em 1em;
  border-radius: 4px;
}

.markdown-renderer :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.markdown-renderer :deep(th),
.markdown-renderer :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 0.5em;
  text-align: left;
}

.markdown-renderer :deep(th) {
  background: var(--el-bg-color-page);
  font-weight: 600;
}

.markdown-renderer :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.markdown-renderer :deep(a:hover) {
  text-decoration: underline;
}

.markdown-renderer :deep(strong) {
  font-weight: 600;
}

.markdown-renderer :deep(em) {
  font-style: italic;
}

.markdown-renderer :deep(hr) {
  border: none;
  border-top: 1px solid var(--el-border-color);
  margin: 1em 0;
}
</style>
