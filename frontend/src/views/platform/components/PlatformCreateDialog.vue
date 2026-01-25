<template>
  <el-dialog
    v-model="visible"
    title="创建平台"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      size="large"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="平台名称" prop="name" required>
        <el-input
          v-model="formData.name"
          placeholder="我的平台"
          :prefix-icon="Edit"
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
        <template #extra>
          <el-text type="info" size="small">
            <el-icon><Refresh /></el-icon>
            执行迭代次数
          </el-text>
        </template>
      </el-form-item>

      <el-form-item label="Git 仓库地址" prop="gitRepoUrl">
        <el-input
          v-model="formData.gitRepoUrl"
          placeholder="https://github.com/user/repo.git"
          :prefix-icon="Link"
          clearable
        />
        <template #extra>
          <el-text type="info" size="small">
            <el-icon><InfoFilled /></el-icon>
            可选，关联代码仓库用于版本管理
          </el-text>
        </template>
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
          :icon="MagicStick"
          @click="handleSubmit"
        >
          {{ loading ? '创建中...' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePlatformStore } from '../../../stores/platform';
import { storeToRefs } from 'pinia';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { 
  Edit, 
  InfoFilled, 
  Refresh, 
  MagicStick,
  Link
} from '@element-plus/icons-vue';

const router = useRouter();

const props = defineProps<{
  modelValue: boolean;
  businessLineId: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const visible = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    resetForm();
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
  description: '',
  nRound: 5,
  gitRepoUrl: '',
});

const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入平台名称', trigger: 'blur' },
    { min: 3, max: 100, message: '长度应在 3 到 100 个字符之间', trigger: 'blur' }
  ],
  gitRepoUrl: [
    { 
      pattern: /^(https?:\/\/)?([\w.-]+)(\/[\w.-]*)*\.git$|^git@[\w.-]+:[\w./-]+\.git$|^$/,
      message: '请输入有效的 Git 仓库地址',
      trigger: 'blur'
    }
  ],
});

function resetForm() {
  formData.name = '';
  formData.description = '';
  formData.nRound = 5;
  formData.gitRepoUrl = '';
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
        const platform = await platformStore.createPlatform({
          name: formData.name,
          description: formData.description || undefined,
          nRound: formData.nRound,
          businessLineId: props.businessLineId,
          gitRepoUrl: formData.gitRepoUrl || undefined,
        });
        
        ElMessage.success('平台创建成功！请先创建版本。');
        emit('created');
        handleClose();
        
        // 跳转到版本管理页面
        if (platform?.id) {
          router.push(`/platform/${platform.id}/versions`);
        }
      } catch (err: any) {
        console.error('Failed to create platform:', err);
        if (err.status === 409 || err.error === 'Duplicate project name') {
          ElMessage.error(err.message || '平台名称已存在，请使用不同的名称');
        } else {
          ElMessage.error(err.message || '创建平台失败');
        }
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
