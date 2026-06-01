<template>
  <el-dialog
    v-model="visible"
    title="配置 CLI API Key"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      v-loading="pageLoading"
      :model="formData"
      :rules="rules"
      label-position="top"
      size="large"
      @submit.prevent="handleSubmit"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="info-alert"
      >
        <template #title>
          <div>
            <p>CLI API Key 将用于该平台所有版本的 CLI 操作。</p>
            <p style="margin-top: 8px; font-size: 12px;">
              如果未配置，将使用系统环境变量中的 CURSOR_API_KEY。
            </p>
          </div>
        </template>
      </el-alert>

      <el-form-item label="CLI API Key" prop="apiKey">
        <el-input
          v-model="formData.apiKey"
          type="password"
          :show-password="true"
          placeholder="请输入 CLI API Key（留空则清除配置）"
          :prefix-icon="Key"
        >
          <template #suffix>
            <el-button
              link
              type="primary"
              @click="toggleShowPassword"
            >
              <el-icon>
                <View v-if="showPassword" />
                <Hide v-else />
              </el-icon>
            </el-button>
          </template>
        </el-input>
        <template #extra>
          <el-text type="info" size="small">
            输入 API Key 后，该平台的所有版本在执行 CLI 操作时将优先使用此 Key
          </el-text>
        </template>
      </el-form-item>

      <el-form-item v-if="currentApiKeyStatus" label="当前状态">
        <el-tag :type="currentApiKeyStatus.hasApiKey ? 'success' : 'info'">
          {{ currentApiKeyStatus.hasApiKey ? `已配置 (${currentApiKeyStatus.maskedKey})` : '未配置' }}
        </el-tag>
      </el-form-item>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
        class="error-alert"
      />
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClear" :disabled="!currentApiKeyStatus?.hasApiKey">
          清除配置
        </el-button>
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="loading"
          :icon="Check"
          @click="handleSubmit"
        >
          {{ loading ? '保存中...' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { apiClient } from '../../../api/client';
import { Key, Check, View, Hide } from '@element-plus/icons-vue';

const props = defineProps<{
  modelValue: boolean;
  platformId: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'updated'): void;
}>();

const visible = ref(props.modelValue);
const pageLoading = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const showPassword = ref(false);

interface ApiKeyStatus {
  hasApiKey: boolean;
  maskedKey: string | null;
}

const currentApiKeyStatus = ref<ApiKeyStatus | null>(null);

watch(() => props.modelValue, async (val) => {
  visible.value = val;
  if (val && props.platformId) {
    await loadApiKeyStatus();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const formRef = ref<FormInstance>();

const formData = reactive({
  apiKey: '',
});

const rules = reactive<FormRules>({
  apiKey: [
    // Optional field, no required validation
  ],
});

async function loadApiKeyStatus() {
  pageLoading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getPlatformCliApiKey(props.platformId) as any;
    currentApiKeyStatus.value = {
      hasApiKey: response.hasApiKey || false,
      maskedKey: response.maskedKey || null,
    };
    // Don't populate the form with the actual key for security
    formData.apiKey = '';
  } catch (err: any) {
    console.error('Failed to load API key status:', err);
    error.value = err.message || '获取 API Key 状态失败';
  } finally {
    pageLoading.value = false;
  }
}

function toggleShowPassword() {
  showPassword.value = !showPassword.value;
}

function resetForm() {
  formData.apiKey = '';
  error.value = null;
  formRef.value?.clearValidate();
}

function handleClose() {
  visible.value = false;
  resetForm();
}

async function handleSubmit() {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      error.value = null;
      try {
        const apiKey = formData.apiKey.trim() || null;
        await apiClient.updatePlatformCliApiKey(props.platformId, apiKey);
        ElMessage.success(apiKey ? 'CLI API Key 配置成功' : 'CLI API Key 已清除');
        emit('updated');
        await loadApiKeyStatus();
        resetForm();
        handleClose();
      } catch (err: any) {
        console.error('Failed to update API key:', err);
        error.value = err.message || '更新 API Key 失败';
      } finally {
        loading.value = false;
      }
    }
  });
}

async function handleClear() {
  loading.value = true;
  error.value = null;
  try {
    await apiClient.updatePlatformCliApiKey(props.platformId, null);
    ElMessage.success('CLI API Key 已清除');
    emit('updated');
    await loadApiKeyStatus();
    resetForm();
    handleClose();
  } catch (err: any) {
    console.error('Failed to clear API key:', err);
    error.value = err.message || '清除 API Key 失败';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.info-alert {
  margin-bottom: 20px;
}

.error-alert {
  margin-top: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
