<template>
  <div
    class="kanban-column"
    :class="{
      'column-active': column.isActive,
      'column-running': isRunning && runningRole === column.role
    }"
    ref="columnRef"
  >
    <div class="column-header">
      <div class="column-header-left">
        <el-tag
          :type="getRoleTagType(column.role)"
          size="large"
          :effect="isRunning && runningRole === column.role ? 'dark' : 'plain'"
          :class="{ 'role-tag-running': isRunning && runningRole === column.role }"
        >
          <el-icon v-if="isRunning && runningRole === column.role" class="is-loading" style="margin-right: 4px;">
            <Loading />
          </el-icon>
          {{ roleDisplayName }}
        </el-tag>
        <el-badge
          v-if="isRunning && runningRole === column.role && currentAction"
          :value="'运行中'"
          class="running-badge"
          type="danger"
        />
      </div>
      <div class="column-header-right">
        <span class="column-count">{{ column.completedCount }} / {{ column.totalCount }}</span>
        <el-button
          type="warning"
          size="small"
          :icon="Refresh"
          @click.stop="$emit('reset-role', column.role)"
          :loading="resettingRoles.has(column.role)"
          plain
          class="reset-button"
          :title="`重置 ${roleDisplayName} 及下游所有角色的工作流`"
        >
          重置
        </el-button>
      </div>
    </div>
    <div class="column-description">{{ roleDescription }}</div>
    <div class="column-cards">
      <!-- Running indicator for this role (only show if action is not in the list) -->
      <div
        v-if="
          column.runningAction &&
          !column.currentStep &&
          isRunning &&
          !column.actions.some(a => a.name === column.runningAction && a.status === 'running')
        "
        class="kanban-card-item card-status-running"
        style="order: -2;"
      >
        <div class="card-item-header">
          <el-tag type="danger" size="small" effect="dark">
            <el-icon class="is-loading" style="margin-right: 4px;">
              <Loading />
            </el-icon>
            正在运行
          </el-tag>
        </div>
        <div class="card-item-title running-title">
          <el-icon class="is-loading running-icon">
            <Loading />
          </el-icon>
          {{ getActionDisplayName(column.runningAction) }}
        </div>
        <div class="card-item-description">{{ getActionDescription(column.runningAction) }}</div>
        <div v-if="currentStageName && runningRole === column.role" class="card-item-stage">
          <el-icon>
            <Timer />
          </el-icon>
          <el-tag size="small" :type="getStageTagType()">{{ currentStageName }}</el-tag>
        </div>
      </div>

      <!-- Current step waiting for confirmation -->
      <div v-if="column.currentStep" class="kanban-card-item card-status-waiting" @click="$emit('show-confirmation')">
        <div class="card-item-header">
          <el-tag type="warning" size="small" effect="plain"> 等待确认 </el-tag>
        </div>
        <div class="card-item-title">{{ getActionDisplayName(column.currentStep.action) }}</div>
        <div class="card-item-description">{{ getActionDescription(column.currentStep.action) }}</div>
        <div class="card-item-footer">
          <el-button type="primary" size="small" @click.stop="$emit('show-confirmation')"> 点击确认 </el-button>
        </div>
      </div>

      <!-- Action cards -->
      <ActionCard
        v-for="action in column.actions"
        :key="action.name"
        v-show="action.status !== 'waiting'"
        :action="action"
        :role="column.role"
        :is-running="isRunning"
        :running-role="runningRole"
        :action-display-name="getActionDisplayName(action.name)"
        :action-description="getActionDescription(action.name)"
        @view-content="$emit('view-content', action)"
        @download-zip="$emit('download-zip', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Loading, Refresh, Timer } from '@element-plus/icons-vue';
import ActionCard from './ActionCard.vue';
import type { WorkflowAction } from './ActionCard.vue';
import { getRoleTagType } from '../../../config/stageConfig';

export interface WorkflowRoleColumn {
  role: string;
  actions: WorkflowAction[];
  isActive: boolean;
  completedCount: number;
  totalCount: number;
  currentStep?: any;
  runningAction?: string;
}

const props = defineProps<{
  column: WorkflowRoleColumn;
  isRunning: boolean;
  runningRole: string;
  currentAction: string;
  currentStageName: string;
  roleDisplayName: string;
  roleDescription: string;
  resettingRoles: Set<string>;
  getActionDisplayName: (action: string) => string;
  getActionDescription: (action: string) => string;
  getStageTagType: () => 'success' | 'warning' | 'info' | 'danger';
}>();

defineEmits<{
  'reset-role': [role: string];
  'show-confirmation': [];
  'view-content': [action: WorkflowAction];
  'download-zip': [zipPath: string];
}>();

const columnRef = ref<HTMLElement | null>(null);

defineExpose({
  element: columnRef,
});
</script>

<style scoped>
.kanban-column {
  flex: 1;
  min-width: 280px;
  max-width: 320px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.kanban-column.column-active {
  border-color: #409EFF;
  background: #ecf5ff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
}

.kanban-column.column-running {
  border-color: #f56c6c !important;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%) !important;
  box-shadow: 0 4px 16px rgba(245, 108, 108, 0.4) !important;
  animation: pulse-column 2s ease-in-out infinite;
  position: relative;
}

.kanban-column.column-running::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #f56c6c, #ff8787, #f56c6c);
  background-size: 200% 100%;
  animation: shimmer-border 2s linear infinite;
  border-radius: 8px 8px 0 0;
}

@keyframes pulse-column {
  0%,
  100% {
    box-shadow: 0 4px 16px rgba(245, 108, 108, 0.4);
    transform: scale(1);
  }

  50% {
    box-shadow: 0 6px 20px rgba(245, 108, 108, 0.6);
    transform: scale(1.01);
  }
}

@keyframes shimmer-border {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.role-tag-running {
  animation: pulse-tag 1.5s ease-in-out infinite;
}

@keyframes pulse-tag {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.8;
  }
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.column-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reset-button {
  font-size: 12px;
  padding: 4px 8px;
}

.column-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.running-badge {
  margin-left: 4px;
}

.running-badge :deep(.el-badge__content) {
  font-size: 10px;
  padding: 2px 6px;
  animation: pulse-badge 1.5s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.column-count {
  font-size: 12px;
  color: #909399;
  font-weight: 600;
}

.column-description {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  margin-bottom: 16px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
}

.column-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kanban-card-item {
  background: #ffffff;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #e4e7ed;
  transition: all 0.3s ease;
  cursor: pointer;
}

.kanban-card-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.kanban-card-item.card-status-running {
  border-color: #f56c6c !important;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%) !important;
  border-left: 5px solid #f56c6c !important;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3) !important;
  animation: pulse-running 2s ease-in-out infinite;
}

.kanban-card-item.card-status-waiting {
  border-color: #409EFF;
  background: #ecf5ff;
  border-left: 4px solid #409EFF;
}

.card-item-header {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.card-item-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-bottom: 6px;
}

.card-item-title.running-title {
  color: #f56c6c;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}

.running-icon {
  color: #f56c6c;
  font-size: 16px;
}

.card-item-description {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-item-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #909399;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.card-item-stage {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}

.kanban-card-item .is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-running {
  0%,
  100% {
    box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3);
  }

  50% {
    box-shadow: 0 6px 16px rgba(245, 108, 108, 0.5);
  }
}
</style>

