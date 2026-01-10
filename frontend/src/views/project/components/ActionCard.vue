<template>
  <div
    class="kanban-card-item"
    :class="[
      getActionCardClass(action.status),
      { 'action-running': action.status === 'running' && isRunning && runningRole === role }
    ]"
    :ref="cardRef"
    :style="action.status === 'running' ? { order: -1, zIndex: 10 } : {}"
  >
    <div class="card-item-header">
      <el-tag
        :type="getActionStatusTagType(action.status)"
        size="small"
        :effect="action.status === 'running' ? 'dark' : 'plain'"
      >
        <el-icon v-if="action.status === 'running'" class="is-loading" style="margin-right: 4px;">
          <Loading />
        </el-icon>
        {{ getActionStatusText(action.status) }}
      </el-tag>
      <el-tag v-if="action.userAction" size="small" :type="getUserActionTagType(action.userAction)">
        {{ getUserActionText(action.userAction) }}
      </el-tag>
    </div>
    <div class="card-item-title" :class="{ 'running-title': action.status === 'running' }">
      <el-icon v-if="action.status === 'running'" class="is-loading running-icon">
        <Loading />
      </el-icon>
      {{ actionDisplayName }}
    </div>
    <div class="card-item-description">{{ actionDescription }}</div>

    <!-- Content preview for completed actions -->
    <div v-if="action.status === 'completed' && action.content" class="card-item-content">
      <el-button type="primary" size="small" @click="$emit('view-content', action)">
        <el-icon>
          <Document />
        </el-icon>
        查看内容
      </el-button>
    </div>

    <!-- Output files -->
    <div v-if="action.outputFiles && action.outputFiles.length > 0" class="card-item-files">
      <el-divider content-position="left">
        <el-icon>
          <FolderOpened />
        </el-icon>
        生成的文件 ({{ action.outputFiles.length }})
      </el-divider>
      <div class="files-list">
        <el-tag
          v-for="file in action.outputFiles"
          :key="file.path || file"
          class="file-tag"
          type="info"
          effect="plain"
          size="small"
        >
          <el-icon>
            <DocumentCopy />
          </el-icon>
          {{ typeof file === 'string' ? file : file.path }}
        </el-tag>
      </div>
    </div>

    <!-- Zip archive -->
    <div v-if="action.zipPath" class="card-item-zip">
      <el-divider content-position="left">
        <el-icon>
          <Download />
        </el-icon>
        压缩包
      </el-divider>
      <el-alert type="success" :closable="false" show-icon>
        <template #title>
          <div class="zip-alert-content">
            <span>{{ action.zipType === 'workspace_zip' ? 'Workspace压缩包' : '代码压缩包' }}</span>
            <el-button type="primary" size="small" :icon="Download" @click="$emit('download-zip', action.zipPath!)">
              下载
            </el-button>
          </div>
        </template>
      </el-alert>
    </div>

    <div v-if="action.timestamp" class="card-item-footer">
      <el-icon>
        <Timer />
      </el-icon>
      <span>{{ action.timestamp }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Loading, Document, FolderOpened, DocumentCopy, Download, Timer } from '@element-plus/icons-vue';

export interface WorkflowAction {
  name: string;
  status: 'pending' | 'running' | 'waiting' | 'completed';
  userAction?: string;
  timestamp?: string;
  content?: string;
  outputFiles?: any[];
  zipPath?: string;
  zipType?: string;
  stepData?: any;
}

const props = defineProps<{
  action: WorkflowAction;
  role: string;
  isRunning: boolean;
  runningRole: string;
  actionDisplayName: string;
  actionDescription: string;
}>();

defineEmits<{
  'view-content': [action: WorkflowAction];
  'download-zip': [zipPath: string];
}>();

const cardRef = ref<HTMLElement | null>(null);

defineExpose({
  element: cardRef,
});

function getActionCardClass(status: string): string {
  return `card-status-${status}`;
}

function getActionStatusTagType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'info',
    running: 'danger',
    waiting: 'warning',
    completed: 'success',
  };
  return typeMap[status] || 'info';
}

function getActionStatusText(status: string): string {
  const textMap: Record<string, string> = {
    pending: '待处理',
    running: '进行中',
    waiting: '等待确认',
    completed: '已完成',
  };
  return textMap[status] || status;
}

function getUserActionTagType(action: string): 'success' | 'warning' | 'info' | 'danger' {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    continue: 'success',
    edit: 'warning',
    regenerate: 'info',
    skip: 'danger',
  };
  return typeMap[action] || 'info';
}

function getUserActionText(action: string): string {
  const textMap: Record<string, string> = {
    continue: '✓ 已确认',
    edit: '✎ 已编辑',
    regenerate: '↻ 已重生成',
    skip: '→ 已跳过',
  };
  return textMap[action] || action;
}
</script>

<style scoped>
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

.kanban-card-item.card-status-pending {
  opacity: 0.6;
  border-color: #dcdfe6;
}

.kanban-card-item.card-status-running,
.kanban-card-item.action-running {
  border-color: #f56c6c !important;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%) !important;
  border-left: 5px solid #f56c6c !important;
  border-right: 2px solid #f56c6c !important;
  border-top: 2px solid #f56c6c !important;
  border-bottom: 2px solid #f56c6c !important;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3) !important;
  animation: pulse-running 2s ease-in-out infinite;
  position: relative;
  overflow: hidden;
  z-index: 10;
  transform: scale(1.02);
}

.kanban-card-item.card-status-running::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 2s infinite;
}

@keyframes pulse-running {
  0%,
  100% {
    box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3);
    transform: scale(1);
  }

  50% {
    box-shadow: 0 6px 16px rgba(245, 108, 108, 0.5);
    transform: scale(1.01);
  }
}

@keyframes shimmer {
  0% {
    left: -100%;
  }

  100% {
    left: 100%;
  }
}

.kanban-card-item.card-status-waiting {
  border-color: #409EFF;
  background: #ecf5ff;
  border-left: 4px solid #409EFF;
}

.kanban-card-item.card-status-completed {
  border-color: #67c23a;
  background: #f0f9ff;
  border-left: 4px solid #67c23a;
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

.card-item-content {
  margin-top: 12px;
}

.card-item-files {
  margin-top: 12px;
}

.card-item-files .files-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.card-item-files .file-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.card-item-zip {
  margin-top: 12px;
}

.card-item-zip .zip-alert-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
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
</style>

