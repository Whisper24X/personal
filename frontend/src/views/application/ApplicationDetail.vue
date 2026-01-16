<template>
  <div class="application-detail">
    <PageHeader
      :title="application?.name || '应用详情'"
      :description="application?.description"
      :back-handler="() => router.push('/applications')"
    />

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <ApplicationStats
        :application="application"
        @create-project="goToCreateProject"
      />

      <!-- 工作流管理卡片 -->
      <el-card class="workflow-card" shadow="hover">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Setting />
              </el-icon>
              工作流配置
            </span>
            <el-button type="primary" @click="goToWorkflowManagement">
              <el-icon>
                <Setting />
              </el-icon>
              管理工作流
            </el-button>
          </div>
        </template>
        <div class="workflow-desc">
          <p>配置和管理应用的工作流，定义角色和Action的执行顺序。不同应用可以使用不同的工作流配置。</p>
        </div>
      </el-card>

      <ProjectList
        :projects="projects"
        @project-click="viewProject"
        @knowledge-base="goToProjectKnowledgeBase"
        @empty-action="goToCreateProject"
        @command="handleProjectCommand"
      />

      <KnowledgeBaseSection
        :projects="projects"
        @project-click="goToProjectKnowledgeBase"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useApplicationStore } from '../../stores/application';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Setting } from '@element-plus/icons-vue';
import { apiClient } from '../../api/client';
import PageHeader from '../../components/common/PageHeader.vue';
import ApplicationStats from './components/ApplicationStats.vue';
import ProjectList from './components/ProjectList.vue';
import KnowledgeBaseSection from './components/KnowledgeBaseSection.vue';

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

function goToProjectKnowledgeBase(projectId: string) {
  router.push(`/project/${projectId}/knowledge-base`);
}

function goToWorkflowManagement() {
  const applicationId = route.params.id as string;
  router.push(`/application/${applicationId}/workflows`);
}

async function handleProjectCommand(command: { action: string; id: string }) {
  if (command.action === 'delete') {
    await deleteProject(command.id);
  } else if (command.action === 'view') {
    const project = projects.value.find(p => p.id === command.id);
    if (project) {
      viewProject(project);
    }
  }
}

async function deleteProject(projectId: string) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个项目吗？删除后无法恢复。',
      '删除项目',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    );

    await apiClient.deleteProject(projectId);
    ElMessage.success('项目已删除');
    await refreshData();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除项目失败');
    }
  }
}
</script>

<style scoped>
.application-detail {
  max-width: 100%;
}

.content-section {
  min-height: 400px;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.workflow-desc {
  color: #606266;
  line-height: 1.6;
}
</style>
