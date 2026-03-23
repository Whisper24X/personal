<script setup lang="ts">
import { ref } from 'vue'
import TaskArtifactsPanel from './TaskArtifactsPanel.vue'
import TaskPreviewPanel from './TaskPreviewPanel.vue'
import TaskFilesPanel from './TaskFilesPanel.vue'
import TaskGitPanel from './TaskGitPanel.vue'
import TaskTerminalPanel from './TaskTerminalPanel.vue'
import TaskLogsPanel from './TaskLogsPanel.vue'
import TaskArtifactsPanel from './TaskArtifactsPanel.vue'
import type { TaskLog } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailRightPanel',
})

const props = withDefaults(
  defineProps<{
    taskId: string
    projectId?: string
    branchName?: string | null
    baseBranch?: string | null
    refreshToken?: number
    logs?: TaskLog[]
    defaultRightTab?: 'artifacts' | 'preview' | 'files'
    formatDate: (value?: string) => string
    /** 产物面板当前展示的文件路径（工作区预览） */
    artifactFilePath?: string | null
    /** 递增则切到「产物」Tab 并刷新预览 */
    artifactOpenNonce?: number
  }>(),
  {
    projectId: '',
    branchName: null,
    baseBranch: null,
    refreshToken: 0,
    logs: () => [],
    defaultRightTab: 'artifacts',
    artifactFilePath: null,
    artifactOpenNonce: 0,
  },
)

const activeTab = ref<'artifact' | 'preview' | 'files' | 'git' | 'terminal'>('artifact')
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col">
    <div class="border-border/70 border-b px-3 py-2">
      <div class="flex flex-wrap gap-1">
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="activeTab === 'artifacts' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'"
          type="button"
          @click="activeTab = 'artifacts'"
        >
          产物
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="activeTab === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'"
          type="button"
          @click="activeTab = 'preview'"
        >
          预览
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="
            activeTab === 'artifact'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground'
          "
          type="button"
          @click="activeTab = 'artifact'"
        >
          产物
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="
            activeTab === 'preview'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground'
          "
          type="button"
          @click="activeTab = 'preview'"
        >
          预览
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="
            activeTab === 'files'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground'
          "
          type="button"
          @click="activeTab = 'files'"
        >
          文件
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="
            activeTab === 'git'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground'
          "
          type="button"
          @click="activeTab = 'git'"
        >
          Git
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="
            activeTab === 'terminal'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground'
          "
          type="button"
          @click="activeTab = 'terminal'"
        >
          终端
        </button>
        <button
          class="h-8 rounded-md px-3 text-xs font-semibold transition"
          :class="activeTab === 'logs' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'"
          type="button"
          @click="activeTab = 'logs'"
        >
          日志
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <TaskArtifactsPanel
        v-if="activeTab === 'artifact'"
        :task-id="props.taskId"
        :refresh-token="props.refreshToken"
      />

      <TaskPreviewPanel
        v-else-if="activeTab === 'preview'"
        :task-id="props.taskId"
        :project-id="props.projectId"
      />

      <TaskFilesPanel
        v-else-if="activeTab === 'files'"
        :task-id="props.taskId"
        :branch-name="props.branchName"
        :refresh-token="props.refreshToken"
      />

      <TaskGitPanel
        v-else-if="activeTab === 'git'"
        :task-id="props.taskId"
        :base-branch="props.baseBranch"
      />

      <TaskTerminalPanel v-else-if="activeTab === 'terminal'" :task-id="props.taskId" />

      <TaskLogsPanel v-else :logs="props.logs" :format-date="props.formatDate" />
    </div>
  </div>
</template>
