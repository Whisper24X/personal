<template>
  <el-dialog
    v-model="visible"
    title="编辑业务线"
    width="500px"
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
      <el-form-item label="业务线名称" prop="name" required>
        <el-input
          v-model="formData.name"
          placeholder="请输入业务线名称"
          :prefix-icon="Edit"
        />
      </el-form-item>

      <el-form-item label="业务线描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="4"
          placeholder="请输入业务线描述..."
          show-word-limit
          :maxlength="500"
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
import { useBusinessLineStore } from '../../../stores/businessLine';
import { storeToRefs } from 'pinia';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { Edit, Check } from '@element-plus/icons-vue';

const props = defineProps<{
  modelValue: boolean;
  businessLineId: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'updated'): void;
}>();

const visible = ref(props.modelValue);
const pageLoading = ref(false);

watch(() => props.modelValue, async (val) => {
  visible.value = val;
  if (val && props.businessLineId) {
    await loadBusinessLine();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const businessLineStore = useBusinessLineStore();
const { loading, error } = storeToRefs(businessLineStore);

const formRef = ref<FormInstance>();

const formData = reactive({
  name: '',
  description: '',
});

const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入业务线名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度应在 2 到 100 个字符之间', trigger: 'blur' }
  ],
});

async function loadBusinessLine() {
  pageLoading.value = true;
  try {
    const businessLine = await businessLineStore.fetchBusinessLine(props.businessLineId);
    if (businessLine) {
      formData.name = businessLine.name || '';
      formData.description = businessLine.description || '';
    }
  } catch (err: any) {
    ElMessage.error('获取业务线信息失败');
  } finally {
    pageLoading.value = false;
  }
}

function resetForm() {
  formData.name = '';
  formData.description = '';
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
        await businessLineStore.updateBusinessLine(props.businessLineId, {
          name: formData.name,
          description: formData.description || undefined,
        });
        
        ElMessage.success('业务线更新成功！');
        emit('updated');
        handleClose();
      } catch (err: any) {
        ElMessage.error(err.message || '更新业务线失败');
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
