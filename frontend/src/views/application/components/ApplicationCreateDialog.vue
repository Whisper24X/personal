<template>
  <el-dialog
    v-model="visible"
    title="创建新应用"
    width="600px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="应用名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="我的应用"
          :prefix-icon="Edit"
        />
      </el-form-item>

      <el-form-item label="应用描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述这个应用的用途..."
          show-word-limit
          :maxlength="500"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { FormInstance, FormRules } from 'element-plus';
import { Edit } from '@element-plus/icons-vue';

interface Props {
  modelValue: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [data: { name: string; description: string }];
}>();

const visible = ref(props.modelValue);
const formRef = ref<FormInstance>();

const form = reactive({
  name: '',
  description: '',
});

const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入应用名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度应在 2 到 100 个字符之间', trigger: 'blur' }
  ],
});

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (!val) {
    resetForm();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

function handleClose() {
  visible.value = false;
  resetForm();
}

function resetForm() {
  form.name = '';
  form.description = '';
  formRef.value?.resetFields();
}

async function handleSubmit() {
  if (!formRef.value) return;

  await formRef.value.validate((valid) => {
    if (valid) {
      emit('submit', {
        name: form.name,
        description: form.description,
      });
    }
  });
}
</script>

