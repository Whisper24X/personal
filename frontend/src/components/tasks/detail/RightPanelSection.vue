<script setup lang="ts">
import TaskRightPanel from './TaskRightPanel.vue'

defineOptions({
  name: 'TaskDetailRightPanelSection',
})

const props = withDefaults(
  defineProps<{
    taskId: string
    projectId?: string
    branchName?: string | null
    baseBranch?: string | null
    refreshToken?: number
  }>(),
  {
    projectId: '',
    branchName: null,
    baseBranch: null,
    refreshToken: 0,
  },
)
</script>

<template>
  <div class="bg-muted/10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <TaskRightPanel
      :task-id="props.taskId"
      :project-id="props.projectId"
      :branch-name="props.branchName"
      :base-branch="props.baseBranch"
      :refresh-token="props.refreshToken"
    />
  </div>
</template>
