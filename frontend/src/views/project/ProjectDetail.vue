<template>
  <div class="project-detail">
    <!-- Error state: Project not found -->
    <div v-if="!loading && error && !currentProject" class="error-state">
      <el-result
        icon="error"
        title="项目不存在"
        sub-title="该项目可能已被删除或ID不正确"
      >
        <template #extra>
          <el-button type="primary" @click="router.push('/')">返回首页</el-button>
        </template>
      </el-result>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- Project content -->
    <div v-else-if="currentProject" class="detail-content">
      <ProjectDetailHeader
        :project="currentProject"
        @back="router.push('/')"
        @continue="continueProject"
        @download-code="handleDownloadCode"
        @download-docs="handleDownloadDocs"
      />

      <ProjectStats :project="currentProject" />

      <ProjectMessages :messages="messages" />

      <ProjectDocuments :documents="documents" @view="viewDocument" />

      <ProjectKnowledgeBaseSection @manage="goToKnowledgeBase" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../../stores/project';
import { storeToRefs } from 'pinia';
import { apiClient } from '../../api/client';
import MarkdownIt from 'markdown-it';
import ProjectDetailHeader from './components/ProjectDetailHeader.vue';
import ProjectStats from './components/ProjectStats.vue';
import ProjectMessages from './components/ProjectMessages.vue';
import ProjectDocuments from './components/ProjectDocuments.vue';
import ProjectKnowledgeBaseSection from './components/ProjectKnowledgeBaseSection.vue';

// Initialize markdown parser
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const { currentProject, messages, documents, loading, error } = storeToRefs(projectStore);

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

function handleDownloadCode() {
  if (!projectId) {
    return;
  }

  try {
    apiClient.downloadWorkspaceCode(projectId);
  } catch (error: any) {
    console.error('Download failed:', error);
  }
}

function handleDownloadDocs() {
  if (!projectId) {
    return;
  }

  try {
    apiClient.downloadWorkspaceDocs(projectId);
  } catch (error: any) {
    console.error('Download failed:', error);
  }
}
</script>

<style scoped>
.project-detail {
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
</style>
