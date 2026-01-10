<template>
  <el-card class="documents-card">
    <template #header>
      <CardHeader title="文档" :icon="Document" :badge="documents.length" />
    </template>

    <EmptyState
      v-if="documents.length === 0"
      description="暂无生成的文档"
      :image-size="100"
    />

    <el-row v-else :gutter="16">
      <el-col v-for="doc in documents" :key="doc.id" :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="document-card" @click="handleViewDocument(doc)">
          <div class="document-content">
            <el-icon :size="40" color="#409EFF">
              <DocumentCopy />
            </el-icon>
            <h4 class="document-title">{{ doc.filename }}</h4>
            <el-tag size="small" type="info">{{ doc.docType }}</el-tag>
            <el-button type="primary" link :icon="View" class="view-button">
              查看文档
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </el-card>
</template>

<script setup lang="ts">
import CardHeader from '../../../components/common/CardHeader.vue';
import EmptyState from '../../../components/common/EmptyState.vue';
import { Document, DocumentCopy, View } from '@element-plus/icons-vue';

interface Document {
  id: string;
  filename: string;
  docType: string;
  content: string;
}

interface Props {
  documents: Document[];
}

defineProps<Props>();

const emit = defineEmits<{
  view: [doc: Document];
}>();

function handleViewDocument(doc: Document) {
  emit('view', doc);
}
</script>

<style scoped>
.document-card {
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 16px;
}

.document-card:hover {
  transform: translateY(-4px);
}

.document-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 12px 0;
}

.document-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.view-button {
  margin-top: 8px;
}
</style>

