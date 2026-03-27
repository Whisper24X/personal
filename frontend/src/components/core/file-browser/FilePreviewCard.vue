<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { FileBrowserPreview } from './types'
import FilePreviewPanel from './FilePreviewPanel.vue'
import {
  canShowPreviewTab,
  canShowSourceTab,
  formatPreviewSize,
  resolveDefaultPreviewMode,
  resolveTaskPreviewTypeLabel,
} from './preview'

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
const fullscreenOpen = ref(false)
const fullscreenDialogRef = useTemplateRef<HTMLDivElement>('fullscreenDialog')

const canPreviewTab = computed(() =>
  canShowPreviewTab(props.preview, props.selectedPath, {
    loading: props.loading,
    errorMessage: props.errorMessage,
  }),
)

const canSourceTab = computed(() =>
  canShowSourceTab(props.preview, {
    loading: props.loading,
    errorMessage: props.errorMessage,
  }),
)

watch(
  () => [props.selectedPath, props.preview, props.loading, props.errorMessage] as const,
  () => {
    if (!props.selectedPath) {
      fullscreenOpen.value = false
      return
    }
    fullscreenOpen.value = false
    previewMode.value = resolveDefaultPreviewMode(props.preview, props.selectedPath, {
      loading: props.loading,
      errorMessage: props.errorMessage,
    })
  },
  { immediate: true },
)

watch(
  [previewMode, canPreviewTab, canSourceTab],
  () => {
    if (previewMode.value === 'preview' && !canPreviewTab.value && canSourceTab.value) {
      previewMode.value = 'source'
    } else if (previewMode.value === 'source' && !canSourceTab.value && canPreviewTab.value) {
      previewMode.value = 'preview'
    }
  },
  { immediate: true },
)

watch(fullscreenOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  fullscreenDialogRef.value?.focus()
})

const openFullscreen = () => {
  fullscreenOpen.value = true
}

const closeFullscreen = () => {
  fullscreenOpen.value = false
}
</script>

<template>
  <section class="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden h-full">
    <div v-if="!props.selectedPath" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      {{ props.emptyMessage }}
    </div>

    <template v-else>
      <div
        v-if="props.showHeader"
        class="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate font-mono text-sm font-semibold text-foreground">{{ props.selectedPath }}</p>
          <p v-if="props.preview" class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{{ sizeLabel }}</span>
            <span v-if="typeLabel" class="text-border">·</span>
            <span v-if="typeLabel">{{ typeLabel }}</span>
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <div class="inline-flex rounded-md border border-border bg-muted/30 p-0.5 shadow-sm">
            <button
              class="rounded px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
              :class="previewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              type="button"
              :disabled="!canPreviewTab"
              @click="previewMode = 'preview'"
            >
              预览
            </button>
            <button
              class="rounded px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
              :class="previewMode === 'source' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              :disabled="!canSourceTab"
              type="button"
              @click="previewMode = 'source'"
            >
              源码
            </button>
            <button
              class="rounded px-2 py-1 text-xs transition text-muted-foreground hover:text-foreground"
              type="button"
              @click="openFullscreen"
            >
              全屏
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

  <Teleport to="body">
    <div
      v-if="fullscreenOpen"
      class="fixed inset-0 z-[140] flex bg-background/85 p-3 backdrop-blur-sm sm:p-6"
      @click.self="closeFullscreen"
    >
      <section
        ref="fullscreenDialog"
        class="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="文件全屏预览"
        tabindex="-1"
        @keydown.esc="closeFullscreen"
      >
        <header class="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm font-semibold text-foreground">{{ props.selectedPath }}</p>
            <p v-if="props.preview" class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{{ sizeLabel }}</span>
              <span v-if="typeLabel" class="text-border">·</span>
              <span v-if="typeLabel">{{ typeLabel }}</span>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <div class="inline-flex rounded-md border border-border bg-muted/30 p-0.5 shadow-sm">
              <button
                class="rounded px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="previewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                type="button"
                :disabled="!canPreviewTab"
                @click="previewMode = 'preview'"
              >
                预览
              </button>
              <button
                class="rounded px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="previewMode === 'source' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                :disabled="!canSourceTab"
                type="button"
                @click="previewMode = 'source'"
              >
                源码
              </button>
              <button
                class="rounded px-2 py-1 text-xs transition bg-background text-foreground shadow-sm"
                type="button"
                @click="closeFullscreen"
              >
                全屏
              </button>
            </div>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background">
            <FilePreviewPanel
              class="flex-1 min-h-0"
              :selected-path="props.selectedPath"
              :preview="props.preview"
              :loading="props.loading"
              :error-message="props.errorMessage"
              :mode="previewMode"
            />
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
