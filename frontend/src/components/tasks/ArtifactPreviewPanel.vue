<script setup lang="ts">
import { computed } from 'vue'
import type { ArtifactPreview } from '@/types/api/artifacts'
import type { TaskArtifact } from '@/types/api/tasks'

const props = defineProps<{
  artifact: TaskArtifact | null
  preview: ArtifactPreview | null
  /** 工作区文件内容，用于展示 docs 等实际文件 */
  worktreeFile?: { path: string; content: string } | null
  loading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  close: []
}>()

const panelTitle = computed(() => {
  if (props.worktreeFile) {
    return props.worktreeFile.path
  }
  if (props.preview?.title) {
    return props.preview.title
  }

  return props.artifact?.name ?? '产物预览'
})

const hasContent = computed(() => {
  return Boolean(props.loading || props.errorMessage || props.preview || props.worktreeFile)
})

const flattenedFileTree = computed(() => {
  const result: Array<{ path: string; type: 'file' | 'directory'; depth: number }> = []

  const visit = (nodes: ArtifactPreview['fileTree'], depth: number) => {
    for (const node of nodes) {
      result.push({
        path: node.path,
        type: node.type,
        depth,
      })

      if (node.children.length > 0) {
        visit(node.children, depth + 1)
      }
    }
  }

  if (props.preview?.fileTree.length) {
    visit(props.preview.fileTree, 0)
  }

  return result
})

const openExternalPreview = () => {
  if (!props.preview?.downloadUrl) {
    return
  }

  window.open(props.preview.downloadUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <section v-if="hasContent" class="panel-card p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm font-semibold">{{ worktreeFile ? '文件预览' : '产物预览' }}</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ panelTitle }}</p>
      </div>
      <button
        class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
        type="button"
        @click="emit('close')"
      >
        关闭
      </button>
    </div>

    <div v-if="loading" class="mt-4 text-sm text-muted-foreground">预览加载中...</div>
    <p v-else-if="errorMessage" class="mt-4 text-sm text-destructive">{{ errorMessage }}</p>

    <template v-else-if="worktreeFile">
      <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span class="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
          docs 文件
        </span>
      </div>
      <pre class="mt-4 max-h-[540px] overflow-auto rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">{{
        worktreeFile.content || '# 空文件'
      }}</pre>
    </template>

    <template v-else-if="preview">
      <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span class="rounded-full border border-border bg-background px-2 py-1">{{ preview.mode }}</span>
        <span class="rounded-full border border-border bg-background px-2 py-1">{{ preview.artifactType }}</span>
        <span v-if="preview.truncated" class="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
          已截断
        </span>
      </div>

      <div v-if="preview.mode === 'diff'" class="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div class="rounded-xl border border-border bg-background/60 p-3">
          <p class="text-xs font-semibold text-muted-foreground">变更文件</p>
          <ul class="mt-2 max-h-72 space-y-1 overflow-auto text-xs">
            <li v-for="file in preview.changedFiles" :key="file" class="truncate font-mono text-foreground">
              {{ file }}
            </li>
            <li v-if="preview.changedFiles.length === 0" class="text-muted-foreground">暂无文件列表</li>
          </ul>

          <p class="mt-3 text-xs font-semibold text-muted-foreground">文件树</p>
          <ul class="mt-2 max-h-56 space-y-1 overflow-auto text-xs">
            <li v-for="node in flattenedFileTree" :key="node.path">
              <p class="truncate font-mono text-foreground" :style="{ paddingLeft: `${node.depth * 12}px` }">
                {{ node.type === 'directory' ? '📁' : '📄' }} {{ node.path }}
              </p>
            </li>
            <li v-if="flattenedFileTree.length === 0" class="text-muted-foreground">暂无文件树</li>
          </ul>
        </div>

        <pre class="max-h-[540px] overflow-auto rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">{{
          preview.patch || '# empty diff'
        }}</pre>
      </div>

      <div v-else-if="preview.mode === 'text'" class="mt-4 space-y-2">
        <pre class="max-h-[540px] overflow-auto rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">{{
          preview.text || '# empty text preview'
        }}</pre>
        <p v-if="preview.truncated" class="text-xs text-muted-foreground">内容超过 200KB，已截断展示。</p>
      </div>

      <div v-else class="mt-4 space-y-3">
        <p class="text-sm text-muted-foreground">该产物为外部链接预览，请在新标签页打开。</p>
        <button
          class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!preview.downloadUrl"
          type="button"
          @click="openExternalPreview"
        >
          打开预览链接
        </button>
        <p v-if="preview.downloadUrl" class="break-all text-xs text-muted-foreground">{{ preview.downloadUrl }}</p>
      </div>
    </template>
  </section>
</template>
