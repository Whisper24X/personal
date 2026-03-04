<script setup lang="ts">
import { ref } from 'vue'
import TaskFilesPanel from './TaskFilesPanel.vue'
import TaskGitPanel from './TaskGitPanel.vue'
import TaskTerminalPanel from './TaskTerminalPanel.vue'

defineOptions({
  name: 'TaskDetailRightPanel',
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

const activeTab = ref<'files' | 'git' | 'terminal'>('files')
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <div class="border-border/70 border-b px-3 py-2">
      <div class="flex gap-1">
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="activeTab === 'files' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'"
          type="button"
          @click="activeTab = 'files'"
        >
          files
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="activeTab === 'git' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'"
          type="button"
          @click="activeTab = 'git'"
        >
          git
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="activeTab === 'terminal' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'"
          type="button"
          @click="activeTab = 'terminal'"
        >
          terminal
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <TaskFilesPanel
        v-if="activeTab === 'files'"
        :task-id="props.taskId"
        :branch-name="props.branchName"
        :refresh-token="props.refreshToken"
      />

      <TaskGitPanel v-else-if="activeTab === 'git'" :task-id="props.taskId" :base-branch="props.baseBranch" />

      <TaskTerminalPanel v-else :task-id="props.taskId" />
    </div>
  </div>
</template>
