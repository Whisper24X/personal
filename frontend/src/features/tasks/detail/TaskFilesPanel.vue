<script setup lang="ts">
import FileBrowserPanel from '@shared/components/file-browser/FileBrowserPanel.vue'
import type {
  FileBrowserLoadPreview,
  FileBrowserLoadTree,
} from '@shared/components/file-browser/types'
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
    adaptive-tree-width
    :source-key="props.taskId"
    :header-title="props.branchName"
    :refresh-token="props.refreshToken"
    :load-tree="loadTree"
    :load-preview="loadPreview"
    :tree-min-width="180"
    :tree-max-width="280"
  />
</template>
