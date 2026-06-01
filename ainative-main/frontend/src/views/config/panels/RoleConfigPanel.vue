<template>
  <div class="role-config-panel">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 20px" />

      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 20px">
        <template #default>
          为不同角色配置专属的 LLM。如果未配置，角色将使用系统默认 LLM。
        </template>
      </el-alert>

      <!-- 角色配置网格 -->
      <div class="roles-grid">
        <el-card
          v-for="role in roles"
          :key="role.profile"
          shadow="hover"
          class="role-card"
          :class="{ 'has-config': roleConfigs[role.profile] }"
        >
          <div class="role-card-header">
            <div class="role-info">
              <el-icon class="role-icon" :size="20"><User /></el-icon>
              <span class="role-name">{{ role.name }}</span>
            </div>
            <el-tag 
              :type="roleConfigs[role.profile] ? 'success' : 'info'" 
              size="small" 
              effect="plain"
            >
              {{ roleConfigs[role.profile] ? '已配置' : '使用默认' }}
            </el-tag>
          </div>

          <p class="role-description">{{ role.description }}</p>

          <!-- 当前配置显示 -->
          <div v-if="roleConfigs[role.profile]" class="current-config">
            <div class="config-item">
              <span class="config-label">服务商</span>
              <span class="config-value">{{ getProviderName(roleConfigs[role.profile].provider) }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">模型</span>
              <span class="config-value">{{ roleConfigs[role.profile].model }}</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="role-actions">
            <el-button
              :type="roleConfigs[role.profile] ? 'primary' : 'default'"
              size="small"
              @click="openConfigDialog(role)"
            >
              {{ roleConfigs[role.profile] ? '编辑配置' : '配置 LLM' }}
            </el-button>
            <el-button
              v-if="roleConfigs[role.profile]"
              type="danger"
              size="small"
              plain
              @click="clearRoleConfig(role.profile)"
            >
              清除
            </el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 配置对话框 -->
    <el-dialog
      v-model="showConfigDialog"
      :title="`${currentRole?.name} - LLM 配置`"
      width="600px"
      @close="resetForm"
    >
      <el-alert
        v-if="currentRole?.profile === 'Engineer'"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 20px"
      >
        <template #default>
          <strong>提示：</strong>Engineer 角色支持使用 Cursor Agent，需要配置 GitHub 仓库信息。
        </template>
      </el-alert>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="选择 LLM" prop="provider">
          <el-select
            v-model="form.provider"
            placeholder="选择已配置的 LLM"
            style="width: 100%"
            @change="onProviderChange"
          >
            <el-option
              v-for="config in availableLLMs"
              :key="config.provider"
              :label="`${getProviderName(config.provider)} - ${config.model}`"
              :value="config.provider"
            />
          </el-select>
          <el-text v-if="availableLLMs.length === 0" type="warning" size="small" style="margin-top: 4px; display: block">
            请先在「LLM 服务商」页面添加 LLM 配置
          </el-text>
        </el-form-item>

        <!-- Cursor 特定配置 -->
        <template v-if="form.provider === 'cursor'">
          <el-form-item label="GitHub 仓库 URL" prop="repository">
            <el-input
              v-model="form.repository"
              placeholder="https://github.com/your-org/your-repo"
            />
          </el-form-item>

          <el-form-item label="分支名称" prop="branchName">
            <el-input
              v-model="form.branchName"
              placeholder="cursor/role-work (可选)"
            />
          </el-form-item>

          <el-form-item label="自动创建 PR">
            <el-switch v-model="form.autoCreatePr" />
          </el-form-item>
        </template>

        <!-- 参数覆盖（可选） -->
        <el-collapse v-model="showAdvanced">
          <el-collapse-item title="参数覆盖（可选）" name="advanced">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="Temperature">
                  <el-slider
                    v-model="form.temperature"
                    :min="0"
                    :max="2"
                    :step="0.1"
                    show-input
                    :format-tooltip="(val: number) => val.toFixed(1)"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Max Tokens">
                  <el-input-number
                    v-model="form.maxTokens"
                    :min="1"
                    :max="100000"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-collapse-item>
        </el-collapse>
      </el-form>

      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRoleConfig">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { User } from '@element-plus/icons-vue';
import { apiClient } from '../../../api/client';
import { useRoleActionStore } from '../../../stores/roleAction';

interface RoleLLMConfig {
  provider: string;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  repository?: string;
  branchName?: string;
  autoCreatePr?: boolean;
}

interface Role {
  profile: string;
  name: string;
  description: string;
}

interface LLMConfig {
  id: string;
  provider: string;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

const roleActionStore = useRoleActionStore();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const roleConfigs = ref<Record<string, RoleLLMConfig>>({});
const availableLLMs = ref<LLMConfig[]>([]);
const showConfigDialog = ref(false);
const currentRole = ref<Role | null>(null);
const showAdvanced = ref<string[]>([]);
const formRef = ref<FormInstance>();

const form = ref({
  provider: '',
  model: '',
  apiKey: '',
  baseURL: '',
  temperature: 0.7,
  maxTokens: 8000,
  repository: '',
  branchName: '',
  autoCreatePr: true,
});

const roles = computed<Role[]>(() => {
  return roleActionStore.roles.map(role => ({
    profile: role.profile,
    name: roleActionStore.getRoleDisplayName(role.profile),
    description: role.description,
  }));
});

const rules: FormRules = {
  provider: [{ required: true, message: '请选择 LLM', trigger: 'change' }],
  repository: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (form.value.provider === 'cursor') {
          if (!value || value.trim() === '') {
            callback(new Error('Cursor Agent 需要配置 GitHub 仓库 URL'));
          } else if (!value.startsWith('https://github.com/')) {
            callback(new Error('请输入有效的 GitHub 仓库 URL'));
          } else {
            callback();
          }
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
};

const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  zhipuai: '智谱AI',
  ark: '火山引擎 Ark (豆包)',
  anthropic: 'Anthropic Claude',
  deepseek: 'DeepSeek',
  gemini: 'Google Gemini',
  qianfan: '百度千帆',
  dashscope: '阿里通义',
  ollama: 'Ollama',
  cursor: 'Cursor Agent',
};

function getProviderName(provider: string): string {
  return providerNames[provider] || provider;
}

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    // 获取已配置的 LLM
    const llmResponse = await apiClient.getLLMConfigs() as any;
    availableLLMs.value = llmResponse.configs || [];

    // 获取角色配置
    const roleResponse = await apiClient.getRoleLLMConfigs() as any;
    roleConfigs.value = roleResponse.configs || {};
  } catch (err: any) {
    error.value = err.message || '获取配置失败';
  } finally {
    loading.value = false;
  }
}

function openConfigDialog(role: Role) {
  currentRole.value = role;
  const existingConfig = roleConfigs.value[role.profile];

  if (existingConfig) {
    form.value = {
      provider: existingConfig.provider,
      model: existingConfig.model,
      apiKey: existingConfig.apiKey || '',
      baseURL: existingConfig.baseURL || '',
      temperature: existingConfig.temperature ?? 0.7,
      maxTokens: existingConfig.maxTokens ?? 8000,
      repository: existingConfig.repository || '',
      branchName: existingConfig.branchName || '',
      autoCreatePr: existingConfig.autoCreatePr ?? true,
    };
  } else {
    resetForm();
    // 默认选择第一个可用的 LLM
    if (availableLLMs.value.length > 0) {
      const defaultLLM = availableLLMs.value.find(l => l.isActive) || availableLLMs.value[0];
      form.value.provider = defaultLLM.provider;
      form.value.model = defaultLLM.model;
      form.value.temperature = defaultLLM.temperature;
      form.value.maxTokens = defaultLLM.maxTokens;
    }
  }

  showConfigDialog.value = true;
}

function onProviderChange() {
  const selectedLLM = availableLLMs.value.find(l => l.provider === form.value.provider);
  if (selectedLLM) {
    form.value.model = selectedLLM.model;
    form.value.apiKey = selectedLLM.apiKey || '';
    form.value.baseURL = selectedLLM.baseURL || '';
    form.value.temperature = selectedLLM.temperature;
    form.value.maxTokens = selectedLLM.maxTokens;
  }
}

function resetForm() {
  form.value = {
    provider: '',
    model: '',
    apiKey: '',
    baseURL: '',
    temperature: 0.7,
    maxTokens: 8000,
    repository: '',
    branchName: '',
    autoCreatePr: true,
  };
  showAdvanced.value = [];
  formRef.value?.resetFields();
}

async function saveRoleConfig() {
  if (!formRef.value || !currentRole.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      const selectedLLM = availableLLMs.value.find(l => l.provider === form.value.provider);
      
      await apiClient.saveRoleLLMConfig(currentRole.value!.profile, {
        provider: form.value.provider,
        model: form.value.model || selectedLLM?.model || '',
        apiKey: selectedLLM?.apiKey,
        baseURL: selectedLLM?.baseURL,
        temperature: form.value.temperature,
        maxTokens: form.value.maxTokens,
        repository: form.value.repository,
        branchName: form.value.branchName,
        autoCreatePr: form.value.autoCreatePr,
      });

      ElMessage.success('角色配置保存成功');
      showConfigDialog.value = false;
      resetForm();
      await fetchData();
    } catch (err: any) {
      ElMessage.error(err.message || '保存配置失败');
    } finally {
      saving.value = false;
    }
  });
}

async function clearRoleConfig(profile: string) {
  try {
    const roleName = roleActionStore.getRoleDisplayName(profile);
    await ElMessageBox.confirm(
      `确定要清除 ${roleName} 的 LLM 配置吗？清除后将使用系统默认 LLM。`,
      '确认清除',
      { type: 'warning' }
    );
    await apiClient.deleteRoleLLMConfig(profile);
    ElMessage.success('配置已清除');
    await fetchData();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '清除配置失败');
    }
  }
}

onMounted(async () => {
  await roleActionStore.fetchRolesAndActions();
  await fetchData();
});
</script>

<style scoped>
.role-config-panel {
  width: 100%;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.role-card {
  transition: all 0.3s;
}

.role-card.has-config {
  border: 2px solid #67c23a;
}

.role-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.role-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-icon {
  color: #409eff;
}

.role-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.role-description {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  margin: 0 0 12px 0;
}

.current-config {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.config-label {
  font-size: 12px;
  color: #909399;
}

.config-value {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.role-actions {
  display: flex;
  gap: 8px;
}
</style>
