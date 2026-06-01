<template>
  <el-card class="kanban-card">
    <template #header>
      <div class="card-header-content">
        <span class="card-title">
          <el-icon>
            <Operation />
          </el-icon>
          工作流看板
        </span>
        <div class="header-actions">
          <el-button
            v-if="showRecoverButton"
            type="warning"
            size="small"
            :loading="recovering"
            @click="$emit('recover')"
          >
            <el-icon><Refresh /></el-icon>
            快速恢复
          </el-button>
          <el-tag :type="statusType" effect="dark">
            {{ statusText }}
          </el-tag>
        </div>
      </div>
    </template>

    <div class="kanban-board" ref="kanbanBoardRef">
      <KanbanColumn
        v-for="roleColumn in workflowKanban"
        :key="roleColumn.role"
        :column="roleColumn"
        :is-running="isRunning"
        :running-role="runningRole"
        :current-action="currentAction"
        :current-stage-name="currentStageName"
        :role-display-name="getRoleDisplayName(roleColumn.role)"
        :role-description="getRoleDescription(roleColumn.role)"
        :resetting-roles="resettingRoles"
        :get-action-display-name="getActionDisplayName"
        :get-action-description="getActionDescription"
        :get-stage-tag-type="getStageTagType"
        @reset-role="$emit('reset-role', $event)"
        @show-confirmation="$emit('show-confirmation')"
        @view-content="$emit('view-content', $event)"
        @download-zip="$emit('download-zip', $event)"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Operation, Refresh } from '@element-plus/icons-vue';
import KanbanColumn from './KanbanColumn.vue';
import type { WorkflowRoleColumn } from './KanbanColumn.vue';

const props = defineProps<{
  workflowKanban: WorkflowRoleColumn[];
  isRunning: boolean;
  runningRole: string;
  currentAction: string;
  currentStageName: string;
  resettingRoles: Set<string>;
  getRoleDisplayName: (role: string) => string;
  getRoleDescription: (role: string) => string;
  getActionDisplayName: (action: string) => string;
  getActionDescription: (action: string) => string;
  getStageTagType: () => 'success' | 'warning' | 'info' | 'danger';
  showRecoverButton?: boolean;
  recovering?: boolean;
}>();

defineEmits<{
  'reset-role': [role: string];
  'show-confirmation': [];
  'view-content': [action: any];
  'download-zip': [zipPath: string];
  'recover': [];
}>();

const kanbanBoardRef = ref<HTMLElement | null>(null);

defineExpose({
  element: kanbanBoardRef,
});

const statusType = computed<'success' | 'warning' | 'info' | 'danger'>(() => {
  // This can be passed as prop if needed, for now use simple logic
  return 'info';
});

const statusText = computed<string>(() => {
  if (props.isRunning) return '进行中';
  return '等待中';
});
</script>

<style scoped>
.kanban-card {
  margin-bottom: 20px;
}

.kanban-board {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 0;
  min-height: 400px;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .kanban-board {
    flex-direction: column;
  }
}
</style>

