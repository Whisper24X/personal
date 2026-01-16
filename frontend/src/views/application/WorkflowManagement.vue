<template>
  <div class="workflow-management">
    <PageHeader
      :title="`${application?.name || '应用'} - 工作流管理`"
      description="配置和管理应用的工作流，定义角色和Action的执行顺序"
      :back-handler="() => router.push(`/applications/${applicationId}`)"
    />

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <!-- 工作流列表 -->
      <el-card class="workflows-card" shadow="hover">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <List />
              </el-icon>
              工作流列表
            </span>
            <el-button type="primary" @click="showCreateDialog = true">
              <el-icon>
                <Plus />
              </el-icon>
              创建工作流
            </el-button>
          </div>
        </template>

        <el-table :data="workflows" style="width: 100%" v-if="workflows.length > 0">
          <el-table-column prop="name" label="工作流名称" width="200" />
          <el-table-column prop="description" label="描述" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.is_default" type="success">默认</el-tag>
              <el-tag v-else>普通</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="角色" width="300">
            <template #default="{ row }">
              <div v-if="row.workflow_config?.roles && row.workflow_config.roles.length > 0">
                <el-tag
                  v-for="role in sortedWorkflowRoles(row.workflow_config.roles)"
                  :key="role.profile"
                  style="margin-right: 8px; margin-bottom: 4px"
                >
                  {{ getRoleDisplayName(role.profile) }}
                </el-tag>
              </div>
              <span v-else>无</span>
            </template>
          </el-table-column>
          <el-table-column label="角色数量" width="120">
            <template #default="{ row }">
              {{ row.workflow_config?.roles?.length || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                @click="viewWorkflow(row)"
                :icon="View"
              >
                查看
              </el-button>
              <el-button
                type="success"
                size="small"
                @click="editWorkflow(row)"
                :icon="Edit"
              >
                编辑
              </el-button>
              <el-button
                v-if="!row.is_default"
                type="warning"
                size="small"
                @click="setAsDefault(row.id)"
                :icon="Star"
              >
                设为默认
              </el-button>
              <el-button
                v-if="!row.is_default"
                type="danger"
                size="small"
                @click="deleteWorkflow(row.id)"
                :icon="Delete"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="暂无工作流，请创建工作流" />
      </el-card>
    </div>

    <!-- 创建工作流对话框 -->
    <WorkflowDialog
      v-model="showCreateDialog"
      :application-id="applicationId"
      @success="handleWorkflowCreated"
    />

    <!-- 编辑工作流对话框 -->
    <WorkflowDialog
      v-model="showEditDialog"
      :application-id="applicationId"
      :workflow="editingWorkflow"
      @success="handleWorkflowUpdated"
    />

    <!-- 查看工作流对话框 -->
    <WorkflowViewDialog
      v-model="showViewDialog"
      :workflow="viewingWorkflow"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, List, View, Edit, Delete, Star } from '@element-plus/icons-vue';
import { apiClient } from '../../api/client';
import PageHeader from '../../components/common/PageHeader.vue';
import WorkflowDialog from './components/WorkflowDialog.vue';
import WorkflowViewDialog from './components/WorkflowViewDialog.vue';
import { useApplicationStore } from '../../stores/application';
import { useRoleActionStore } from '../../stores/roleAction';
import { storeToRefs } from 'pinia';

const router = useRouter();
const route = useRoute();
const applicationStore = useApplicationStore();
const roleActionStore = useRoleActionStore();
const { currentApplication } = storeToRefs(applicationStore);

const applicationId = computed(() => route.params.id as string);
const application = computed(() => currentApplication.value);

const loading = ref(false);
const error = ref<string | null>(null);
const workflows = ref<any[]>([]);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const showViewDialog = ref(false);
const editingWorkflow = ref<any>(null);
const viewingWorkflow = ref<any>(null);

async function fetchWorkflows() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getApplicationWorkflows(applicationId.value) as any;
    workflows.value = response.workflows || [];
  } catch (err: any) {
    error.value = err.message || '获取工作流列表失败';
    ElMessage.error(error.value);
  } finally {
    loading.value = false;
  }
}

async function fetchApplication() {
  try {
    await applicationStore.fetchApplication(applicationId.value);
  } catch (err: any) {
    ElMessage.error('获取应用信息失败');
  }
}

function viewWorkflow(workflow: any) {
  viewingWorkflow.value = workflow;
  showViewDialog.value = true;
}

function editWorkflow(workflow: any) {
  editingWorkflow.value = workflow;
  showEditDialog.value = true;
}

async function setAsDefault(workflowId: string) {
  try {
    await ElMessageBox.confirm('确定要将此工作流设为默认吗？', '确认', {
      type: 'warning',
    });
    await apiClient.setDefaultWorkflow(applicationId.value, workflowId);
    ElMessage.success('设置默认工作流成功');
    await fetchWorkflows();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '设置默认工作流失败');
    }
  }
}

async function deleteWorkflow(workflowId: string) {
  try {
    await ElMessageBox.confirm('确定要删除此工作流吗？删除后无法恢复。', '确认删除', {
      type: 'warning',
    });
    await apiClient.deleteWorkflow(applicationId.value, workflowId);
    ElMessage.success('删除工作流成功');
    await fetchWorkflows();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除工作流失败');
    }
  }
}

function handleWorkflowCreated() {
  showCreateDialog.value = false;
  fetchWorkflows();
}

function handleWorkflowUpdated() {
  showEditDialog.value = false;
  editingWorkflow.value = null;
  fetchWorkflows();
}

function sortedWorkflowRoles(roles: any[]) {
  if (!roles || !Array.isArray(roles)) return [];
  return [...roles].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function getRoleDisplayName(profile: string): string {
  const role = roleActionStore.roles.find((r) => r.profile === profile);
  return role?.displayName || profile;
}

onMounted(async () => {
  await fetchApplication();
  await fetchWorkflows();
  await roleActionStore.fetchRolesAndActions();
});
</script>

<style scoped>
.workflow-management {
  padding: 20px;
}

.content-section {
  margin-top: 20px;
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

.workflows-card {
  margin-top: 20px;
}
</style>
