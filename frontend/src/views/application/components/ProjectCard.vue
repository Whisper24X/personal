<template>
  <el-card shadow="hover" class="project-card" @click="handleClick">
    <div class="project-header">
      <div class="project-info">
        <h3 class="project-name">
          <el-icon>
            <Document />
          </el-icon>
          {{ project.name }}
        </h3>
        <p class="project-idea">{{ project.idea }}</p>
      </div>
      <div class="project-actions">
        <el-tag :type="getStatusType(project.status)" size="large" effect="plain">
          {{ project.status }}
        </el-tag>
        <el-button
          v-if="showKnowledgeBase"
          type="primary"
          link
          size="small"
          @click.stop="handleKnowledgeBaseClick"
          style="margin-left: 8px"
        >
          <el-icon><Collection /></el-icon>
          知识库
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Document, Collection } from '@element-plus/icons-vue';

interface Props {
  project: {
    id: string;
    name: string;
    idea?: string;
    status: string;
  };
  showKnowledgeBase?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showKnowledgeBase: true,
});

const emit = defineEmits<{
  click: [project: any];
  knowledgeBase: [projectId: string];
}>();

function handleClick() {
  emit('click', props.project);
}

function handleKnowledgeBaseClick() {
  emit('knowledgeBase', props.project.id);
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
.project-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.project-card:hover {
  transform: translateY(-2px);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.project-info {
  flex: 1;
}

.project-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-idea {
  color: #606266;
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
}

.project-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

