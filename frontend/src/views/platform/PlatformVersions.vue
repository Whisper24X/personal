<template>
  <div class="platform-versions">
    <!-- Loading state -->
    <div v-if="loading && !platform" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- Error state -->
    <div v-else-if="error && !platform" class="error-state">
      <el-result
        icon="error"
        title="加载失败"
        :sub-title="error"
      >
        <template #extra>
          <el-button type="primary" @click="handleBack">返回平台列表</el-button>
        </template>
      </el-result>
    </div>

    <!-- Content -->
    <div v-else-if="platform" class="content">
      <PageHeader
        :title="platform.name"
        description="版本管理"
        :back-handler="handleBack"
      >
        <template #extra>
          <div class="platform-meta">
            <el-tag v-if="platform.gitRepoUrl" type="info">
              <el-icon><Link /></el-icon>
              {{ platform.gitRepoUrl }}
            </el-tag>
            <el-tag v-else type="warning">未配置 Git 仓库</el-tag>
          </div>
        </template>
        <template #right>
          <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
            创建版本
          </el-button>
        </template>
      </PageHeader>

      <!-- Empty state -->
      <el-empty 
        v-if="versions.length === 0 && !loading" 
        description="暂无版本，请创建第一个版本"
      >
        <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
          创建版本
        </el-button>
      </el-empty>

      <!-- Table toolbar -->
      <template v-else>
        <div class="table-toolbar">
          <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
            新增版本
          </el-button>
        </div>

        <!-- Version table -->
        <el-table
          :data="versions"
          stripe
          style="width: 100%"
        >
        <el-table-column prop="versionName" label="版本名称" min-width="200">
          <template #default="{ row }">
            <el-icon style="margin-right: 8px; vertical-align: middle;">
              <Collection />
            </el-icon>
            <span>{{ row.versionName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="isActive" label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isActive" type="success" size="small">当前激活</el-tag>
            <span v-else style="color: var(--el-text-color-placeholder)">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="idea" label="想法" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.idea || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="progress" label="进度" width="100" align="center">
          <template #default="{ row }">
            {{ row.progress || 0 }}%
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="branchName" label="分支名" min-width="200">
          <template #default="{ row }">
            <el-text type="info" size="small">{{ row.branchName }}</el-text>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="250" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button 
                v-if="!row.isActive" 
                size="small" 
                @click="activateVersion(row)"
              >
                <el-icon><Check /></el-icon>
                设为当前版本
              </el-button>
              <el-button 
                type="primary" 
                size="small" 
                @click="enterWorkflow(row)"
              >
                <el-icon><VideoPlay /></el-icon>
                进入工作流
              </el-button>
              <el-button 
                type="danger" 
                plain 
                size="small" 
                @click="deleteVersion(row)"
              >
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </template>
    </div>

    <!-- Create version dialog -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建新版本"
      width="450px"
      :close-on-click-modal="false"
      @close="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-position="top"
        @submit.prevent="handleCreate"
      >
        <el-form-item label="版本名称" prop="versionName" required>
          <el-input
            v-model="createForm.versionName"
            placeholder="例如: v1.0, v2.0"
            :prefix-icon="Edit"
          />
          <template #extra>
            <el-text type="info" size="small">
              将自动创建对应的 Git 分支
            </el-text>
          </template>
        </el-form-item>

        <el-form-item label="版本想法" prop="idea" required>
          <el-input
            v-model="createForm.idea"
            type="textarea"
            :rows="5"
            placeholder="详细描述此版本的需求和想法..."
            show-word-limit
            :maxlength="2000"
          />
          <template #extra>
            <el-text type="info" size="small">
              请具体说明功能、目标用户和需求
            </el-text>
          </template>
        </el-form-item>

        <el-form-item label="版本描述" prop="description">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="描述此版本的主要变更..."
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false">取消</el-button>
          <el-button
            type="primary"
            :loading="createLoading"
            @click="handleCreate"
          >
            创建
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { apiClient } from '../../api/client';
import PageHeader from '../../components/common/PageHeader.vue';
import {
  Plus,
  Collection,
  VideoPlay,
  Check,
  Delete,
  Link,
  Edit,
} from '@element-plus/icons-vue';

interface Version {
  id: string;
  projectId: string;
  versionName: string;
  description?: string;
  idea?: string;
  progress?: number;
  branchName: string;
  isActive: boolean;
  workspacePath?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Platform {
  id: string;
  name: string;
  idea?: string;
  gitRepoUrl?: string;
  applicationId?: string;
}

const route = useRoute();
const router = useRouter();

const platformId = route.params.id as string;

const loading = ref(false);
const error = ref<string | null>(null);
const platform = ref<Platform | null>(null);
const versions = ref<Version[]>([]);

const showCreateDialog = ref(false);
const createLoading = ref(false);
const createFormRef = ref<FormInstance>();

const createForm = reactive({
  versionName: '',
  idea: '',
  description: '',
});

const createRules = reactive<FormRules>({
  versionName: [
    { required: true, message: '请输入版本名称', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9._-]+$/, message: '版本名称只能包含字母、数字、点、下划线和连字符', trigger: 'blur' },
    { max: 50, message: '版本名称不能超过50个字符', trigger: 'blur' }
  ],
  idea: [
    { required: true, message: '请描述版本想法/需求', trigger: 'blur' },
    { min: 10, message: '请提供更多细节（至少 10 个字符）', trigger: 'blur' }
  ],
});

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  error.value = null;
  
  try {
    // Load platform info
    const platformResponse = await apiClient.getPlatform(platformId) as any;
    platform.value = platformResponse.project || platformResponse;
    
    // Load versions
    await fetchVersions();
  } catch (err: any) {
    console.error('Failed to load data:', err);
    error.value = err.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function fetchVersions() {
  try {
    const response = await apiClient.getPlatformVersions(platformId) as any;
    versions.value = response.versions || [];
  } catch (err: any) {
    console.error('Failed to fetch versions:', err);
    // Don't set error here, just log it
  }
}

function handleBack() {
  if (platform.value?.applicationId) {
    router.push(`/business-line/${platform.value.applicationId}/platforms`);
  } else {
    router.push('/business-lines');
  }
}


async function activateVersion(version: Version) {
  try {
    await apiClient.activatePlatformVersion(platformId, version.id);
    ElMessage.success(`已切换到版本 ${version.versionName}`);
    await fetchVersions();
  } catch (err: any) {
    console.error('Failed to activate version:', err);
    ElMessage.error(err.message || '切换版本失败');
  }
}

async function deleteVersion(version: Version) {
  if (version.isActive) {
    ElMessage.warning('无法删除当前激活的版本');
    return;
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除版本 "${version.versionName}" 吗？此操作不可恢复。`,
      '删除版本',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    await apiClient.deletePlatformVersion(platformId, version.id);
    ElMessage.success(`版本 ${version.versionName} 已删除`);
    await fetchVersions();
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error('Failed to delete version:', err);
      ElMessage.error(err.message || '删除版本失败');
    }
  }
}

function enterWorkflow(version: Version) {
  // 直接导航到带版本ID的路由，不再激活版本
  router.push(`/platform/${platformId}/workflow/${version.id}`);
}

function resetCreateForm() {
  createForm.versionName = '';
  createForm.idea = '';
  createForm.description = '';
  createFormRef.value?.clearValidate();
}

async function handleCreate() {
  if (!createFormRef.value) return;

  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      createLoading.value = true;
      try {
        await apiClient.createPlatformVersion(platformId, {
          versionName: createForm.versionName,
          idea: createForm.idea,
          description: createForm.description || undefined,
        });
        
        ElMessage.success(`版本 ${createForm.versionName} 创建成功`);
        showCreateDialog.value = false;
        resetCreateForm();
        
        // Refresh versions
        await fetchVersions();
      } catch (err: any) {
        console.error('Failed to create version:', err);
        if (err.status === 409) {
          ElMessage.error(err.message || '版本名称已存在');
        } else {
          ElMessage.error(err.message || '创建版本失败');
        }
      } finally {
        createLoading.value = false;
      }
    }
  });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}
</script>

<style scoped>
.platform-versions {
  max-width: 100%;
}

.loading-state,
.error-state {
  padding: 40px 20px;
}

.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.content {
  display: flex;
  flex-direction: column;
}

.platform-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.platform-meta .el-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
