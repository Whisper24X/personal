<template>
  <div class="dashboard">
    <el-page-header class="page-header" @back="() => { }">
      <template #content>
        <div class="header-content">
          <span class="header-title">控制面板</span>
          <p class="header-desc">管理您的 AI 生成项目</p>
        </div>
      </template>
    </el-page-header>

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <div v-else>
        <el-row :gutter="20" class="stats-row">
          <el-col :xs="24" :sm="8">
            <el-card shadow="hover" class="stat-card">
              <el-statistic title="项目总数" :value="projectCount">
                <template #prefix>
                  <el-icon>
                    <Folder />
                  </el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="hover" class="stat-card stat-success">
              <el-statistic title="已完成" :value="completedCount">
                <template #prefix>
                  <el-icon>
                    <CircleCheck />
                  </el-icon>
                </template>
              </el-statistic>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-card shadow="hover" class="stat-card stat-warning">
              <el-statistic title="进行中" :value="projectCount - completedCount">
                <template #prefix>
                  <el-icon>
                    <Loading />
                  </el-icon>
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
                  <el-icon>
                    <Box />
                  </el-icon>
                  管理应用
                </el-button>
                <el-button type="primary" @click="router.push('/applications')">
                  <el-icon>
                    <Plus />
                  </el-icon>
                  创建应用
                </el-button>
              </div>
            </div>
          </template>

          <el-empty v-if="applications.length === 0" description="还没有应用。创建您的第一个应用！">
            <el-button type="primary" @click="router.push('/applications')">
              创建应用
            </el-button>
          </el-empty>

          <div v-else class="applications-grid">
            <el-card v-for="app in applications" :key="app.id" shadow="hover" class="application-card"
              @click="viewApplication(app.id)">
              <div class="application-header">
                <div class="application-info">
                  <h3 class="application-name">
                    <el-icon>
                      <Box />
                    </el-icon>
                    {{ app.name }}
                  </h3>
                  <p v-if="app.description" class="application-desc">
                    {{ app.description }}
                  </p>
                </div>
              </div>

              <el-divider />

              <div class="application-stats">
                <div class="stat-item">
                  <el-icon>
                    <Folder />
                  </el-icon>
                  <span>项目数: <strong>{{ app.projectCount }}</strong></span>
                </div>
                <div class="stat-item">
                  <el-icon>
                    <Clock />
                  </el-icon>
                  <span>创建于 {{ formatDate(app.createdAt) }}</span>
                </div>
              </div>
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
  Box,
  Clock
} from '@element-plus/icons-vue';

const router = useRouter();
const projectStore = useProjectStore();
const applicationStore = useApplicationStore();
const { loading, error, projectCount, completedCount } = storeToRefs(projectStore);
const { applications } = storeToRefs(applicationStore);

onMounted(() => {
  projectStore.fetchProjects();
  applicationStore.fetchApplications();
});

function viewApplication(id: string) {
  router.push(`/application/${id}`);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}
</script>

<style scoped>
.dashboard {
  max-width: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.page-header :deep(.el-page-header__left) {
  display: none;
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

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
}

.applications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.application-card {
  cursor: pointer;
  transition: all 0.3s;
}

.application-card:hover {
  transform: translateY(-2px);
}

.application-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.application-info {
  flex: 1;
}

.application-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.application-desc {
  color: #909399;
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
}

.application-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 14px;
}
</style>
