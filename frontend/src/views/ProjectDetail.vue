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

      <el-card class="mrds-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Document />
              </el-icon>
              市场研究文档（MRD）管理
            </span>
            <el-tag>{{ mrds.length }}</el-tag>
          </div>
        </template>

        <el-empty v-if="mrds.length === 0" description="暂无市场研究文档" :image-size="100" />

        <el-table v-else :data="mrds" style="width: 100%">
          <el-table-column prop="version" label="版本" width="80" />
          <el-table-column prop="filename" label="文件名" />
          <el-table-column prop="createdAt" label="创建时间">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click.stop="viewMRD(row)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card class="prds-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Document />
              </el-icon>
              PRD 管理
            </span>
            <el-tag>{{ prds.length }}</el-tag>
          </div>
        </template>

        <el-empty v-if="prds.length === 0" description="暂无 PRD 文档" :image-size="100" />

        <el-table v-else :data="prds" style="width: 100%">
          <el-table-column prop="version" label="版本" width="80" />
          <el-table-column prop="filename" label="文件名" />
          <el-table-column prop="createdAt" label="创建时间">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.isDeleted" type="danger" size="small">已删除</el-tag>
              <el-tag v-else type="success" size="small">正常</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click.stop="viewPRD(row)">
                查看
              </el-button>
              <el-button v-if="!row.isDeleted" type="danger" link size="small" @click.stop="handleDeletePRD(row)">
                删除
              </el-button>
              <el-button v-else type="success" link size="small" @click.stop="handleRestorePRD(row)">
                恢复
              </el-button>
            </template>
          </el-table-column>
        </el-table>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import { apiClient } from '../api/client';
import MarkdownIt from 'markdown-it';
import {
  TrendCharts,
  Refresh,
  ChatLineRound,
  Document,
  DocumentCopy,
  View,
  VideoPlay
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
const { currentProject, messages, documents, loading } = storeToRefs(projectStore);

const projectId = route.params.id as string;
const prds = ref<any[]>([]);
const mrds = ref<any[]>([]);

onMounted(async () => {
  await projectStore.fetchProject(projectId);
  await projectStore.fetchMessages(projectId);
  await projectStore.fetchDocuments(projectId);
  await fetchPRDs();
  await fetchMRDs();
});

async function fetchPRDs() {
  try {
    const response = await apiClient.getPRDs(projectId, true) as any;
    prds.value = response.prds || [];
  } catch (err: any) {
    ElMessage.error(err.message || '获取 PRD 列表失败');
  }
}

async function handleDeletePRD(prd: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 PRD 版本 ${prd.version} 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await apiClient.deletePRD(projectId, prd.id);
    ElMessage.success('PRD 删除成功');
    await fetchPRDs();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除 PRD 失败');
    }
  }
}

async function handleRestorePRD(prd: any) {
  try {
    await apiClient.restorePRD(projectId, prd.id);
    ElMessage.success('PRD 恢复成功');
    await fetchPRDs();
  } catch (err: any) {
    ElMessage.error(err.message || '恢复 PRD 失败');
  }
}

async function fetchMRDs() {
  try {
    const response = await apiClient.getMRDs(projectId) as any;
    mrds.value = response.documents || [];
  } catch (err: any) {
    ElMessage.error(err.message || '获取 MRD 列表失败');
  }
}

async function viewMRD(mrd: any) {
  try {
    // Fetch full MRD content if not already loaded
    let content = mrd.content;
    if (!content) {
      const response = await apiClient.getMRD(projectId, mrd.id) as any;
      content = response.document?.content || response.content || '';
    }
    if (!content) {
      ElMessage.warning('MRD 内容为空');
      return;
    }
    // Render markdown to HTML
    const htmlContent = renderMarkdownDocument(content, mrd.filename || 'MRD 文档');
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err: any) {
    ElMessage.error(err.message || '获取 MRD 内容失败');
  }
}

function viewPRD(prd: any) {
  // Render markdown to HTML
  const htmlContent = renderMarkdownDocument(prd.content, prd.filename || 'PRD 文档');
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
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

.mrds-card {
  margin-bottom: 0;
}

.prds-card {
  margin-bottom: 0;
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
