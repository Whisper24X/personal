<template>
  <div class="version-selector">
    <el-dropdown trigger="click" :disabled="loading" @command="handleVersionSelect">
      <el-button :loading="loading" class="version-button">
        <el-icon class="version-icon"><Collection /></el-icon>
        <span class="version-name">{{ displayVersion?.versionName || '无版本' }}</span>
        <el-icon class="el-icon--right"><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="version in versions"
            :key="version.id"
            :command="version.id"
            :class="{ 'is-active': version.id === currentVersionId }"
          >
            <div class="version-item">
              <el-icon v-if="version.id === currentVersionId" class="active-icon"><Check /></el-icon>
              <span class="version-item-name">{{ version.versionName }}</span>
              <el-tag v-if="version.id === currentVersionId" size="small" type="success">当前</el-tag>
            </div>
          </el-dropdown-item>
          <el-dropdown-item divided command="__create__">
            <el-icon><Plus /></el-icon>
            创建新版本
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 创建版本弹窗 -->
    <el-dialog v-model="showCreateDialog" title="创建新版本" width="450px" :close-on-click-modal="false" @close="resetCreateForm">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top" @submit.prevent="handleCreate">
        <el-form-item label="版本名称" prop="versionName" required>
          <el-input v-model="createForm.versionName" placeholder="例如: v1.0, v2.0" :prefix-icon="Edit" />
          <template #extra>
            <el-text type="info" size="small"> 将自动创建对应的 Git 分支 </el-text>
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
            <el-text type="info" size="small"> 请具体说明功能、目标用户和需求 </el-text>
          </template>
        </el-form-item>

        <el-form-item label="版本描述" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="描述此版本的主要变更..." />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false">取消</el-button>
          <el-button type="primary" :loading="createLoading" @click="handleCreate"> 创建 </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 版本审查对话框 -->
    <VersionReviewDialog v-model="showReviewDialog" :platform-id="platformId" :version-id="reviewVersionId" @completed="handleReviewCompleted" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { apiClient } from '../../../api/client';
import VersionReviewDialog from './VersionReviewDialog.vue';
import { Collection, ArrowDown, Check, Plus, Edit } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();

interface Version {
  id: string;
  projectId: string;
  versionName: string;
  description?: string;
  branchName: string;
  isActive: boolean;
  workspacePath?: string;
  createdAt: string;
  updatedAt?: string;
}

const props = defineProps<{
  platformId: string;
  applicationId?: string;
}>();

const emit = defineEmits<{
  (e: 'version-changed', version: Version | null): void;
}>();

const loading = ref(false);
const versions = ref<Version[]>([]);
const activeVersion = ref<Version | null>(null);

// 当前显示的版本：工作流页面使用路由参数，其他页面使用激活版本
const currentVersionId = computed(() => (route.params.versionId as string) || activeVersion.value?.id);
const displayVersion = computed(() => versions.value.find((v) => v.id === currentVersionId.value) || activeVersion.value);

// 检查当前是否在工作流页面
const isInWorkflowPage = computed(() => route.name === 'PlatformWorkflow');

const showCreateDialog = ref(false);
const createLoading = ref(false);
const createFormRef = ref<FormInstance>();

// 版本审查对话框
const showReviewDialog = ref(false);
const reviewVersionId = ref('');

const createForm = reactive({
  versionName: '',
  idea: '',
  description: '',
});

const createRules = reactive<FormRules>({
  versionName: [
    { required: true, message: '请输入版本名称', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9._-]+$/, message: '版本名称只能包含字母、数字、点、下划线和连字符', trigger: 'blur' },
    { max: 50, message: '版本名称不能超过50个字符', trigger: 'blur' },
  ],
  idea: [
    { required: true, message: '请描述版本想法/需求', trigger: 'blur' },
    { min: 10, message: '请提供更多细节（至少 10 个字符）', trigger: 'blur' },
  ],
});

// Watch for platformId changes
watch(
  () => props.platformId,
  (newId) => {
    if (newId) {
      fetchVersions();
    }
  },
  { immediate: true }
);

async function fetchVersions() {
  if (!props.platformId) return;

  loading.value = true;
  try {
    const response = (await apiClient.getPlatformVersions(props.platformId)) as any;
    versions.value = response.versions || [];
    activeVersion.value = versions.value.find((v: Version) => v.isActive) || null;
  } catch (error: any) {
    console.error('Failed to fetch versions:', error);
  } finally {
    loading.value = false;
  }
}

async function handleVersionSelect(command: string) {
  if (command === '__create__') {
    showCreateDialog.value = true;
    return;
  }

  // Find the selected version
  const selectedVersion = versions.value.find((v) => v.id === command);
  if (!selectedVersion) {
    return;
  }

  // 如果选择的是当前版本，不做任何操作
  if (command === currentVersionId.value) {
    return;
  }

  // 在工作流页面：通过路由切换版本
  if (isInWorkflowPage.value && props.applicationId) {
    router.replace(`/platform/workflow/${props.applicationId}/${props.platformId}/${command}`);
    emit('version-changed', selectedVersion);
    return;
  }

  // 其他页面：保持原有激活逻辑
  loading.value = true;
  try {
    await apiClient.activatePlatformVersion(props.platformId, command);
    ElMessage.success(`已切换到版本 ${selectedVersion.versionName}`);

    // Refresh versions
    await fetchVersions();

    // Emit change event
    emit('version-changed', activeVersion.value);
  } catch (error: any) {
    console.error('Failed to activate version:', error);
    ElMessage.error(error.message || '切换版本失败');
  } finally {
    loading.value = false;
  }
}

function resetCreateForm() {
  createForm.versionName = '';
  createForm.idea = '';
  createForm.description = '';
  createFormRef.value?.clearValidate();
}

function handleReviewCompleted() {
  ElMessage.success('版本审查已完成');
  // 可以在这里刷新版本列表或其他操作
}

async function handleCreate() {
  if (!createFormRef.value) return;

  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      createLoading.value = true;
      try {
        const response = (await apiClient.createPlatformVersion(props.platformId, {
          versionName: createForm.versionName,
          idea: createForm.idea,
          description: createForm.description || undefined,
        })) as { version?: { id: string } };

        console.log('Version created response:', response);

        ElMessage.success(`版本 ${createForm.versionName} 创建成功`);
        showCreateDialog.value = false;
        resetCreateForm();

        // Refresh versions
        await fetchVersions();

        // 自动启动版本审查
        const versionId = response?.version?.id;
        console.log('Version ID from response:', versionId);

        if (versionId) {
          // 立即显示弹框（显示"等待中"状态）
          reviewVersionId.value = versionId;
          console.log('Setting reviewVersionId to:', reviewVersionId.value);

          // 使用 nextTick 确保 versionId 已更新
          await nextTick();

          console.log('Setting showReviewDialog to true');
          showReviewDialog.value = true;
          console.log('showReviewDialog value:', showReviewDialog.value);

          // 然后调用审核启动接口
          try {
            console.log('Starting version review for version:', versionId);
            await apiClient.startVersionReview(props.platformId, versionId);
            console.log('Version review started successfully');
            // API 返回后，弹框会自动开始轮询（通过 watch 机制）
          } catch (reviewError: any) {
            // 如果启动失败，关闭弹框并显示错误
            console.error('Failed to start version review:', reviewError);
            console.error('Review error status:', reviewError.status);
            console.error('Review error message:', reviewError.message);
            console.error('Review error data:', reviewError);

            showReviewDialog.value = false;

            // 如果审查被禁用或缺少必要信息，显示相应的错误提示
            if (reviewError.status === 400) {
              ElMessage.warning('版本审查启动失败：' + (reviewError.message || '审查功能已禁用或缺少必要信息'));
            } else {
              ElMessage.error('版本审查启动失败：' + (reviewError.message || '未知错误'));
            }
          }
        } else {
          console.warn('No version ID in response, cannot start review');
        }

        // Emit change event for the new active version
        emit('version-changed', activeVersion.value);
      } catch (error: any) {
        console.error('Failed to create version:', error);
        if (error.status === 409) {
          ElMessage.error(error.message || '版本名称已存在');
        } else {
          ElMessage.error(error.message || '创建版本失败');
        }
      } finally {
        createLoading.value = false;
      }
    }
  });
}

// Expose refresh method for parent components
defineExpose({
  refresh: fetchVersions,
});

onMounted(() => {
  fetchVersions();
});
</script>

<style scoped>
.version-selector {
  display: inline-block;
}

.version-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  height: auto;
}

.version-icon {
  font-size: 16px;
}

.version-name {
  font-weight: 500;
}

.version-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 150px;
}

.version-item-name {
  flex: 1;
}

.active-icon {
  color: var(--el-color-success);
}

:deep(.el-dropdown-menu__item.is-active) {
  background-color: var(--el-color-success-light-9);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
