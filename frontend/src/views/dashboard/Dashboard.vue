<template>
  <div class="dashboard">
    <PageHeader title="控制面板" description="管理您的 AI 生成项目" :show-back="false" />

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <div v-else>
        <DashboardStats :project-count="projectCount" :completed-count="completedCount" />

        <el-card class="applications-card">
          <template #header>
            <CardHeader title="应用管理">
              <template #right>
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
              </template>
            </CardHeader>
          </template>

          <EmptyState v-if="applications.length === 0" description="还没有应用。创建您的第一个应用！" action-text="创建应用"
            :action-handler="() => router.push('/applications')" />

          <div v-else class="applications-grid">
            <DashboardApplicationCard v-for="app in applications" :key="app.id" :application="app"
              @click="viewApplication" />
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onActivated, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../../stores/project';
import { useApplicationStore } from '../../stores/application';
import { storeToRefs } from 'pinia';
import PageHeader from '../../components/common/PageHeader.vue';
import EmptyState from '../../components/common/EmptyState.vue';
import CardHeader from '../../components/common/CardHeader.vue';
import DashboardStats from './components/DashboardStats.vue';
import DashboardApplicationCard from './components/DashboardApplicationCard.vue';
import { Plus } from '@element-plus/icons-vue';

const router = useRouter();
const projectStore = useProjectStore();
const applicationStore = useApplicationStore();
const { loading, error, projectCount, completedCount } = storeToRefs(projectStore);
const { applications } = storeToRefs(applicationStore);

function refreshData() {
  projectStore.fetchProjects();
  applicationStore.fetchApplications();
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

onMounted(() => {
  refreshData();
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

function viewApplication(id: string) {
  router.push(`/application/${id}`);
}
</script>

<style scoped>
.dashboard {
  max-width: 100%;
}

.content-section {
  min-height: 400px;
}

.applications-card {
  margin-bottom: 24px;
}

.applications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
</style>
