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
  Box
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
</style>
