<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FileBrowserPreview } from './types'
import FilePreviewPanel from './FilePreviewPanel.vue'
import { formatPreviewSize, resolveTaskPreviewTypeLabel } from './preview'

defineOptions({
  name: 'FilePreviewCard',
})

const props = withDefaults(
  defineProps<{
    selectedPath?: string | null
    preview?: FileBrowserPreview | null
    loading?: boolean
    errorMessage?: string
    emptyMessage?: string
    showHeader?: boolean
    previewMaxHeightClass?: string
  }>(),
  {
    selectedPath: null,
    preview: null,
    loading: false,
    errorMessage: '',
    emptyMessage: '选择文件以预览内容',
    showHeader: true,
    previewMaxHeightClass: '',
  },
)

const sizeLabel = computed(() => {
  if (!props.preview) return ''
  return formatPreviewSize(props.preview.size)
})

const typeLabel = computed(() => resolveTaskPreviewTypeLabel(props.preview))
const previewMode = ref<'preview' | 'source'>('preview')
const canViewSource = computed(() => {
  return Boolean(props.preview && typeof props.preview.text === 'string')
})

watch(
  () => props.selectedPath,
  () => {
    previewMode.value = 'preview'
  },
)

watch(canViewSource, (enabled) => {
  if (!enabled && previewMode.value === 'source') {
    previewMode.value = 'preview'
  }
})
</script>

<template>
  <section class="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden h-full">
    <div v-if="!props.selectedPath" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      {{ props.emptyMessage }}
    </div>

    <template v-else>
      <div
        v-if="props.showHeader"
        class="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 bg-white px-4 py-3"
      >
        <div class="min-w-0">
          <p class="truncate font-mono text-sm font-semibold text-foreground">{{ props.selectedPath }}</p>
          <p v-if="props.preview" class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{{ sizeLabel }}</span>
            <span v-if="typeLabel" class="text-border">·</span>
            <span v-if="typeLabel">{{ typeLabel }}</span>
          </p>
        </div>

        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-md border border-border bg-muted/30 p-0.5 shadow-sm">
            <button
              class="rounded px-2 py-1 text-xs transition"
              :class="previewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              type="button"
              @click="previewMode = 'preview'"
            >
              预览
            </button>
            <button
              class="rounded px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
              :class="previewMode === 'source' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              :disabled="!canViewSource"
              type="button"
              @click="previewMode = 'source'"
            >
              源码
            </button>
          </div>
          <slot name="actions" />
        </div>
      </div>

      <div class="mt-4 flex flex-1 flex-col gap-3 min-h-0">
        <div
          :class="[
            'flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background',
            props.previewMaxHeightClass,
          ]"
        >
          <FilePreviewPanel
            class="flex-1 min-h-0"
            :selected-path="props.selectedPath"
            :preview="props.preview"
            :loading="props.loading"
            :error-message="props.errorMessage"
            :mode="previewMode"
          />
        </div>

        <slot name="footer" />
      </div>
    </template>
  </section>
</template>
