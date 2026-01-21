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
        <el-dropdown @command="handleCommand" trigger="click">
          <span class="dropdown-trigger" @click.stop>
            <el-button type="primary" text :icon="MoreFilled" circle />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :command="{ action: 'view', id: project.id }">
                查看详情
              </el-dropdown-item>
              <el-dropdown-item :command="{ action: 'delete', id: project.id }" divided>
                <span style="color: #F56C6C;">删除项目</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Document, Collection, MoreFilled } from '@element-plus/icons-vue';

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
  command: [command: { action: string; id: string }];
}>();

function handleClick() {
  emit('click', props.project);
}

function handleKnowledgeBaseClick() {
  emit('knowledgeBase', props.project.id);
}

function handleCommand(command: { action: string; id: string }) {
  emit('command', command);
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

.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>

