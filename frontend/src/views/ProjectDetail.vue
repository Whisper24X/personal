<template>
  <div class="project-detail">
    <div v-loading="loading && !currentProject" class="loading-container">
      <el-empty v-if="!currentProject && !loading" description="项目未找到" />
    </div>

    <div v-if="currentProject" class="detail-content">
      <el-page-header @back="router.push('/')" class="page-header">
        <template #content>
          <div class="header-content">
            <div class="header-left">
              <span class="header-title">{{ currentProject.name }}</span>
              <el-text type="info" size="small" class="project-id">
                ID: {{ currentProject.id }}
              </el-text>
            </div>
            <el-tag 
              :type="getStatusType(currentProject.status)" 
              size="large"
              effect="light"
            >
              {{ currentProject.status }}
            </el-tag>
          </div>
        </template>
      </el-page-header>

      <el-card class="stats-card">
        <el-row :gutter="20">
          <el-col :xs="12" :sm="12">
            <el-statistic title="进度" :value="currentProject.progress" suffix="%">
              <template #prefix>
                <el-icon><TrendCharts /></el-icon>
              </template>
            </el-statistic>
          </el-col>
          <el-col :xs="12" :sm="12">
            <el-statistic 
              title="当前轮次" 
              :value="currentProject.currentRound"
              :suffix="`/ ${currentProject.nRound}`"
            >
              <template #prefix>
                <el-icon><Refresh /></el-icon>
              </template>
            </el-statistic>
          </el-col>
        </el-row>

        <el-progress 
          v-if="currentProject.status === 'running'" 
          :percentage="currentProject.progress"
          :status="currentProject.progress === 100 ? 'success' : undefined"
          :stroke-width="12"
          striped
          striped-flow
          class="progress-bar"
        />
      </el-card>

      <el-card class="messages-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon><ChatLineRound /></el-icon>
              消息
            </span>
            <el-tag>{{ messages.length }}</el-tag>
          </div>
        </template>

        <el-empty 
          v-if="messages.length === 0" 
          description="暂无消息"
          :image-size="100"
        />

        <el-scrollbar v-else max-height="500px">
          <el-timeline>
            <el-timeline-item
              v-for="message in messages"
              :key="message.id"
              :timestamp="message.causeBy"
              placement="top"
            >
              <el-card class="message-card">
                <template #header>
                  <div class="message-header">
                    <el-tag :type="getRoleType(message.roleType)" effect="plain">
                      {{ message.roleType }}
                    </el-tag>
                  </div>
                </template>
                <el-text class="message-content">
                  {{ message.content.substring(0, 300) }}
                  <span v-if="message.content.length > 300">...</span>
                </el-text>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-scrollbar>
      </el-card>

      <el-card class="documents-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon><Document /></el-icon>
              文档
            </span>
            <el-tag>{{ documents.length }}</el-tag>
          </div>
        </template>

        <el-empty 
          v-if="documents.length === 0" 
          description="暂无生成的文档"
          :image-size="100"
        />

        <el-row v-else :gutter="16">
          <el-col 
            v-for="doc in documents" 
            :key="doc.id"
            :xs="24"
            :sm="12"
            :md="8"
          >
            <el-card 
              shadow="hover" 
              class="document-card"
              @click="viewDocument(doc)"
            >
              <div class="document-content">
                <el-icon :size="40" color="#409EFF"><DocumentCopy /></el-icon>
                <h4 class="document-title">{{ doc.filename }}</h4>
                <el-tag size="small" type="info">{{ doc.docType }}</el-tag>
                <el-button 
                  type="primary" 
                  link 
                  :icon="View"
                  class="view-button"
                >
                  查看文档
                </el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { storeToRefs } from 'pinia';
import { 
  TrendCharts, 
  Refresh, 
  ChatLineRound,
  Document,
  DocumentCopy,
  View
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const { currentProject, messages, documents, loading } = storeToRefs(projectStore);

const projectId = route.params.id as string;

onMounted(async () => {
  await projectStore.fetchProject(projectId);
  await projectStore.fetchMessages(projectId);
  await projectStore.fetchDocuments(projectId);
});

function viewDocument(doc: any) {
  // Open document in modal or new window
  const blob = new Blob([doc.content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
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

function getRoleType(role: string): 'success' | 'warning' | 'info' | 'danger' {
  const roleMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    ProductManager: 'success',
    Architect: 'warning',
    Engineer: 'info',
  };
  return roleMap[role] || 'info';
}
</script>

<style scoped>
.project-detail {
  max-width: 100%;
}

.loading-container {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  margin-bottom: 4px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
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

.stats-card {
  margin-bottom: 0;
}

.progress-bar {
  margin-top: 24px;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-card {
  margin-bottom: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

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

