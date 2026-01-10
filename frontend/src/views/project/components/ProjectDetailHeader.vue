<template>
  <el-page-header @back="handleBack" class="page-header">
    <template #content>
      <div class="header-content">
        <div class="header-left">
          <span class="header-title">{{ project.name }}</span>
          <el-text type="info" size="small" class="project-id">
            ID: {{ project.id }}
          </el-text>
        </div>
        <div class="header-right">
          <el-tag :type="getStatusType(project.status)" size="large" effect="light">
            {{ project.status }}
          </el-tag>
          <el-button
            v-if="project.status === 'pending' || project.status === 'running'"
            type="primary"
            size="large"
            @click="handleContinue"
          >
            <el-icon>
              <VideoPlay />
            </el-icon>
            继续执行
          </el-button>
        </div>
      </div>
    </template>
  </el-page-header>
</template>

<script setup lang="ts">
import { VideoPlay } from '@element-plus/icons-vue';

interface Props {
  project: {
    id: string;
    name: string;
    status: string;
  };
}

defineProps<Props>();

const emit = defineEmits<{
  back: [];
  continue: [];
}>();

function handleBack() {
  emit('back');
}

function handleContinue() {
  emit('continue');
}

function getStatusType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  const statusMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    completed: 'success',
    running: 'warning',
    pending: 'info',
    failed: 'danger',
  };
  return statusMap[status] || 'info';
}
</script>

<style scoped>
.page-header {
  margin-bottom: 4px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-title {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.project-id {
  font-size: 12px;
}
</style>

