<template>
  <el-row :gutter="20" class="stats-row">
    <el-col :xs="24" :sm="8">
      <StatCard title="项目总数" :value="application?.projectCount || 0" type="info">
        <template #prefix>
          <el-icon>
            <Folder />
          </el-icon>
        </template>
      </StatCard>
    </el-col>
    <el-col :xs="24" :sm="8">
      <StatCard title="创建时间" :value="formatDate(application?.createdAt || '')" type="info">
        <template #prefix>
          <el-icon>
            <Clock />
          </el-icon>
        </template>
      </StatCard>
    </el-col>
    <el-col :xs="24" :sm="8">
      <el-card shadow="hover" class="stat-card">
        <el-button type="primary" @click="handleCreateProject">
          <el-icon>
            <Plus />
          </el-icon>
          新建项目
        </el-button>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import StatCard from '../../../components/common/StatCard.vue';
import { Folder, Clock, Plus } from '@element-plus/icons-vue';

interface Props {
  application?: {
    projectCount?: number;
    createdAt?: string;
  };
}

defineProps<Props>();

const emit = defineEmits<{
  createProject: [];
}>();

function handleCreateProject() {
  emit('createProject');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}
</script>

<style scoped>
.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  margin-bottom: 16px;
}
</style>

