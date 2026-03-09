<script setup lang="ts">
import { computed } from 'vue'
import type { TaskWorkspacePreview } from '@/types/api/tasks'
import TaskImagePreview from './TaskImagePreview.vue'
import TaskTextPreview from './TaskTextPreview.vue'
import { formatTaskPreviewSize, resolveTaskPreviewTextLines } from './task-preview'

defineOptions({
  name: 'TaskPreviewPanel',
})

const props = withDefaults(
  defineProps<{
    selectedPath?: string | null
    branchName?: string | null
    preview?: TaskWorkspacePreview | null
    loading?: boolean
    errorMessage?: string
  }>(),
  {
    selectedPath: null,
    branchName: null,
    preview: null,
    loading: false,
    errorMessage: '',
  },
)

const previewSizeLabel = computed(() => {
  if (!props.preview) {
    return ''
  }

  return formatTaskPreviewSize(props.preview.size)
})
const previewTextLines = computed(() => resolveTaskPreviewTextLines(props.preview))
</script>

<template>
  <section class="min-w-0 flex-1">
    <div class="flex h-full min-h-0 flex-col">
      <div class="min-h-0 flex-1 overflow-hidden bg-background">
        <div
          v-if="!props.selectedPath"
          class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
        >
          <span class="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <svg viewBox="0 0 20 20" fill="none" class="size-7" aria-hidden="true">
              <path d="M6 3.5h5.5L15 7v9.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
              <path d="M11.5 3.5V7H15" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
            </svg>
          </span>
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">选择文件以预览</p>
            <p class="text-sm text-muted-foreground">支持文本和图片预览，目录将保留你当前的展开状态。</p>
          </div>
        </div>

        <div
          v-else-if="props.loading"
          class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground"
        >
          <span class="size-10 animate-pulse rounded-full border border-dashed border-primary/40 bg-primary/5" />
          <div class="space-y-1">
            <p class="font-medium text-foreground">正在加载预览</p>
            <p>请稍候，马上就好。</p>
          </div>
        </div>

        <div
          v-else-if="props.errorMessage"
          class="m-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive"
        >
          {{ props.errorMessage }}
        </div>

        <div
          v-else-if="props.preview?.tooLarge"
          class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <span class="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {{ previewSizeLabel }}
          </span>
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">文件过大，无法在线预览</p>
            <p class="text-sm text-muted-foreground">可以下载后在本地编辑器中打开查看。</p>
          </div>
        </div>

        <TaskImagePreview
          v-else-if="props.preview?.previewType === 'image' && props.preview.dataUrl"
          :src="props.preview.dataUrl"
          :alt="props.preview.path"
        />

        <TaskTextPreview
          v-else-if="props.preview?.previewType === 'text'"
          :lines="previewTextLines"
          :selected-path="props.selectedPath"
          :mime-type="props.preview?.mimeType || null"
        />

        <div v-else class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <span class="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {{ props.preview?.mimeType || 'application/octet-stream' }}
          </span>
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">二进制文件不支持在线预览</p>
            <p class="text-sm text-muted-foreground">请下载后使用本地工具打开。</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
