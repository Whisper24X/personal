<script setup lang="ts">
import FileBrowserPanel from '@/components/core/file-browser/FileBrowserPanel.vue'
import type {
  FileBrowserLoadPreview,
  FileBrowserLoadTree,
} from '@/components/core/file-browser/types'
import { tasksApi } from '@/api/tasks'

defineOptions({
  name: 'TaskDetailFilesPanel',
})

const props = withDefaults(
  defineProps<{
    taskId: string
    branchName?: string | null
    refreshToken?: number
  }>(),
  {
    branchName: null,
    refreshToken: 0,
  },
)

const loadTree: FileBrowserLoadTree = (path) => {
  return tasksApi.workspaceTree(props.taskId, {
    path,
  })
}

const loadPreview: FileBrowserLoadPreview = async (path) => {
  const preview = await tasksApi.workspacePreview(props.taskId, path)
  if (['pdf', 'video', 'audio'].includes(preview.previewType) && !preview.tooLarge) {
    preview.dataUrl = tasksApi.getWorkspaceFileRawUrl(props.taskId, path)
  }
  return preview
}
</script>

<template>
  <FileBrowserPanel
    :source-key="props.taskId"
    :header-title="props.branchName"
    :refresh-token="props.refreshToken"
    :load-tree="loadTree"
    :load-preview="loadPreview"
  />
</template>
