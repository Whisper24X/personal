<template>
  <el-card shadow="hover" class="business-line-card">
    <div class="card-header">
      <div class="card-info">
        <h3 class="card-name">
          <el-icon>
            <Box />
          </el-icon>
          {{ businessLine.name }}
        </h3>
        <p v-if="businessLine.description" class="card-desc">
          {{ businessLine.description }}
        </p>
      </div>
    </div>

    <el-divider />

    <div class="card-stats">
      <div class="stat-item">
        <el-icon>
          <Monitor />
        </el-icon>
        <span>平台数: <strong>{{ businessLine.platformCount || businessLine.projectCount || 0 }}</strong></span>
      </div>
      <div class="stat-item">
        <el-icon>
          <Clock />
        </el-icon>
        <span>创建于 {{ formatDate(businessLine.createdAt) }}</span>
      </div>
    </div>

    <el-divider />

    <div class="card-actions">
      <el-button type="primary" @click="$emit('view-platforms', businessLine.id)">
        <el-icon><Monitor /></el-icon>
        查看平台
      </el-button>
      <el-button @click="$emit('edit', businessLine.id)">
        <el-icon><Edit /></el-icon>
        编辑
      </el-button>
      <el-button type="danger" plain @click="$emit('delete', businessLine.id)">
        <el-icon><Delete /></el-icon>
        删除
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Box, Monitor, Clock, Edit, Delete } from '@element-plus/icons-vue';

interface Props {
  businessLine: {
    id: string;
    name: string;
    description?: string;
    platformCount?: number;
    projectCount?: number;
    createdAt: string;
  };
}

defineProps<Props>();

defineEmits<{
  'view-platforms': [id: string];
  'edit': [id: string];
  'delete': [id: string];
}>();

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}
</script>

<style scoped>
.business-line-card {
  transition: all 0.3s;
}

.business-line-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-info {
  flex: 1;
}

.card-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-desc {
  color: #909399;
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
}

.card-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 14px;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
