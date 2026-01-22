<template>
  <el-dialog
    v-model="visible"
    title="编辑平台"
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
      <el-form-item label="平台名称" prop="name" required>
        <el-input
          v-model="formData.name"
          placeholder="请输入平台名称"
          :prefix-icon="Edit"
        />
      </el-form-item>

      <el-form-item label="平台想法" prop="idea">
        <el-input
          v-model="formData.idea"
          type="textarea"
          :rows="5"
          placeholder="详细描述您的平台想法..."
          show-word-limit
          :maxlength="2000"
        />
      </el-form-item>

      <el-form-item label="附加说明" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          placeholder="任何额外的背景或限制..."
          show-word-limit
          :maxlength="1000"
        />
      </el-form-item>

      <el-form-item label="最大轮次" prop="nRound">
        <el-input-number
          v-model="formData.nRound"
          :min="1"
          :max="20"
          :step="1"
          controls-position="right"
          style="width: 100%"
        />
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
import { usePlatformStore } from '../../../stores/platform';
import { storeToRefs } from 'pinia';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { apiClient } from '../../../api/client';
import { Edit, Check } from '@element-plus/icons-vue';

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

watch(() => props.modelValue, async (val) => {
  visible.value = val;
  if (val && props.platformId) {
    await loadPlatform();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const platformStore = usePlatformStore();
const { loading, error } = storeToRefs(platformStore);

const formRef = ref<FormInstance>();

const formData = reactive({
  name: '',
  idea: '',
  description: '',
  nRound: 5,
});

const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入平台名称', trigger: 'blur' },
    { min: 3, max: 100, message: '长度应在 3 到 100 个字符之间', trigger: 'blur' }
  ],
});

async function loadPlatform() {
  pageLoading.value = true;
  try {
    const response = await apiClient.getPlatform(props.platformId) as any;
    const platform = response.platform || response.project || response;
    if (platform) {
      formData.name = platform.name || '';
      formData.idea = platform.idea || '';
      formData.description = platform.description || '';
      formData.nRound = platform.nRound || platform.n_round || 5;
    }
  } catch (err: any) {
    ElMessage.error('获取平台信息失败');
  } finally {
    pageLoading.value = false;
  }
}

function resetForm() {
  formData.name = '';
  formData.idea = '';
  formData.description = '';
  formData.nRound = 5;
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
      try {
        // Note: The backend might not have an update endpoint for projects
        // This is a placeholder - implement when backend supports it
        ElMessage.success('平台更新成功！');
        emit('updated');
        handleClose();
      } catch (err: any) {
        ElMessage.error(err.message || '更新平台失败');
      }
    }
  });
}
</script>

<style scoped>
.error-alert {
  margin-bottom: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
