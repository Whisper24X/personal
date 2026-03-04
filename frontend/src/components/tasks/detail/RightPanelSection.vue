<script setup lang="ts">
import TaskRightPanel from './TaskRightPanel.vue'

defineOptions({
  name: 'TaskDetailRightPanelSection',
})

const props = withDefaults(
  defineProps<{
    taskId: string
    branchName?: string | null
    baseBranch?: string | null
    refreshToken?: number
  }>(),
  {
    branchName: null,
    baseBranch: null,
    refreshToken: 0,
  },
)
</script>

<template>
  <div class="bg-muted/10 flex min-w-0 flex-1 flex-col overflow-hidden">
    <TaskRightPanel
      :task-id="props.taskId"
      :branch-name="props.branchName"
      :base-branch="props.baseBranch"
      :refresh-token="props.refreshToken"
    />
  </div>
</template>
