<template>
  <el-card class="project-info-card">
    <div class="project-info">
      <div class="info-row">
        <div class="info-item">
          <el-icon>
            <Document />
          </el-icon>
          <span class="label">项目名称:</span>
          <span class="value">{{ projectName }}</span>
        </div>
        <el-dropdown trigger="click" @command="handleDownloadCommand">
          <el-button type="primary" size="small">
            <el-icon class="el-icon--left"><Download /></el-icon>
            下载
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="code">
                <el-icon><FolderOpened /></el-icon>
                下载代码
              </el-dropdown-item>
              <el-dropdown-item command="docs">
                <el-icon><Document /></el-icon>
                下载文档
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <el-divider v-if="userIdea" />
    <div v-if="userIdea" class="user-input-section">
      <div class="user-input-header">
        <el-icon>
          <Edit />
        </el-icon>
        <span class="user-input-label">当前输入:</span>
      </div>
      <div class="user-input-content">
        {{ userIdea }}
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Document, Edit, Download, ArrowDown, FolderOpened } from '@element-plus/icons-vue';

defineProps<{
  projectName: string;
  userIdea?: string;
}>();

const emit = defineEmits<{
  'download-code': [];
  'download-docs': [];
}>();

function handleDownloadCommand(command: string) {
  if (command === 'code') {
    emit('download-code');
  } else if (command === 'docs') {
    emit('download-docs');
  }
}
</script>

<style scoped>
.project-info-card {
  margin-bottom: 20px;
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.info-item .value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-item .label {
  font-weight: 600;
  color: #606266;
}

.info-item .value {
  color: #303133;
  font-size: 16px;
}

.user-input-section {
  margin-top: 16px;
}

.user-input-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #606266;
  font-size: 14px;
}

.user-input-label {
  color: #606266;
}

.user-input-content {
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #303133;
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  border-left: 3px solid #409EFF;
}
</style>

