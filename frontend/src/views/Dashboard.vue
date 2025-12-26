<template>
  <div class="dashboard">
    <el-page-header class="page-header">
      <template #content>
        <div class="header-content">
          <span class="header-title">控制面板</span>
          <p class="header-desc">管理您的 AI 生成项目</p>
        </div>
      </template>
    </el-page-header>

    <div v-loading="loading" class="content-section">
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />

      <div v-else>
        <el-row :gutter="20" class="stats-row">
          <el-col :xs="24" :sm="8">
            <el-card shadow="hover" class="stat-card">
              <el-statistic title="项目总数" :value="projectCount">
                <template #prefix>
                  <el-icon><Folder /></el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="hover" class="stat-card stat-success">
              <el-statistic title="已完成" :value="completedCount">
                <template #prefix>
                  <el-icon><CircleCheck /></el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="hover" class="stat-card stat-warning">
              <el-statistic 
                title="进行中" 
                :value="projectCount - completedCount"
              >
                <template #prefix>
                  <el-icon><Loading /></el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
        </el-row>

        <el-card class="applications-card">
          <template #header>
            <div class="card-header-content">
              <span class="card-title">应用管理</span>
              <div>
                <el-button @click="router.push('/applications')">
                  <el-icon><Box /></el-icon>
                  管理应用
                </el-button>
                <el-button type="primary" @click="router.push('/create')">
                  <el-icon><Plus /></el-icon>
                  新建项目
                </el-button>
              </div>
            </div>
          </template>

          <el-empty 
            v-if="applications.length === 0" 
            description="还没有应用。创建您的第一个应用！"
          >
            <el-button type="primary" @click="router.push('/applications')">
              创建应用
            </el-button>
          </el-empty>

          <div v-else class="applications-preview">
            <el-card
              v-for="app in applications.slice(0, 3)"
              :key="app.id"
              shadow="hover"
              class="application-preview-card"
              @click="router.push(`/application/${app.id}`)"
            >
              <div class="application-preview-header">
                <h4 class="application-preview-name">
                  <el-icon><Box /></el-icon>
                  {{ app.name }}
                </h4>
                <el-tag size="small">{{ app.projectCount }} 个项目</el-tag>
              </div>
            </el-card>
            <el-card
              v-if="applications.length > 3"
              shadow="hover"
              class="application-preview-card view-more-card"
              @click="router.push('/applications')"
            >
              <div class="view-more-content">
                <el-icon><ArrowRight /></el-icon>
                <span>查看更多</span>
              </div>
            </el-card>
          </div>
        </el-card>

        <el-card class="projects-card">
          <template #header>
            <div class="card-header-content">
              <span class="card-title">最近项目</span>
            </div>
          </template>

          <el-empty 
            v-if="projects.length === 0" 
            description="还没有项目。创建您的第一个项目！"
          >
            <el-button type="primary" @click="router.push('/create')">
              创建项目
            </el-button>
          </el-empty>

          <div v-else>
            <el-card
              v-for="project in projects"
              :key="project.id"
              shadow="hover"
              class="project-card"
              @click="viewProject(project.id)"
            >
              <div class="project-header">
                <div class="project-info">
                  <h3 class="project-name">
                    <el-icon><Document /></el-icon>
                    {{ project.name }}
                  </h3>
                  <p class="project-date">
                    <el-icon><Clock /></el-icon>
                    创建于 {{ formatDate(project.createdAt) }}
                  </p>
                </div>
                <el-tag 
                  :type="getStatusType(project.status)" 
                  size="large"
                  effect="plain"
                >
                  {{ project.status }}
                </el-tag>
              </div>

              <el-divider />

              <div class="project-stats">
                <div class="stat-item">
                  <el-icon><TrendCharts /></el-icon>
                  <span>进度: <strong>{{ project.progress ?? 0 }}%</strong></span>
                </div>
              </div>

              <el-progress 
                v-if="project.status === 'running'" 
                :percentage="project.progress" 
                :status="project.progress === 100 ? 'success' : undefined"
              />
            </el-card>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { useApplicationStore } from '../stores/application';
import { storeToRefs } from 'pinia';
import { 
  Folder, 
  CircleCheck, 
  Loading, 
  Plus, 
  Document, 
  Clock,
  TrendCharts,
  Box,
  ArrowRight
} from '@element-plus/icons-vue';

const router = useRouter();
const projectStore = useProjectStore();
const applicationStore = useApplicationStore();
const { projects, loading, error, projectCount, completedCount } = storeToRefs(projectStore);
const { applications } = storeToRefs(applicationStore);

onMounted(() => {
  projectStore.fetchProjects();
  applicationStore.fetchApplications();
});

function viewProject(id: string) {
  router.push(`/project/${id}`);
}

function formatDate(dateStr: string): string {
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
</script>

<style scoped>
.dashboard {
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

.stat-card.stat-success :deep(.el-statistic__number) {
  color: #67c23a;
}

.stat-card.stat-warning :deep(.el-statistic__number) {
  color: #e6a23c;
}

.applications-card {
  margin-bottom: 24px;
}

.applications-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.application-preview-card {
  cursor: pointer;
  transition: all 0.3s;
}

.application-preview-card:hover {
  transform: translateY(-2px);
}

.application-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.application-preview-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-more-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}

.view-more-content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 14px;
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

.project-date {
  color: #909399;
  font-size: 14px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 14px;
}
</style>

