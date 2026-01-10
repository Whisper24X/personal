<template>
  <el-card class="project-info-card">
    <div class="project-info">
      <div class="info-item">
        <el-icon>
          <Document />
        </el-icon>
        <span class="label">项目名称:</span>
        <span class="value">{{ projectName }}</span>
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
import { Document, Edit } from '@element-plus/icons-vue';

defineProps<{
  projectName: string;
  currentRound: number;
  maxRounds: number;
  userIdea?: string;
}>();
</script>

<style scoped>
.project-info-card {
  margin-bottom: 20px;
}

.project-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
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

