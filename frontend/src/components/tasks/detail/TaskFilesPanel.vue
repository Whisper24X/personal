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

const loadPreview: FileBrowserLoadPreview = (path) => {
  return tasksApi.workspacePreview(props.taskId, path)
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
