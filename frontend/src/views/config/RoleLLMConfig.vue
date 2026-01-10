<template>
  <div class="role-llm-config">
    <PageHeader
      title="角色 LLM 配置"
      description="为每个角色配置专属的大模型提供商"
      :back-handler="() => router.push('/config/llm')"
    />

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <!-- 角色配置列表 -->
      <div class="roles-grid">
        <el-card
          v-for="role in roles"
          :key="role.profile"
          shadow="hover"
          class="role-card"
          :class="{ 'has-config': roleConfigs[role.profile] }"
        >
          <template #header>
            <div class="card-header-content">
              <div class="role-info">
                <h3 class="role-name">
                  <el-icon>
                    <User />
                  </el-icon>
                  {{ role.name }}
                </h3>
                <p class="role-profile">{{ role.profile }}</p>
              </div>
              <el-tag v-if="roleConfigs[role.profile]" type="success" effect="plain">
                已配置
              </el-tag>
            </div>
          </template>

          <div class="role-description">
            <p>{{ role.description }}</p>
          </div>

          <!-- 当前配置显示 -->
          <div v-if="roleConfigs[role.profile]" class="current-config">
            <el-divider content-position="left">当前配置</el-divider>
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="提供商">
                {{ roleConfigs[role.profile].provider }}
              </el-descriptions-item>
              <el-descriptions-item label="模型">
                {{ roleConfigs[role.profile].model }}
              </el-descriptions-item>
              <el-descriptions-item v-if="roleConfigs[role.profile].baseURL" label="Base URL">
                {{ roleConfigs[role.profile].baseURL }}
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 操作按钮 -->
          <div class="role-actions">
            <el-button
              type="primary"
              :icon="roleConfigs[role.profile] ? Edit : Plus"
              @click="openConfigDialog(role)"
            >
              {{ roleConfigs[role.profile] ? '编辑配置' : '配置 LLM' }}
            </el-button>
            <el-button
              v-if="roleConfigs[role.profile]"
              type="danger"
              :icon="Delete"
              @click="clearRoleConfig(role.profile)"
            >
              清除配置
            </el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 配置对话框 -->
    <el-dialog
      v-model="showConfigDialog"
      :title="`${currentRole?.name} - LLM 配置`"
      width="700px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        >
          <template #default>
            <p>为 {{ currentRole?.name }} 配置专属的 LLM。如果未配置，将使用系统默认 LLM。</p>
            <p v-if="currentRole?.profile === 'Engineer'" style="margin-top: 8px; margin-bottom: 0;">
              <strong>提示：</strong>Engineer 角色支持使用 Cursor Agent，需要配置 GitHub 仓库信息。
            </p>
          </template>
        </el-alert>

        <el-form-item label="提供商" prop="provider">
          <el-select
            v-model="form.provider"
            placeholder="选择已配置的提供商"
            style="width: 100%"
            @change="onProviderChange"
          >
            <el-option
              v-for="provider in providerConfigs"
              :key="provider.provider"
              :label="getProviderName(provider.provider)"
              :value="provider.provider"
            />
          </el-select>
          <el-alert
            v-if="providerConfigs.length === 0"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top: 8px"
          >
            还没有配置任何 Provider。请先到 <el-button type="text" size="small" @click="router.push('/config/llm')">LLM 配置页面</el-button> 配置 Provider。
          </el-alert>
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="form.apiKey"
            type="password"
            placeholder="将使用已配置的 Provider API Key"
            show-password
            :disabled="true"
          />
          <el-text type="success" size="small" style="margin-top: 4px; display: block">
            将使用已配置的 Provider API Key
          </el-text>
        </el-form-item>

        <el-form-item v-if="form.provider !== 'cursor'" label="Base URL" prop="baseURL">
          <el-input
            v-model="form.baseURL"
            placeholder="将使用已配置的 Provider Base URL"
            :disabled="true"
          />
          <el-text type="success" size="small" style="margin-top: 4px; display: block">
            将使用已配置的 Provider Base URL
          </el-text>
        </el-form-item>

        <!-- Cursor 特定配置 -->
        <template v-if="form.provider === 'cursor'">
          <el-form-item label="GitHub 仓库 URL" prop="repository">
            <el-input
              v-model="form.repository"
              placeholder="https://github.com/your-org/your-repo"
            />
            <el-text type="info" size="small" style="margin-top: 4px; display: block">
              用于 Cursor Agent 的 GitHub 仓库地址
            </el-text>
          </el-form-item>

          <el-form-item label="分支名称" prop="branchName">
            <el-input
              v-model="form.branchName"
              placeholder="cursor/role-work"
            />
            <el-text type="info" size="small" style="margin-top: 4px; display: block">
              可选，留空将自动生成
            </el-text>
          </el-form-item>

          <el-form-item label="自动创建 PR">
            <el-switch v-model="form.autoCreatePr" />
            <el-text type="info" size="small" style="margin-top: 4px; display: block">
              是否在完成后自动创建 Pull Request
            </el-text>
          </el-form-item>
        </template>

        <el-form-item label="模型" prop="model">
          <el-select
            v-model="form.model"
            placeholder="选择模型"
            style="width: 100%"
            filterable
            allow-create
            default-first-option
          >
            <el-option
              v-for="model in availableModels"
              :key="model"
              :label="model"
              :value="model"
            />
          </el-select>
          <el-text v-if="form.provider === 'cursor'" type="info" size="small" style="margin-top: 4px; display: block">
            使用 "auto" 让 Cursor 自动选择最合适的模型
          </el-text>
          <el-text v-else-if="availableModels.length === 0" type="warning" size="small" style="margin-top: 4px; display: block">
            该 Provider 未配置默认模型，请输入模型名称
          </el-text>
        </el-form-item>

        <el-row v-if="form.provider !== 'cursor'" :gutter="20">
          <el-col :span="12">
            <el-form-item label="Temperature" prop="temperature">
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
            <el-form-item label="Max Tokens" prop="maxTokens">
              <el-input-number
                v-model="form.maxTokens"
                :min="1"
                :max="100000"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
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
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { User, Plus, Edit, Delete } from '@element-plus/icons-vue';
import { apiClient } from '../../api/client';
import { useRoleActionStore } from '../../stores/roleAction';
import PageHeader from '../../components/common/PageHeader.vue';

interface RoleLLMConfig {
  provider: string;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  // Cursor specific
  repository?: string;
  branchName?: string;
  autoCreatePr?: boolean;
}

const router = useRouter();
const roleActionStore = useRoleActionStore();

// 定义Role类型
interface Role {
  profile: string;
  name: string;
  description: string;
  goal: string;
}

// 从store获取角色列表
const roles = computed<Role[]>(() => {
  return roleActionStore.roles.map(role => ({
    profile: role.profile,
    name: roleActionStore.getRoleDisplayName(role.profile),
    description: role.description,
    goal: role.goal,
  }));
});

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const roleConfigs = ref<Record<string, RoleLLMConfig>>({});
const showConfigDialog = ref(false);
const currentRole = ref<Role | null>(null);
const formRef = ref<FormInstance>();
const providerConfigs = ref<Array<{ provider: string; apiKey?: string; baseURL?: string; model?: string }>>([]);
const availableModels = ref<string[]>([]);

const form = ref<RoleLLMConfig & { provider: string }>({
  provider: 'zhipuai',
  apiKey: '',
  baseURL: '',
  model: 'glm-4-flash',
  temperature: 0.7,
  maxTokens: 8000,
  repository: '',
  branchName: '',
  autoCreatePr: true,
});

const rules: FormRules = {
  provider: [
    {
      required: true,
      message: '请选择已配置的提供商',
      trigger: 'change',
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (!value) {
          callback(new Error('请选择已配置的提供商'));
        } else if (!providerConfigs.value.some(p => p.provider === value)) {
          callback(new Error('请选择已配置的提供商'));
        } else {
          callback();
        }
      },
    },
  ],
  model: [{ required: true, message: '请选择或输入模型名称', trigger: 'blur' }],
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

// 默认模型配置
const defaultModels: Record<string, string> = {
  openai: 'gpt-4-turbo',
  zhipuai: 'glm-4-flash',
  ark: 'doubao-1-5-pro-32k-250115',
  cursor: 'auto',
  anthropic: 'claude-3-opus-20240229',
  gemini: 'gemini-pro',
  qianfan: 'ERNIE-Bot',
  dashscope: 'qwen-turbo',
  ollama: 'llama2',
};

// 监听提供商变化
watch(() => form.value.provider, (newProvider) => {
  if (!newProvider) return;
  
  // 从已配置的 Provider 中获取配置
  const providerConfig = providerConfigs.value.find(p => p.provider === newProvider);
  if (providerConfig) {
    // 自动填充 API Key 和 Base URL（虽然禁用，但保留值用于显示）
    form.value.apiKey = providerConfig.apiKey || '';
    form.value.baseURL = providerConfig.baseURL || '';
    
    // 更新可用模型列表
    updateAvailableModels(newProvider);
    
    // 如果有配置的模型，自动选择
    if (providerConfig.model) {
      form.value.model = providerConfig.model;
    } else if (defaultModels[newProvider]) {
      form.value.model = defaultModels[newProvider];
    }
  }
  
  // 重置 Cursor 特定字段
  if (newProvider !== 'cursor') {
    form.value.repository = '';
    form.value.branchName = '';
    form.value.autoCreatePr = true;
  }
});

function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    zhipuai: '智谱AI (ZhipuAI)',
    ark: '火山引擎 Ark (豆包)',
    anthropic: 'Anthropic Claude',
    gemini: 'Google Gemini',
    qianfan: '百度千帆',
    dashscope: '阿里通义',
    ollama: 'Ollama',
    cursor: 'Cursor Agent',
  };
  return names[provider] || provider;
}

function updateAvailableModels(provider: string) {
  // 获取该 Provider 配置的模型
  const providerConfig = providerConfigs.value.find(p => p.provider === provider);
  const models: string[] = [];
  
  if (providerConfig?.model) {
    models.push(providerConfig.model);
  }
  
  // 添加默认模型（如果不同）
  if (defaultModels[provider] && !models.includes(defaultModels[provider])) {
    models.push(defaultModels[provider]);
  }
  
  // Cursor 特殊处理
  if (provider === 'cursor') {
    if (!models.includes('auto')) {
      models.unshift('auto');
    }
  }
  
  availableModels.value = models;
}

function onProviderChange() {
  // 当切换提供商时，重置相关字段
  if (form.value.provider !== 'cursor') {
    form.value.repository = '';
    form.value.branchName = '';
  }
}

async function fetchProviderConfigs() {
  try {
    const response = await apiClient.getProviderConfigs() as any;
    if (response && response.providers) {
      providerConfigs.value = response.providers.filter((p: any) => p.hasApiKey) || [];
    } else if (Array.isArray(response)) {
      providerConfigs.value = response.filter((p: any) => p.hasApiKey) || [];
    } else {
      providerConfigs.value = [];
    }
  } catch (err: any) {
    console.error('Failed to fetch provider configs:', err);
    providerConfigs.value = [];
  }
}

async function fetchRoleConfigs() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getRoleLLMConfigs() as any;
    roleConfigs.value = response.configs || {};
  } catch (err: any) {
    error.value = err.message || '获取角色配置失败';
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
      apiKey: existingConfig.apiKey || '',
      baseURL: existingConfig.baseURL || '',
      model: existingConfig.model,
      temperature: existingConfig.temperature ?? 0.7,
      maxTokens: existingConfig.maxTokens ?? 8000,
      repository: existingConfig.repository || '',
      branchName: existingConfig.branchName || '',
      autoCreatePr: existingConfig.autoCreatePr ?? true,
    };
    // 更新可用模型列表
    updateAvailableModels(existingConfig.provider);
  } else {
    resetForm();
    // 如果有已配置的 Provider，默认选择第一个
    if (providerConfigs.value.length > 0) {
      form.value.provider = providerConfigs.value[0].provider;
      updateAvailableModels(form.value.provider);
    }
  }
  
  showConfigDialog.value = true;
}

function resetForm() {
  form.value = {
    provider: 'zhipuai',
    apiKey: '',
    baseURL: '',
    model: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 8000,
    repository: '',
    branchName: '',
    autoCreatePr: true,
  };
  formRef.value?.resetFields();
}

async function saveRoleConfig() {
  if (!formRef.value || !currentRole.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      // 从 Provider 配置中获取 API Key 和 Base URL
      const providerConfig = providerConfigs.value.find(p => p.provider === form.value.provider);
      const configToSave: RoleLLMConfig = {
        provider: form.value.provider,
        model: form.value.model,
        temperature: form.value.temperature,
        maxTokens: form.value.maxTokens,
        // 使用 Provider 配置中的值，如果 Provider 配置中没有，则使用表单中的值（向后兼容）
        apiKey: providerConfig?.apiKey || form.value.apiKey,
        baseURL: providerConfig?.baseURL || form.value.baseURL,
        // Cursor 特定配置
        repository: form.value.repository,
        branchName: form.value.branchName,
        autoCreatePr: form.value.autoCreatePr,
      };
      
      await apiClient.saveRoleLLMConfig(currentRole.value!.profile, configToSave);
      ElMessage.success('角色配置保存成功');
      showConfigDialog.value = false;
      resetForm();
      await fetchRoleConfigs();
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
      {
        type: 'warning',
      }
    );
    await apiClient.deleteRoleLLMConfig(profile);
    ElMessage.success('配置已清除');
    await fetchRoleConfigs();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '清除配置失败');
    }
  }
}

onMounted(async () => {
  await roleActionStore.fetchRolesAndActions();
  fetchProviderConfigs();
  fetchRoleConfigs();
});
</script>

<style scoped>
.role-llm-config {
  max-width: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.header-desc {
  color: #909399;
  margin-top: 8px;
  margin-bottom: 0;
}

.content-section {
  min-height: 400px;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.role-card {
  transition: all 0.3s;
}

.role-card.has-config {
  border: 2px solid #67c23a;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-info {
  flex: 1;
}

.role-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-profile {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.role-description {
  margin-bottom: 16px;
}

.role-description p {
  color: #606266;
  margin: 0;
  line-height: 1.6;
}

.current-config {
  margin: 16px 0;
}

.role-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
</style>

