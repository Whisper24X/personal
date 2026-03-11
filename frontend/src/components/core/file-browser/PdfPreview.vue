<script setup lang="ts">
import { ref, watch } from 'vue'

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

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const handleError = (error: unknown) => {
  console.error('PDF load error:', error)
  isLoading.value = false
  hasError.value = true
  errorMessage.value = toErrorMessage(error)
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

    <div class="relative flex-1 px-4 py-6">
      <iframe
        v-if="props.src"
        :src="props.src"
        class="pdf-embed mx-auto min-h-[500px] w-full bg-white shadow-xl"
        title="PDF 预览"
        @load="handleLoaded"
        @error="handleError"
      />
    </div>
  </div>
</template>

<style scoped>
.pdf-embed {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 70vh;
  border: 0;
  background: #fff;
}
</style>
