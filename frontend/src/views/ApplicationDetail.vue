<template>
  <div class="application-detail">
    <el-page-header @back="router.push('/applications')" class="page-header">
      <template #content>
        <div class="header-content">
          <span class="header-title">{{ application?.name || '应用详情' }}</span>
          <p v-if="application?.description" class="header-desc">
            {{ application.description }}
          </p>
        </div>
      </template>
    </el-page-header>

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <el-row :gutter="20" class="stats-row">
        <el-col :xs="24" :sm="8">
          <el-card shadow="hover" class="stat-card">
            <el-statistic title="项目总数" :value="application?.projectCount || 0">
              <template #prefix>
                <el-icon>
                  <Folder />
                </el-icon>
              </template>
            </el-statistic>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card shadow="hover" class="stat-card">
            <el-statistic title="创建时间" :value="formatDate(application?.createdAt || '')">
              <template #prefix>
                <el-icon>
                  <Clock />
                </el-icon>
              </template>
            </el-statistic>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card shadow="hover" class="stat-card">
            <el-button type="primary" @click="goToCreateProject">
              <el-icon>
                <Plus />
              </el-icon>
              新建项目
            </el-button>
          </el-card>
        </el-col>
      </el-row>

      <el-card class="projects-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">项目列表</span>
          </div>
        </template>

        <el-empty v-if="projects.length === 0" description="还没有项目。创建您的第一个项目！">
          <el-button type="primary" @click="goToCreateProject">
            创建项目
          </el-button>
        </el-empty>

        <div v-else>
          <el-card v-for="project in projects" :key="project.id" shadow="hover" class="project-card"
            @click="viewProject(project)">
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
                  type="primary"
                  link
                  size="small"
                  @click.stop="goToProjectKnowledgeBase(project.id)"
                  style="margin-left: 8px"
                >
                  <el-icon><Collection /></el-icon>
                  知识库
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
      </el-card>

      <el-card class="knowledge-base-card" v-if="projects.length > 0">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Collection />
              </el-icon>
              应用知识库
            </span>
          </div>
        </template>
        <div class="knowledge-base-content">
          <el-text type="info">
            知识库用于存储项目相关的参考文档，这些文档会被自动索引到向量数据库，用于RAG检索增强生成。
            您可以为每个项目单独管理知识库文档。
          </el-text>
          <div class="knowledge-base-projects" style="margin-top: 16px">
            <el-text type="info" size="small" style="display: block; margin-bottom: 12px">
              快速访问项目知识库：
            </el-text>
            <div class="project-links">
              <el-button
                v-for="project in projects"
                :key="project.id"
                type="primary"
                link
                @click="goToProjectKnowledgeBase(project.id)"
              >
                <el-icon><Collection /></el-icon>
                {{ project.name }} 的知识库
              </el-button>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useApplicationStore } from '../stores/application';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import { apiClient } from '../api/client';
import {
  Folder,
  Clock,
  Plus,
  Document,
  Collection
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const applicationStore = useApplicationStore();
const { currentApplication, loading, error } = storeToRefs(applicationStore);

const application = computed(() => currentApplication.value);
const projects = ref<any[]>([]);

async function refreshData() {
  const applicationId = route.params.id as string;
  await applicationStore.fetchApplication(applicationId);
  await fetchProjects(applicationId);
}

// Listen for page visibility changes to refresh when user returns to the page
const visibilityHandler = () => {
  if (!document.hidden) {
    refreshData();
  }
};

// Listen for custom refresh event from router guard
const refreshHandler = () => {
  refreshData();
};

onMounted(async () => {
  await refreshData();
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('refresh-project-list', refreshHandler);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', visibilityHandler);
  window.removeEventListener('refresh-project-list', refreshHandler);
});

// Refresh when component is activated (if using keep-alive)
onActivated(() => {
  refreshData();
});

async function fetchProjects(applicationId: string) {
  try {
    const response = await apiClient.getApplicationProjects(applicationId) as any;
    projects.value = response.projects || [];
  } catch (err: any) {
    ElMessage.error(err.message || '获取项目列表失败');
  }
}

function viewProject(project: any) {
  const projectId = project.id;
  const status = project.status;

  // 如果项目未完成（pending 或 running），跳转到交互式页面继续执行
  if (status === 'pending' || status === 'running') {
    // 获取项目详情以获取完整信息
    apiClient.getProject(projectId).then((response: any) => {
      const projectData = response.project || response;
      router.push({
        path: '/project/interactive',
        query: {
          id: projectId,
          name: projectData.name || project.name,
          idea: projectData.idea || '',
          description: projectData.description || '',
          rounds: (projectData.nRound || projectData.n_round || 5).toString(),
          applicationId: route.params.id as string,
        }
      });
    }).catch(() => {
      // 如果获取项目详情失败，使用基本信息跳转
      router.push({
        path: '/project/interactive',
        query: {
          id: projectId,
          name: project.name,
          idea: project.idea || '',
          rounds: '5',
          applicationId: route.params.id as string,
        }
      });
    });
  } else {
    // 如果项目已完成，跳转到项目详情页面
    router.push(`/project/${projectId}`);
  }
}

function goToCreateProject() {
  const applicationId = route.params.id as string;
  router.push({
    path: '/create',
    query: {
      applicationId: applicationId
    }
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
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

function goToProjectKnowledgeBase(projectId: string) {
  router.push(`/project/${projectId}/knowledge-base`);
}
</script>

<style scoped>
.application-detail {
  max-width: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.header-desc {
  color: #909399;
  margin-top: 8px;
  margin-bottom: 0;
}

.content-section {
  min-height: 400px;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  margin-bottom: 16px;
}

.projects-card {
  margin-bottom: 24px;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
}

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

.knowledge-base-card {
  margin-top: 24px;
}

.knowledge-base-content {
  padding: 20px 0;
}

.knowledge-base-projects {
  margin-top: 16px;
}

.project-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
