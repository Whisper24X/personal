<script setup lang="ts">
import TaskFilesPanel from './TaskFilesPanel.vue'

defineOptions({
  name: 'TaskDetailPreviewPanel',
})

const props = withDefaults(
  defineProps<{
    taskId: string
    projectId?: string
    refreshToken?: number
  }>(),
  {
    projectId: '',
    refreshToken: 0,
  },
)
</script>

<template>
  <TaskFilesPanel
    :task-id="props.taskId"
    :branch-name="'Preview'"
    :refresh-token="props.refreshToken"
  />
</template>
