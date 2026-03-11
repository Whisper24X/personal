<script setup lang="ts">
import { ref, watch } from 'vue'
import VuePdfEmbed from 'vue-pdf-embed'
// 必须引入样式，否则可能无法正确渲染
import 'vue-pdf-embed/dist/styles/annotationLayer.css'
import 'vue-pdf-embed/dist/styles/textLayer.css'

defineOptions({
  name: 'PdfPreview',
})

const props = defineProps<{
  src: string
}>()

const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')

watch(
  () => props.src,
  () => {
    isLoading.value = true
    hasError.value = false
    errorMessage.value = ''
  },
  { immediate: true },
)

const handleLoaded = () => {
  isLoading.value = false
}

const handleRendered = () => {
  isLoading.value = false
}

const handleError = (error: any) => {
  console.error('PDF load error:', error)
  isLoading.value = false
  hasError.value = true
  errorMessage.value = error?.message || String(error)
}

const handleLoadingFailed = (error: Error) => {
  handleError(error)
}

const handleRenderingFailed = (error: Error) => {
  handleError(error)
}
</script>

<template>
  <div class="relative flex h-full w-full flex-col overflow-auto bg-muted/20">
    <div
      v-if="isLoading"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
    >
      <span class="size-8 animate-pulse rounded-full border border-dashed border-primary/40 bg-primary/5" />
      <span class="text-sm font-medium text-muted-foreground">正在加载 PDF...</span>
    </div>

    <div
      v-if="hasError"
      class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <div class="rounded-full bg-destructive/10 p-3 text-destructive">
        <svg viewBox="0 0 24 24" fill="none" class="size-6" aria-hidden="true">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-foreground">PDF 加载失败</p>
        <p class="text-sm text-muted-foreground">{{ errorMessage || '该文件可能已损坏或不支持在线预览。' }}</p>
      </div>
    </div>

    <div class="flex-1 px-4 py-6 relative">
      <VuePdfEmbed
        v-if="props.src"
        :source="props.src"
        :width="960"
        :text-layer="false"
        :annotation-layer="false"
        class="pdf-embed mx-auto shadow-xl bg-white min-h-[500px] w-full"
        @loaded="handleLoaded"
        @rendered="handleRendered"
        @error="handleError"
        @loading-failed="handleLoadingFailed"
        @rendering-failed="handleRenderingFailed"
      />
    </div>
  </div>
</template>

<style scoped>
.pdf-embed :deep(canvas) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  width: 100% !important;
  height: auto !important;
  background: #fff;
}
</style>
