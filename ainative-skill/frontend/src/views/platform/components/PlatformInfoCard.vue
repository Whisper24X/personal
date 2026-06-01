<template>
  <el-card class="platform-info-card">
    <div class="platform-info">
      <div class="info-row">
        <div class="info-item">
          <el-icon>
            <Monitor />
          </el-icon>
          <span class="label">平台名称:</span>
          <span class="value">{{ platformName }}</span>
        </div>
        <div class="actions-row">
          <VersionSelector v-if="platformId" :platform-id="platformId" :application-id="applicationId" @version-changed="handleVersionChanged" />
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
    </div>
    <el-divider v-if="userIdea" />
    <div v-if="userIdea" class="user-input-section">
      <div class="user-input-header">
        <el-icon>
          <Edit />
        </el-icon>
        <span class="user-input-label">平台描述:</span>
      </div>
      <div class="user-input-content">
        {{ userIdea }}
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Monitor, Document, Edit, Download, ArrowDown, FolderOpened } from '@element-plus/icons-vue';
import VersionSelector from './VersionSelector.vue';

defineProps<{
  platformId?: string;
  applicationId?: string;
  platformName: string;
  userIdea?: string;
}>();

const emit = defineEmits<{
  'download-code': [];
  'download-docs': [];
  'version-changed': [version: any];
}>();

function handleDownloadCommand(command: string) {
  if (command === 'code') {
    emit('download-code');
  } else if (command === 'docs') {
    emit('download-docs');
  }
}

function handleVersionChanged(version: any) {
  emit('version-changed', version);
}
</script>

<style scoped>
.platform-info-card {
  margin-bottom: 20px;
}

.platform-info {
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

.actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
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
  border-left: 3px solid #409eff;
}
</style>
