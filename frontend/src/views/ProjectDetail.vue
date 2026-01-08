<template>
  <div class="project-detail">
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
            <div class="header-right">
              <el-tag :type="getStatusType(currentProject.status)" size="large" effect="light">
                {{ currentProject.status }}
              </el-tag>
              <el-button v-if="currentProject.status === 'pending' || currentProject.status === 'running'"
                type="primary" size="large" @click="continueProject">
                <el-icon>
                  <VideoPlay />
                </el-icon>
                继续执行
              </el-button>
            </div>
          </div>
        </template>
      </el-page-header>

      <el-card class="stats-card">
        <el-row :gutter="20">
          <el-col :xs="12" :sm="12">
            <el-statistic title="进度" :value="currentProject.progress" suffix="%">
              <template #prefix>
                <el-icon>
                  <TrendCharts />
                </el-icon>
              </template>
            </el-statistic>
          </el-col>
          <el-col :xs="12" :sm="12">
            <el-statistic title="当前轮次" :value="currentProject.currentRound" :suffix="`/ ${currentProject.nRound}`">
              <template #prefix>
                <el-icon>
                  <Refresh />
                </el-icon>
              </template>
            </el-statistic>
          </el-col>
        </el-row>

        <el-progress v-if="currentProject.status === 'running'" :percentage="currentProject.progress"
          :status="currentProject.progress === 100 ? 'success' : undefined" :stroke-width="12" striped striped-flow
          class="progress-bar" />
      </el-card>

      <el-card class="messages-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <ChatLineRound />
              </el-icon>
              消息
            </span>
            <el-tag>{{ messages.length }}</el-tag>
          </div>
        </template>

        <el-empty v-if="messages.length === 0" description="暂无消息" :image-size="100" />

        <el-scrollbar v-else max-height="500px">
          <el-timeline>
            <el-timeline-item v-for="message in messages" :key="message.id" :timestamp="message.causeBy"
              placement="top">
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
              <el-icon>
                <Document />
              </el-icon>
              文档
            </span>
            <el-tag>{{ documents.length }}</el-tag>
          </div>
        </template>

        <el-empty v-if="documents.length === 0" description="暂无生成的文档" :image-size="100" />

        <el-row v-else :gutter="16">
          <el-col v-for="doc in documents" :key="doc.id" :xs="24" :sm="12" :md="8">
            <el-card shadow="hover" class="document-card" @click="viewDocument(doc)">
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

      <el-card class="knowledge-base-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Collection />
              </el-icon>
              知识库
            </span>
            <el-button type="primary" @click="goToKnowledgeBase">
              <el-icon><Plus /></el-icon>
              管理知识库
            </el-button>
          </div>
        </template>
        <div class="knowledge-base-content">
          <el-text type="info">
            知识库用于存储项目相关的参考文档，这些文档会被自动索引到向量数据库，用于RAG检索增强生成。
          </el-text>
          <el-button type="primary" style="margin-top: 16px" @click="goToKnowledgeBase">
            <el-icon><Collection /></el-icon>
            前往知识库管理
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { storeToRefs } from 'pinia';
import { apiClient } from '../api/client';
import MarkdownIt from 'markdown-it';
import {
  TrendCharts,
  Refresh,
  ChatLineRound,
  Document,
  DocumentCopy,
  View,
  VideoPlay,
  Collection,
  Plus
} from '@element-plus/icons-vue';

// Initialize markdown parser
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const { currentProject, messages, documents } = storeToRefs(projectStore);

const projectId = route.params.id as string;

onMounted(async () => {
  await projectStore.fetchProject(projectId);
  await projectStore.fetchMessages(projectId);
  await projectStore.fetchDocuments(projectId);
});

function viewDocument(doc: any) {
  // Render markdown to HTML
  const htmlContent = renderMarkdownDocument(doc.content, doc.filename || '文档');
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// Helper function to render markdown document as HTML page
function renderMarkdownDocument(markdownContent: string, title: string): string {
  // Render markdown to HTML
  const renderedHtml = md.render(markdownContent);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.8;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fafafa;
      color: #333;
    }
    .markdown-body {
      background: #fff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    h1 {
      font-size: 2em;
      border-bottom: 2px solid #eaecef;
      padding-bottom: 0.3em;
      margin-top: 0;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 1.5em;
      border-bottom: 1px solid #eaecef;
      padding-bottom: 0.3em;
      margin-top: 24px;
      margin-bottom: 16px;
    }
    h3 {
      font-size: 1.25em;
      margin-top: 20px;
      margin-bottom: 12px;
    }
    h4 {
      font-size: 1em;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      line-height: 1.25;
      color: #24292e;
    }
    p {
      margin-top: 0;
      margin-bottom: 16px;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 16px;
      padding-left: 2em;
    }
    li {
      margin-bottom: 8px;
    }
    blockquote {
      padding: 0 1em;
      color: #6a737d;
      border-left: 0.25em solid #dfe2e5;
      margin: 0 0 16px 0;
    }
    code {
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background-color: rgba(27, 31, 35, 0.05);
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    }
    pre {
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: #f6f8fa;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    pre code {
      display: inline;
      max-width: auto;
      padding: 0;
      margin: 0;
      overflow: visible;
      line-height: inherit;
      word-wrap: normal;
      background-color: transparent;
      border: 0;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    table th,
    table td {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
    }
    table th {
      font-weight: 600;
      background-color: #f6f8fa;
    }
    table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    img {
      max-width: 100%;
      height: auto;
      margin: 16px 0;
    }
    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e1e4e8;
      border: 0;
    }
    strong {
      font-weight: 600;
    }
    @media (max-width: 768px) {
      body {
        padding: 20px 10px;
      }
      .markdown-body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="markdown-body">
    ${renderedHtml}
  </div>
</body>
</html>`;
}

// Helper function to escape HTML special characters
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

async function continueProject() {
  if (!currentProject.value) return;

  const project = currentProject.value;

  // Fetch full project details if needed
  let projectData = project;
  if (!project.idea || !project.nRound) {
    try {
      const response = await apiClient.getProject(project.id) as any;
      projectData = response.project || response || project;
    } catch (err: any) {
      console.warn('Failed to fetch project details:', err);
      // Use current project data as fallback
    }
  }

  router.push({
    path: '/project/interactive',
    query: {
      id: projectData.id,
      name: projectData.name,
      idea: projectData.idea || '',
      description: projectData.description || '',
      rounds: (projectData.nRound || projectData.n_round || 5).toString(),
      applicationId: projectData.applicationId || projectData.application_id || '',
    }
  });
}

function goToKnowledgeBase() {
  router.push(`/project/${projectId}/knowledge-base`);
}
</script>

<style scoped>
.project-detail {
  max-width: 100%;
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

.knowledge-base-card {
  margin-top: 20px;
}

.knowledge-base-content {
  text-align: center;
  padding: 20px;
}
</style>
