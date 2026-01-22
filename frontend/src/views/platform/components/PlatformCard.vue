<template>
  <el-card shadow="hover" class="platform-card">
    <div class="card-header">
      <div class="card-info">
        <h3 class="card-name">
          <el-icon>
            <Monitor />
          </el-icon>
          {{ platform.name }}
        </h3>
        <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
      </div>
    </div>

    <p v-if="platform.idea" class="card-idea">
      {{ truncateText(platform.idea, 100) }}
    </p>

    <el-divider />

    <div class="card-stats">
      <div class="stat-item">
        <el-icon>
          <TrendCharts />
        </el-icon>
        <span>进度: <strong>{{ platform.progress || 0 }}%</strong></span>
      </div>
      <div class="stat-item">
        <el-icon>
          <Clock />
        </el-icon>
        <span>创建于 {{ formatDate(platform.createdAt || platform.created_at) }}</span>
      </div>
    </div>

    <el-divider />

    <div class="card-actions">
      <el-button type="primary" @click="$emit('view', platform.id)">
        <el-icon><View /></el-icon>
        {{ isCompleted ? '查看详情' : '执行/查看' }}
      </el-button>
      <el-button @click="$emit('edit', platform.id)">
        <el-icon><Edit /></el-icon>
        编辑
      </el-button>
      <el-button type="danger" plain @click="$emit('delete', platform.id)">
        <el-icon><Delete /></el-icon>
        删除
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Monitor, Clock, TrendCharts, View, Edit, Delete } from '@element-plus/icons-vue';

interface Props {
  platform: {
    id: string;
    name: string;
    idea?: string;
    status?: string;
    progress?: number;
    createdAt?: string;
    created_at?: string;
  };
}

const props = defineProps<Props>();

defineEmits<{
  'view': [id: string];
  'edit': [id: string];
  'delete': [id: string];
}>();

const isCompleted = computed(() => props.platform.status === 'completed');

const statusType = computed(() => {
  switch (props.platform.status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
});

const statusText = computed(() => {
  switch (props.platform.status) {
    case 'completed':
      return '已完成';
    case 'running':
      return '进行中';
    case 'failed':
      return '失败';
    case 'pending':
      return '待执行';
    default:
      return '未知';
  }
});

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
</script>

<style scoped>
.platform-card {
  transition: all 0.3s;
}

.platform-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-idea {
  color: #909399;
  font-size: 14px;
  margin: 12px 0;
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
