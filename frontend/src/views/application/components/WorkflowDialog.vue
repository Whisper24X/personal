<template>
  <el-dialog
    v-model="dialogVisible"
    :title="workflow ? '编辑工作流' : '创建工作流'"
    width="80%"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="left"
    >
      <el-form-item label="工作流名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入工作流名称" />
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="请输入工作流描述"
        />
      </el-form-item>

      <el-form-item label="设为默认" prop="isDefault">
        <el-switch v-model="form.isDefault" />
      </el-form-item>

      <el-form-item label="角色配置" prop="workflowConfig">
        <div class="roles-config">
          <div
            v-for="(role, index) in form.workflowConfig.roles"
            :key="index"
            class="role-item"
          >
            <el-card shadow="hover">
              <template #header>
                <div class="role-header">
                  <span>角色 {{ index + 1 }}</span>
                  <el-button
                    type="danger"
                    size="small"
                    :icon="Delete"
                    @click="removeRole(index)"
                  >
                    删除
                  </el-button>
                </div>
              </template>

              <el-form-item
                :label="`角色类型`"
                :prop="`workflowConfig.roles.${index}.profile`"
                :rules="{ required: true, message: '请选择角色类型', trigger: 'change' }"
              >
                <el-select
                  v-model="role.profile"
                  placeholder="选择角色类型"
                  style="width: 100%"
                  @change="onRoleChange(index)"
                >
                  <el-option
                    v-for="r in availableRoles"
                    :key="r.profile"
                    :label="r.displayName || r.profile"
                    :value="r.profile"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="角色名称（可选）">
                <el-input v-model="role.name" placeholder="留空则使用默认名称" />
              </el-form-item>

              <el-form-item
                label="执行顺序"
                :prop="`workflowConfig.roles.${index}.order`"
                :rules="{ required: true, message: '请输入执行顺序', trigger: 'blur' }"
              >
                <el-input-number
                  v-model="role.order"
                  :min="0"
                  :max="100"
                  style="width: 100%"
                />
              </el-form-item>

              <el-form-item
                label="可用Actions"
                :prop="`workflowConfig.roles.${index}.actions`"
                :rules="{ required: true, message: '请选择至少一个Action', trigger: 'change' }"
              >
                <el-select
                  v-model="role.actions"
                  multiple
                  placeholder="选择Actions"
                  style="width: 100%"
                >
                  <el-option
                    v-for="action in availableActions"
                    :key="action.name"
                    :label="action.displayName || action.name"
                    :value="action.name"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="监听Actions（可选）">
                <el-select
                  v-model="role.watch_actions"
                  multiple
                  placeholder="选择要监听的Actions"
                  style="width: 100%"
                >
                  <el-option
                    v-for="action in availableActions"
                    :key="action.name"
                    :label="action.displayName || action.name"
                    :value="action.name"
                  />
                </el-select>
              </el-form-item>
            </el-card>
          </div>

          <el-button
            type="primary"
            :icon="Plus"
            @click="addRole"
            style="width: 100%; margin-top: 20px"
          >
            添加角色
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        {{ workflow ? '更新' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElForm } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import { apiClient } from '../../../api/client';
import { useRoleActionStore } from '../../../stores/roleAction';

interface Props {
  modelValue: boolean;
  applicationId: string;
  workflow?: any;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const roleActionStore = useRoleActionStore();
const formRef = ref<InstanceType<typeof ElForm>>();
const submitting = ref(false);

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const form = ref({
  name: '',
  description: '',
  isDefault: false,
  workflowConfig: {
    roles: [] as Array<{
      profile: string;
      name?: string;
      order: number;
      actions: string[];
      watch_actions?: string[];
      config?: Record<string, any>;
    }>,
  },
});

const rules = {
  name: [{ required: true, message: '请输入工作流名称', trigger: 'blur' }],
  workflowConfig: [
    {
      validator: (_rule: any, value: any, callback: any) => {
        if (!value.roles || value.roles.length === 0) {
          callback(new Error('至少需要配置一个角色'));
        } else {
          callback();
        }
      },
      trigger: 'change',
    },
  ],
};

const availableRoles = computed(() => roleActionStore.roles);
const availableActions = computed(() => roleActionStore.actions);

function addRole() {
  form.value.workflowConfig.roles.push({
    profile: '',
    order: form.value.workflowConfig.roles.length,
    actions: [],
    watch_actions: [],
  });
}

function removeRole(index: number) {
  form.value.workflowConfig.roles.splice(index, 1);
  // 重新排序
  form.value.workflowConfig.roles.forEach((role, idx) => {
    role.order = idx;
  });
}

function onRoleChange(index: number) {
  const role = form.value.workflowConfig.roles[index];
  // 可以根据角色类型设置默认的actions
  // 这里可以根据需要实现
}

async function handleSubmit() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    submitting.value = true;
    try {
      if (props.workflow) {
        await apiClient.updateWorkflow(props.applicationId, props.workflow.id, form.value);
        ElMessage.success('更新工作流成功');
      } else {
        await apiClient.createWorkflow(props.applicationId, form.value);
        ElMessage.success('创建工作流成功');
      }
      emit('success');
      handleClose();
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败');
    } finally {
      submitting.value = false;
    }
  });
}

function handleClose() {
  dialogVisible.value = false;
  formRef.value?.resetFields();
  form.value = {
    name: '',
    description: '',
    isDefault: false,
    workflowConfig: {
      roles: [],
    },
  };
}

function initForm() {
  if (props.workflow && props.workflow.workflow_config) {
    // 深拷贝工作流配置，确保 watch_actions 字段被正确初始化
    const roles = (props.workflow.workflow_config.roles || []).map((role: any) => ({
      profile: role.profile || '',
      name: role.name || '',
      order: typeof role.order === 'number' ? role.order : 0,
      actions: Array.isArray(role.actions) ? [...role.actions] : [],
      watch_actions: Array.isArray(role.watch_actions) ? [...role.watch_actions] : [],
      config: role.config || {},
    }));
    
    form.value = {
      name: props.workflow.name || '',
      description: props.workflow.description || '',
      isDefault: props.workflow.is_default || false,
      workflowConfig: {
        roles: roles,
      },
    };
  } else {
    // 默认添加一个角色
    if (form.value.workflowConfig.roles.length === 0) {
      addRole();
    }
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      initForm();
    }
  },
  { immediate: true }
);

watch(
  () => props.workflow,
  () => {
    if (props.modelValue) {
      initForm();
    }
  }
);

onMounted(async () => {
  await roleActionStore.fetchRolesAndActions();
});
</script>

<style scoped>
.roles-config {
  max-height: 600px;
  overflow-y: auto;
}

.role-item {
  margin-bottom: 20px;
}

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
