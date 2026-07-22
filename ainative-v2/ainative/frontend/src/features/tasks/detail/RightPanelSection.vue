<script setup lang="ts">
import { computed } from 'vue'
import TaskRightPanel from './TaskRightPanel.vue'
import type {
  TaskEnvironmentPreview,
  TaskEnvironmentServiceStatus,
  TaskEnvironmentStatus,
  TaskLog,
} from '@/types/api/tasks'

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
    artifactRefreshPaths?: string[] | null
    logs?: TaskLog[]
    defaultRightTab?: 'artifacts' | 'preview' | 'files'
    environmentStatus?: TaskEnvironmentStatus | null
    environmentPreview?: TaskEnvironmentPreview | null
    environmentServiceStatuses?: TaskEnvironmentServiceStatus[] | null
    formatDate: (value?: string) => string
    artifactFilePath?: string | null
    artifactOpenNonce?: number
    artifactNodeId?: string | null
  }>(),
  {
    projectId: '',
    branchName: null,
    baseBranch: null,
    refreshToken: 0,
    artifactRefreshPaths: () => [],
    logs: () => [],
    defaultRightTab: 'artifacts',
    environmentStatus: null,
    environmentPreview: null,
    environmentServiceStatuses: () => [],
    artifactFilePath: null,
    artifactOpenNonce: 0,
    artifactNodeId: null,
  },
)

const previewEnabled = computed(() => props.environmentPreview?.status !== 'unavailable')
const terminalEnabled = computed(() => props.environmentStatus === 'ready')
</script>

<template>
  <div class="bg-muted/10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <TaskRightPanel
      :task-id="props.taskId"
      :project-id="props.projectId"
      :branch-name="props.branchName"
      :base-branch="props.baseBranch"
      :refresh-token="props.refreshToken"
      :artifact-refresh-paths="props.artifactRefreshPaths ?? []"
      :logs="props.logs"
      :default-right-tab="props.defaultRightTab"
      :preview-enabled="previewEnabled"
      :terminal-enabled="terminalEnabled"
      :preview="props.environmentPreview"
      :service-statuses="props.environmentServiceStatuses ?? []"
      :format-date="props.formatDate"
      :artifact-file-path="props.artifactFilePath ?? null"
      :artifact-open-nonce="props.artifactOpenNonce ?? 0"
      :artifact-node-id="props.artifactNodeId ?? null"
    />
  </div>
</template>
