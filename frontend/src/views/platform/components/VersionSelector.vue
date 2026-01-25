<template>
  <div class="version-selector">
    <el-dropdown
      trigger="click"
      @command="handleVersionSelect"
      :disabled="loading"
    >
      <el-button :loading="loading" class="version-button">
        <el-icon class="version-icon"><Collection /></el-icon>
        <span class="version-name">{{ activeVersion?.versionName || '无版本' }}</span>
        <el-icon class="el-icon--right"><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="version in versions"
            :key="version.id"
            :command="version.id"
            :class="{ 'is-active': version.isActive }"
          >
            <div class="version-item">
              <el-icon v-if="version.isActive" class="active-icon"><Check /></el-icon>
              <span class="version-item-name">{{ version.versionName }}</span>
              <el-tag v-if="version.isActive" size="small" type="success">当前</el-tag>
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
import { ref, reactive, onMounted, watch } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { apiClient } from '../../../api/client';
import { usePlatformStore } from '../../../stores/platform';
import { 
  Collection, 
  ArrowDown, 
  Check, 
  Plus,
  Edit
} from '@element-plus/icons-vue';

const platformStore = usePlatformStore();

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
}>();

const emit = defineEmits<{
  (e: 'version-changed', version: Version | null): void;
}>();

const loading = ref(false);
const versions = ref<Version[]>([]);
const activeVersion = ref<Version | null>(null);

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

// Watch for platformId changes
watch(() => props.platformId, (newId) => {
  if (newId) {
    fetchVersions();
  }
}, { immediate: true });

async function fetchVersions() {
  if (!props.platformId) return;

  loading.value = true;
  try {
    const response = await apiClient.getPlatformVersions(props.platformId) as any;
    versions.value = response.versions || [];
    activeVersion.value = versions.value.find((v: Version) => v.isActive) || null;
    
    // Sync with store
    platformStore.setActiveVersion(activeVersion.value);
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
  const selectedVersion = versions.value.find(v => v.id === command);
  if (!selectedVersion || selectedVersion.isActive) {
    return;
  }

  // Activate the version
  loading.value = true;
  try {
    await apiClient.activatePlatformVersion(props.platformId, command);
    ElMessage.success(`已切换到版本 ${selectedVersion.versionName}`);
    
    // Refresh versions (this also updates the store)
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

async function handleCreate() {
  if (!createFormRef.value) return;

  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      createLoading.value = true;
      try {
        await apiClient.createPlatformVersion(props.platformId, {
          versionName: createForm.versionName,
          idea: createForm.idea,
          description: createForm.description || undefined,
        });
        
        ElMessage.success(`版本 ${createForm.versionName} 创建成功`);
        showCreateDialog.value = false;
        resetCreateForm();
        
        // Refresh versions
        await fetchVersions();
        
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
