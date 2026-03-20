<script setup lang="ts">
import { ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { TaskWorkspacePreview } from '@/types/api/tasks'
import FilePreviewCard from '@/components/core/file-browser/FilePreviewCard.vue'
import type { FileBrowserPreview } from '@/components/core/file-browser/types'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({ name: 'TaskDetailArtifactsPanel' })

const props = defineProps<{
  taskId: string
  filePath: string | null
  /** 每次从芯片打开时递增，用于同路径重复打开也刷新 */
  openNonce: number
}>()

const preview = ref<FileBrowserPreview | null>(null)
const loading = ref(false)
const errorMessage = ref('')

function toFileBrowserPreview(raw: TaskWorkspacePreview): FileBrowserPreview {
  let previewType: FileBrowserPreview['previewType']
  if (raw.previewType === 'text' && raw.mimeType === 'text/markdown') {
    previewType = 'markdown'
  } else if (
    raw.previewType === 'text' ||
    raw.previewType === 'image' ||
    raw.previewType === 'binary' ||
    raw.previewType === 'pdf' ||
    raw.previewType === 'video' ||
    raw.previewType === 'audio'
  ) {
    previewType = raw.previewType
  } else {
    previewType = 'binary'
  }

  const out: FileBrowserPreview = {
    path: raw.path,
    previewType,
    tooLarge: raw.tooLarge,
    size: raw.size,
    mimeType: raw.mimeType ?? null,
    text: raw.text ?? null,
    dataUrl: raw.dataUrl ?? null,
  }

  if (['pdf', 'video', 'audio'].includes(out.previewType) && !out.tooLarge) {
    out.dataUrl = tasksApi.getWorkspaceFileRawUrl(props.taskId, raw.path)
  }

  return out
}

watch(
  () => [props.taskId, props.filePath, props.openNonce] as const,
  async () => {
    if (!props.filePath?.trim() || !props.taskId) {
      preview.value = null
      errorMessage.value = ''
      return
    }

    loading.value = true
    errorMessage.value = ''
    try {
      const raw = await tasksApi.workspacePreview(props.taskId, props.filePath)
      preview.value = toFileBrowserPreview(raw)
    } catch (error) {
      preview.value = null
      errorMessage.value = toErrorMessage(error, '加载文件内容失败')
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="bg-background flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <FilePreviewCard
      class="min-h-0 flex-1"
      :selected-path="props.filePath"
      :preview="preview"
      :loading="loading"
      :error-message="errorMessage"
      empty-message="点击左侧变更文件芯片，在此查看工作区中的文件内容"
      :show-header="true"
      preview-max-height-class="min-h-[200px] flex-1"
    />
  </div>
</template>
