<template>
  <div class="platform-detail">
    <!-- Error state: Platform not found -->
    <div v-if="!loading && error && !currentPlatform" class="error-state">
      <el-result
        icon="error"
        title="平台不存在"
        sub-title="该平台可能已被删除或ID不正确"
      >
        <template #extra>
          <el-button type="primary" @click="router.push('/business-lines')">返回业务线列表</el-button>
        </template>
      </el-result>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- Platform content -->
    <div v-else-if="currentPlatform" class="detail-content">
      <PageHeader
        :title="currentPlatform.name || '平台详情'"
        :description="currentPlatform.idea"
        :back-handler="handleBack"
      >
        <template #extra>
          <el-button-group>
            <el-button v-if="!isCompleted" type="primary" @click="continueWorkflow">
              <el-icon><VideoPlay /></el-icon>
              继续执行
            </el-button>
            <el-button @click="handleDownloadCode">
              <el-icon><FolderOpened /></el-icon>
              下载代码
            </el-button>
            <el-button @click="handleDownloadDocs">
              <el-icon><Document /></el-icon>
              下载文档
            </el-button>
          </el-button-group>
        </template>
      </PageHeader>

      <!-- Stats Card -->
      <el-card class="stats-card">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusType">{{ statusText }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="进度">
            <el-progress :percentage="currentPlatform.progress || 0" :stroke-width="20" />
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(currentPlatform.createdAt || currentPlatform.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间" v-if="currentPlatform.completedAt">
            {{ formatDate(currentPlatform.completedAt || currentPlatform.completed_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- Messages -->
      <el-card class="messages-card" v-if="messages.length > 0">
        <template #header>
          <div class="card-header">
            <span>执行消息</span>
            <el-tag>{{ messages.length }} 条</el-tag>
          </div>
        </template>
        <el-timeline>
          <el-timeline-item
            v-for="(msg, index) in messages.slice(0, 10)"
            :key="index"
            :timestamp="msg.timestamp"
            placement="top"
          >
            <p>{{ msg.content }}</p>
          </el-timeline-item>
        </el-timeline>
      </el-card>

      <!-- Documents -->
      <el-card class="documents-card" v-if="documents.length > 0">
        <template #header>
          <div class="card-header">
            <span>生成文档</span>
            <el-tag>{{ documents.length }} 个</el-tag>
          </div>
        </template>
        <el-table :data="documents" style="width: 100%">
          <el-table-column prop="filename" label="文件名" />
          <el-table-column prop="type" label="类型" width="120" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewDocument(row)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Knowledge Base -->
      <el-card class="kb-card">
        <template #header>
          <div class="card-header">
            <span>知识库</span>
            <el-button type="primary" size="small" @click="goToKnowledgeBase">
              管理知识库
            </el-button>
          </div>
        </template>
        <p>管理该平台相关的知识文档，用于增强AI生成效果。</p>
      </el-card>

      <!-- CLI API Key Configuration -->
      <el-card class="api-key-card">
        <template #header>
          <div class="card-header">
            <span>CLI API Key 配置</span>
            <el-button type="primary" size="small" @click="showApiKeyDialog = true">
              <el-icon><Key /></el-icon>
              配置 API Key
            </el-button>
          </div>
        </template>
        <div class="api-key-content">
          <p>为该平台配置专用的 CLI API Key，该平台的所有版本在执行 CLI 操作时将优先使用此 Key。</p>
          <div v-if="apiKeyStatus" class="api-key-status">
            <el-tag :type="apiKeyStatus.hasApiKey ? 'success' : 'info'" size="large">
              <el-icon style="margin-right: 4px;">
                <Key v-if="apiKeyStatus.hasApiKey" />
                <InfoFilled v-else />
              </el-icon>
              {{ apiKeyStatus.hasApiKey ? `已配置 (${apiKeyStatus.maskedKey})` : '未配置（使用环境变量）' }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>

    <!-- API Key Dialog -->
    <PlatformApiKeyDialog
      v-model="showApiKeyDialog"
      :platform-id="platformId"
      @updated="handleApiKeyUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlatformStore } from '../../stores/platform';
import { storeToRefs } from 'pinia';
import { apiClient } from '../../api/client';
import PageHeader from '../../components/common/PageHeader.vue';
import PlatformApiKeyDialog from './components/PlatformApiKeyDialog.vue';
import { VideoPlay, FolderOpened, Document, Key, InfoFilled } from '@element-plus/icons-vue';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const route = useRoute();
const router = useRouter();
const platformStore = usePlatformStore();
const { currentPlatform, messages, documents, loading, error } = storeToRefs(platformStore);

const platformId = route.params.id as string;
const businessLineId = ref('');
const showApiKeyDialog = ref(false);

interface ApiKeyStatus {
  hasApiKey: boolean;
  maskedKey: string | null;
}

const apiKeyStatus = ref<ApiKeyStatus | null>(null);

const isCompleted = computed(() => currentPlatform.value?.status === 'completed');

const statusType = computed(() => {
  switch (currentPlatform.value?.status) {
    case 'completed': return 'success';
    case 'running': return 'warning';
    case 'failed': return 'danger';
    default: return 'info';
  }
});

const statusText = computed(() => {
  switch (currentPlatform.value?.status) {
    case 'completed': return '已完成';
    case 'running': return '进行中';
    case 'failed': return '失败';
    case 'pending': return '待执行';
    default: return '未知';
  }
});

onMounted(async () => {
  await platformStore.fetchPlatform(platformId);
  await platformStore.fetchMessages(platformId);
  await platformStore.fetchDocuments(platformId);
  await loadApiKeyStatus();
  
  if (currentPlatform.value) {
    businessLineId.value = currentPlatform.value.applicationId || currentPlatform.value.application_id || '';
  }
});

async function loadApiKeyStatus() {
  try {
    const response = await apiClient.getPlatformCliApiKey(platformId) as any;
    apiKeyStatus.value = {
      hasApiKey: response.hasApiKey || false,
      maskedKey: response.maskedKey || null,
    };
  } catch (err: any) {
    console.error('Failed to load API key status:', err);
    // Don't show error to user, just log it
  }
}

function handleApiKeyUpdated() {
  loadApiKeyStatus();
}

function handleBack() {
  if (businessLineId.value) {
    router.push(`/business-line/${businessLineId.value}/platforms`);
  } else {
    router.push('/business-lines');
  }
}

function continueWorkflow() {
  router.push(`/platform/${platformId}/workflow`);
}

function viewDocument(doc: any) {
  const htmlContent = renderMarkdownDocument(doc.content, doc.filename || '文档');
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function renderMarkdownDocument(markdownContent: string, title: string): string {
  const renderedHtml = md.render(markdownContent);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.8; max-width: 1200px; margin: 0 auto; padding: 40px 20px; background: #fafafa; }
    .markdown-body { background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    h1, h2, h3 { color: #24292e; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
  </style>
</head>
<body><div class="markdown-body">${renderedHtml}</div></body>
</html>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function goToKnowledgeBase() {
  router.push(`/platform/${platformId}/knowledge-base`);
}

function handleDownloadCode() {
  if (!platformId) return;
  try {
    apiClient.downloadWorkspaceCode(platformId);
  } catch (error: any) {
    console.error('Download failed:', error);
  }
}

function handleDownloadDocs() {
  if (!platformId) return;
  try {
    apiClient.downloadWorkspaceDocs(platformId);
  } catch (error: any) {
    console.error('Download failed:', error);
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString();
}
</script>

<style scoped>
.platform-detail {
  max-width: 100%;
}

.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.loading-state {
  padding: 40px 20px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-card,
.messages-card,
.documents-card,
.kb-card,
.api-key-card {
  margin-bottom: 20px;
}

.api-key-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-key-status {
  margin-top: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
