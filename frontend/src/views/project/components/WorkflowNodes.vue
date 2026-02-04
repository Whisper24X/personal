<template>
  <el-card class="workflow-nodes-card">
    <template #header>
      <div class="card-header-content">
        <span class="card-title">
          <el-icon>
            <Operation />
          </el-icon>
          工作流节点
        </span>
        <div class="header-actions">
          <el-button v-if="showRecoverButton" type="warning" size="small" :loading="recovering" @click="$emit('recover')">
            <el-icon><Refresh /></el-icon>
            快速恢复
          </el-button>
          <el-dropdown v-if="roles.length > 0" trigger="click" @command="$emit('reset-role', $event)">
            <el-button type="warning" size="small" plain>
              重置角色
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="role in roles" :key="role" :command="role">
                  {{ getRoleDisplayName(role) || role }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-tag :type="statusType" effect="dark">
            {{ statusText }}
          </el-tag>
        </div>
      </div>
    </template>

    <div class="nodes-wrapper">
      <div v-for="roleGroup in roleGroups" :key="roleGroup.role" class="role-row">
        <div class="role-node" :class="{ 'role-node-active': isRoleActive(roleGroup) }">
          <div class="role-name">{{ getRoleDisplayName(roleGroup.role) || roleGroup.role }}</div>
          <el-tag size="small" :type="getRoleTagType(roleGroup)">{{ roleGroup.completedCount }}/{{ roleGroup.totalCount }}</el-tag>
        </div>
        <div class="action-row">
          <div
            v-for="action in roleGroup.actions"
            :key="`${roleGroup.role}-${action.name}`"
            class="action-node"
            :class="[`action-status-${action.status}`, { 'action-active': action.status === 'running' || action.status === 'waiting' }]"
            @click="handleActionClick(roleGroup.role, action)"
          >
            <span class="action-name">{{ getActionDisplayName(action.name) || action.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Operation, Refresh, ArrowDown } from '@element-plus/icons-vue';
import type { WorkflowRoleColumn } from './KanbanColumn.vue';
import type { WorkflowAction } from './ActionCard.vue';

const props = defineProps<{
  workflowKanban: WorkflowRoleColumn[];
  isRunning: boolean;
  runningRole: string;
  currentAction: string;
  getRoleDisplayName: (role: string) => string;
  getActionDisplayName: (action: string) => string;
  showRecoverButton?: boolean;
  recovering?: boolean;
}>();

const emit = defineEmits<{
  'reset-role': [role: string];
  recover: [];
  'view-content': [action: WorkflowAction];
}>();

const roleGroups = computed(() => {
  return props.workflowKanban.map((col) => ({
    role: col.role,
    actions: col.actions,
    completedCount: col.completedCount,
    totalCount: col.totalCount,
  }));
});

const roles = computed(() => {
  return props.workflowKanban.map((col) => col.role);
});

const statusType = computed<'success' | 'warning' | 'info' | 'danger'>(() => {
  if (props.isRunning) return 'warning';
  return 'info';
});

const statusText = computed(() => {
  if (props.isRunning) return '进行中';
  return '等待中';
});

function handleActionClick(_role: string, action: WorkflowAction) {
  if (action.status === 'completed' && action.content) {
    emit('view-content', action);
  }
}

function getRoleTagType(group: { completedCount: number; totalCount: number }): 'success' | 'warning' | 'info' | 'danger' {
  if (group.totalCount > 0 && group.completedCount === group.totalCount) return 'success';
  if (group.completedCount > 0) return 'warning';
  return 'info';
}

function isRoleActive(group: { role: string; actions: WorkflowAction[] }): boolean {
  if (props.runningRole === group.role) return true;
  return group.actions.some((action) => action.status === 'running' || action.status === 'waiting');
}
</script>

<style scoped>
.workflow-nodes-card {
  margin-bottom: 20px;
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

.nodes-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-node {
  min-width: 140px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #e4e7ed;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #303133;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.role-node-active {
  border-color: #409eff;
  background: #ecf5ff;
}

.role-name {
  font-weight: 600;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-node {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #ebeef5;
  background: #fafafa;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-node:hover {
  background: #f5f7fa;
}

.action-status-running {
  border-color: #f56c6c;
  color: #f56c6c;
}

.action-status-waiting {
  border-color: #409eff;
  color: #409eff;
}

.action-status-completed {
  border-color: #67c23a;
  color: #67c23a;
}

.action-active {
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.2);
}
</style>
