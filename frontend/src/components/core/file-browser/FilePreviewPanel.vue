<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { FileBrowserPreview } from './types'
import ImagePreview from './ImagePreview.vue'
import CodePreview from './CodePreview.vue'
import PdfPreview from './PdfPreview.vue'
import { formatPreviewSize, resolvePreviewTextLines } from './preview'

const MarkdownPreview = defineAsyncComponent(
  () => import('@/components/knowledge-base/MarkdownPreview.vue'),
)

defineOptions({
  name: 'FilePreviewPanel',
})

const props = withDefaults(
  defineProps<{
    selectedPath?: string | null
    preview?: FileBrowserPreview | null
    loading?: boolean
    errorMessage?: string
    mode?: 'preview' | 'source'
  }>(),
  {
    selectedPath: null,
    preview: null,
    loading: false,
    errorMessage: '',
    mode: 'preview',
  },
)

const previewSizeLabel = computed(() => {
  if (!props.preview) {
    return ''
  }

  return formatPreviewSize(props.preview.size)
})
const previewTextLines = computed(() => resolvePreviewTextLines(props.preview))
const sourceTextLines = computed(() => {
  return (props.preview?.text || '').split('\n')
})
const sourceUnsupported = computed(() => {
  return props.mode === 'source' && !(props.preview && typeof props.preview.text === 'string')
})
</script>

<template>
  <section class="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
    <div class="flex flex-col flex-1 min-h-0">
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
        <div
          v-if="!props.selectedPath"
          class="flex flex-1 w-full flex-col items-center justify-center gap-4 px-6 text-center"
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
          class="flex flex-1 w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground"
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
          class="flex flex-1 w-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <span class="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {{ previewSizeLabel }}
          </span>
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">文件过大，无法在线预览</p>
            <p class="text-sm text-muted-foreground">可以下载后在本地编辑器中打开查看。</p>
          </div>
        </div>

        <CodePreview
          v-else-if="props.mode === 'source' && !sourceUnsupported"
          class="flex-1 w-full min-h-0"
          :lines="sourceTextLines"
          :selected-path="props.selectedPath"
          :mime-type="props.preview?.mimeType || 'text/plain'"
        />

        <div
          v-else-if="sourceUnsupported"
          class="flex flex-1 w-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <p class="text-sm font-medium text-foreground">当前文件不支持源码视图</p>
          <p class="text-sm text-muted-foreground">请切换回预览模式查看内容。</p>
        </div>

        <ImagePreview
          v-else-if="props.preview?.previewType === 'image' && props.preview.dataUrl"
          class="flex-1 w-full"
          :src="props.preview.dataUrl"
          :alt="props.preview.path"
        />

        <PdfPreview
          v-else-if="props.preview?.previewType === 'pdf' && props.preview.dataUrl"
          class="flex-1 w-full h-full"
          :src="props.preview.dataUrl"
        />

        <div
          v-else-if="props.preview?.previewType === 'video' && props.preview.dataUrl"
          class="flex flex-1 w-full items-center justify-center bg-black/5"
        >
          <video
            controls
            class="max-h-full max-w-full"
            :src="props.preview.dataUrl"
          >
            您的浏览器不支持 HTML5 视频。
          </video>
        </div>

        <div
          v-else-if="props.preview?.previewType === 'audio' && props.preview.dataUrl"
          class="flex flex-1 w-full items-center justify-center bg-muted/10 p-8"
        >
          <audio
            controls
            class="w-full max-w-md"
            :src="props.preview.dataUrl"
          >
            您的浏览器不支持 HTML5 音频。
          </audio>
        </div>

        <div
          v-else-if="props.preview?.previewType === 'markdown' && props.preview.text"
          class="flex-1 min-h-0 overflow-auto p-4 bg-background"
        >
          <MarkdownPreview :content="props.preview.text" />
        </div>

        <CodePreview
          v-else-if="props.preview?.previewType === 'text'"
          class="flex-1 w-full min-h-0"
          :lines="previewTextLines"
          :selected-path="props.selectedPath"
          :mime-type="props.preview?.mimeType || null"
        />

        <div v-else class="flex flex-1 w-full flex-col items-center justify-center gap-3 px-6 text-center">
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
