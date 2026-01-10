<template>
  <el-card shadow="hover" class="application-card" @click="handleClick">
    <div class="application-header">
      <div class="application-info">
        <h3 class="application-name">
          <el-icon>
            <Box />
          </el-icon>
          {{ application.name }}
        </h3>
        <p v-if="application.description" class="application-desc">
          {{ application.description }}
        </p>
      </div>
    </div>

    <el-divider />

    <div class="application-stats">
      <div class="stat-item">
        <el-icon>
          <Folder />
        </el-icon>
        <span>项目数: <strong>{{ application.projectCount }}</strong></span>
      </div>
      <div class="stat-item">
        <el-icon>
          <Clock />
        </el-icon>
        <span>创建于 {{ formatDate(application.createdAt) }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Box, Folder, Clock } from '@element-plus/icons-vue';

interface Props {
  application: {
    id: string;
    name: string;
    description?: string;
    projectCount: number;
    createdAt: string;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  click: [id: string];
}>();

function handleClick() {
  emit('click', props.application.id);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}
</script>

<style scoped>
.application-card {
  cursor: pointer;
  transition: all 0.3s;
}

.application-card:hover {
  transform: translateY(-2px);
}

.application-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.application-info {
  flex: 1;
}

.application-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.application-desc {
  color: #909399;
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
}

.application-stats {
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
</style>

