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

      <!-- Version cards -->
      <div v-else class="version-grid">
        <el-card
          v-for="version in versions"
          :key="version.id"
          class="version-card"
          :class="{ 'is-active': version.isActive }"
          shadow="hover"
        >
          <template #header>
            <div class="card-header">
              <div class="version-title">
                <el-icon class="version-icon"><Collection /></el-icon>
                <span class="version-name">{{ version.versionName }}</span>
                <el-tag v-if="version.isActive" size="small" type="success">当前激活</el-tag>
              </div>
              <el-dropdown trigger="click" @command="(cmd: string) => handleVersionAction(cmd, version)">
                <el-button :icon="MoreFilled" text />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item 
                      v-if="!version.isActive" 
                      command="activate"
                    >
                      <el-icon><Check /></el-icon>
                      设为当前版本
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <el-icon><Delete /></el-icon>
                      删除版本
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>

          <div class="card-body">
            <p v-if="version.description" class="version-desc">{{ version.description }}</p>
            <p v-else class="version-desc empty">暂无描述</p>
            
            <el-descriptions :column="1" size="small" class="version-info">
              <el-descriptions-item label="分支名">
                <el-text type="info" size="small">{{ version.branchName }}</el-text>
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                <el-text type="info" size="small">{{ formatDate(version.createdAt) }}</el-text>
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <template #footer>
            <el-button 
              type="primary" 
              :icon="VideoPlay"
              @click="enterWorkflow(version)"
            >
              进入工作流
            </el-button>
          </template>
        </el-card>
      </div>
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
import { usePlatformStore } from '../../stores/platform';
import PageHeader from '../../components/common/PageHeader.vue';
import {
  Plus,
  Collection,
  VideoPlay,
  MoreFilled,
  Check,
  Delete,
  Edit,
  Link,
  InfoFilled
} from '@element-plus/icons-vue';

interface Version {
  id: string;
  projectId: string;
  versionName: string;
  description?: string;
  idea?: string;
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
const platformStore = usePlatformStore();

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

async function handleVersionAction(command: string, version: Version) {
  if (command === 'activate') {
    await activateVersion(version);
  } else if (command === 'delete') {
    await deleteVersion(version);
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
  // Set active version in store before navigating
  platformStore.setActiveVersion(version);
  
  // If not active, activate it first
  if (!version.isActive) {
    apiClient.activatePlatformVersion(platformId, version.id)
      .then(() => {
        router.push(`/platform/${platformId}/workflow`);
      })
      .catch((err: any) => {
        console.error('Failed to activate version:', err);
        // Still navigate even if activation fails
        router.push(`/platform/${platformId}/workflow`);
      });
  } else {
    router.push(`/platform/${platformId}/workflow`);
  }
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

.version-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.version-card {
  transition: all 0.3s ease;
}

.version-card.is-active {
  border-color: var(--el-color-success);
}

.version-card :deep(.el-card__header) {
  padding: 16px 20px;
}

.version-card :deep(.el-card__body) {
  padding: 16px 20px;
}

.version-card :deep(.el-card__footer) {
  padding: 12px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.version-name {
  font-size: 16px;
  font-weight: 600;
}

.card-body {
  min-height: 100px;
}

.version-desc {
  color: var(--el-text-color-regular);
  margin: 0 0 12px 0;
  line-height: 1.6;
}

.version-desc.empty {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.version-info {
  margin-top: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
