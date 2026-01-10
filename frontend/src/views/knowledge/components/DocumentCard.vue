<template>
  <el-card shadow="hover" class="document-item">
    <div class="document-header">
      <div class="document-info">
        <h3 class="document-title">{{ document.title }}</h3>
        <el-text v-if="document.description" type="info" size="small" class="document-description">
          {{ document.description }}
        </el-text>
        <div class="document-meta">
          <el-tag
            v-if="document.tags && document.tags.length > 0"
            v-for="tag in document.tags"
            :key="tag"
            size="small"
            class="tag-item"
          >
            {{ tag }}
          </el-tag>
          <el-tag :type="document.isActive ? 'success' : 'info'" size="small">
            {{ document.isActive ? '激活' : '停用' }}
          </el-tag>
          <el-text type="info" size="small">
            {{ formatDate(document.createdAt) }}
          </el-text>
        </div>
      </div>
      <div class="document-actions">
        <el-button type="primary" link @click="handleView">
          <el-icon><View /></el-icon>
          查看
        </el-button>
        <el-button type="primary" link @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" link @click="handleDelete">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { View, Edit, Delete } from '@element-plus/icons-vue';

interface Document {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: string;
}

interface Props {
  document: Document;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  view: [doc: Document];
  edit: [doc: Document];
  delete: [doc: Document];
}>();

function handleView() {
  emit('view', props.document);
}

function handleEdit() {
  emit('edit', props.document);
}

function handleDelete() {
  emit('delete', props.document);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}
</script>

<style scoped>
.document-item {
  margin-bottom: 16px;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.document-info {
  flex: 1;
}

.document-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.document-description {
  display: block;
  margin-bottom: 12px;
}

.document-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-item {
  margin-right: 4px;
}

.document-actions {
  display: flex;
  gap: 8px;
}
</style>

