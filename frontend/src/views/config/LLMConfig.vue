<template>
  <div class="llm-config">
    <PageHeader
      title="LLM 配置"
      description="配置大模型提供商和 API Key"
      :back-handler="() => router.push('/')"
    />

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <!-- 当前激活的配置 -->
      <el-card v-if="activeConfig" class="active-config-card" shadow="hover">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Check />
              </el-icon>
              当前激活配置
            </span>
          </div>
        </template>
        <div class="active-config-info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="提供商">{{ activeConfig.provider }}</el-descriptions-item>
            <el-descriptions-item label="模型">{{ activeConfig.model }}</el-descriptions-item>
            <el-descriptions-item label="Base URL">{{ activeConfig.baseURL || '默认' }}</el-descriptions-item>
            <el-descriptions-item label="Temperature">{{ activeConfig.temperature }}</el-descriptions-item>
            <el-descriptions-item label="Max Tokens">{{ activeConfig.maxTokens }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-card>

      <!-- 角色配置快捷入口 -->
      <el-card class="role-config-card" shadow="hover">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <User />
              </el-icon>
              角色 LLM 配置
            </span>
            <el-button type="success" @click="router.push('/config/role-llm')">
              <el-icon>
                <Setting />
              </el-icon>
              配置角色 LLM
            </el-button>
          </div>
        </template>
        <div class="role-config-desc">
          <p>为不同的角色配置专属的大模型提供商，例如：Engineer 使用 Cursor Agent，ProductManager 使用 GPT-4 等。</p>
        </div>
      </el-card>

      <!-- 提示词配置快捷入口 -->
      <el-card class="prompt-config-card" shadow="hover">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Document />
              </el-icon>
              提示词配置
            </span>
            <el-button type="primary" @click="router.push('/config/prompts')">
              <el-icon>
                <Setting />
              </el-icon>
              配置提示词
            </el-button>
          </div>
        </template>
        <div class="prompt-config-desc">
          <p>配置各类提示词模板和系统提示词，包括需求说明、PRD、设计、代码生成、测试用例等提示词。</p>
        </div>
      </el-card>

      <!-- Provider 配置管理 -->
      <el-card class="provider-configs-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">
              <el-icon>
                <Setting />
              </el-icon>
              Provider 配置（API Key 和 Base URL）
            </span>
            <el-button type="primary" @click="showProviderDialog = true">
              <el-icon>
                <Plus />
              </el-icon>
              配置 Provider
            </el-button>
          </div>
        </template>
        <div class="provider-configs-desc">
          <p>配置各个大模型提供商的 API Key、Base URL 和默认模型。配置一次后，切换模型时无需重新输入。</p>
        </div>
        <div v-if="providerConfigs.length > 0" class="provider-configs-list">
          <el-card
            v-for="provider in providerConfigs"
            :key="provider.provider"
            shadow="hover"
            class="provider-config-card"
            @click="editProvider(provider.provider)"
          >
            <div class="provider-config-header">
              <div class="provider-config-info">
                <h3 class="provider-config-name">
                  <el-icon>
                    <Setting />
                  </el-icon>
                  {{ getProviderName(provider.provider) }}
                  <el-icon v-if="provider.hasApiKey" style="margin-left: 8px; color: #67c23a">
                    <Check />
                  </el-icon>
                </h3>
                <div class="provider-config-details">
                  <el-descriptions :column="1" size="small" border>
                    <el-descriptions-item label="Provider">
                      <el-text type="primary" style="font-weight: 500">{{ getProviderName(provider.provider) }}</el-text>
                    </el-descriptions-item>
                    <el-descriptions-item label="API Key">
                      <el-text v-if="provider.apiKey" type="info" style="font-size: 12px; font-family: monospace;">
                        {{ provider.apiKey }}
                      </el-text>
                      <el-text v-else type="info" style="font-size: 12px">未配置</el-text>
                    </el-descriptions-item>
                    <el-descriptions-item label="Base URL">
                      <el-text v-if="provider.baseURL" type="info" style="font-size: 12px">{{ provider.baseURL }}</el-text>
                      <el-text v-else type="info" style="font-size: 12px">未配置</el-text>
                    </el-descriptions-item>
                    <el-descriptions-item label="模型">
                      <el-tag v-if="provider.model" type="primary" size="small" effect="plain">{{ provider.model }}</el-tag>
                      <el-text v-else type="info" style="font-size: 12px">未设置</el-text>
                    </el-descriptions-item>
                  </el-descriptions>
                </div>
              </div>
              <div class="provider-config-actions">
                <el-button size="small" @click.stop="editProvider(provider.provider)">
                  编辑
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
        <el-empty v-else description="还没有配置 Provider。点击上方按钮开始配置！" />
      </el-card>

      <!-- 配置列表 -->
      <el-card class="configs-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">模型配置</span>
            <el-button type="primary" @click="showCreateDialog = true">
              <el-icon>
                <Plus />
              </el-icon>
              新建配置
            </el-button>
          </div>
        </template>

        <el-empty v-if="configs.length === 0" description="还没有配置。创建您的第一个 LLM 配置！">
          <el-button type="primary" @click="showCreateDialog = true">
            创建配置
          </el-button>
        </el-empty>

        <div v-else class="configs-list">
          <el-card
            v-for="config in configs"
            :key="config.id"
            shadow="hover"
            class="config-card"
            :class="{ 'is-active': config.isActive }"
          >
            <div class="config-header">
              <div class="config-info">
                <h3 class="config-name">
                  <el-icon>
                    <Setting />
                  </el-icon>
                  {{ config.provider }}
                  <el-tag v-if="config.isActive" type="success" size="small" effect="plain">激活</el-tag>
                </h3>
                <p class="config-desc">模型: {{ config.model }}</p>
              </div>
              <div class="config-actions">
                <el-button
                  v-if="!config.isActive"
                  type="primary"
                  size="small"
                  @click="activateConfig(config.id)"
                >
                  激活
                </el-button>
                <el-button size="small" @click="editConfig(config)">
                  编辑
                </el-button>
                <el-button type="danger" size="small" @click="deleteConfig(config.id)">
                  删除
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
      </el-card>
    </div>

    <!-- 创建/编辑配置对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingConfig ? '编辑配置' : '新建配置'"
      width="700px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="提供商" prop="provider">
          <el-select v-model="form.provider" placeholder="选择已配置的提供商" style="width: 100%" @change="onProviderChange">
            <el-option
              v-for="provider in providerConfigs.filter(p => p.hasApiKey)"
              :key="provider.provider"
              :label="getProviderName(provider.provider)"
              :value="provider.provider"
            />
          </el-select>
          <el-alert
            v-if="providerConfigs.filter(p => p.hasApiKey).length === 0"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top: 8px"
          >
            还没有配置任何 Provider。请先配置 Provider 后再创建模型配置。
            <el-button type="text" size="small" @click="showProviderDialog = true">
              立即配置
            </el-button>
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

        <el-form-item label="Base URL" prop="baseURL">
          <el-input
            v-model="form.baseURL"
            placeholder="将使用已配置的 Provider Base URL"
            :disabled="true"
          />
          <el-text type="success" size="small" style="margin-top: 4px; display: block">
            将使用已配置的 Provider Base URL
          </el-text>
        </el-form-item>

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
              placeholder="cursor/work"
            />
          </el-form-item>
          <el-form-item label="自动创建 PR">
            <el-switch v-model="form.autoCreatePr" />
          </el-form-item>
        </template>

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

        <el-form-item label="设为激活配置" prop="isActive">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">
          {{ editingConfig ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Provider 配置对话框 -->
    <el-dialog
      v-model="showProviderDialog"
      :title="editingProvider ? '编辑 Provider 配置' : '新建 Provider 配置'"
      width="600px"
      @close="resetProviderForm"
    >
      <el-form ref="providerFormRef" :model="providerForm" :rules="providerRules" label-position="top">
        <el-form-item label="提供商" prop="provider">
          <el-select v-model="providerForm.provider" placeholder="选择提供商" style="width: 100%" :disabled="!!editingProvider">
            <el-option label="OpenAI" value="openai" />
            <el-option label="智谱AI (ZhipuAI)" value="zhipuai" />
            <el-option label="火山引擎 Ark (豆包)" value="ark" />
            <el-option label="Anthropic Claude" value="anthropic" />
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="Google Gemini" value="gemini" />
            <el-option label="百度千帆" value="qianfan" />
            <el-option label="阿里通义" value="dashscope" />
            <el-option label="Ollama" value="ollama" />
            <el-option label="Cursor Agent" value="cursor" />
          </el-select>
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="providerForm.apiKey"
            type="password"
            placeholder="输入 API Key"
            show-password
            :disabled="providerForm.provider === 'ollama'"
          />
          <el-text v-if="providerForm.provider === 'ollama'" type="info" size="small" style="margin-top: 4px; display: block">
            Ollama 不需要 API Key
          </el-text>
        </el-form-item>

        <el-form-item label="Base URL" prop="baseURL">
          <el-input
            v-model="providerForm.baseURL"
            :placeholder="defaultBaseURLs[providerForm.provider] ? `可选，留空使用默认: ${defaultBaseURLs[providerForm.provider]}` : '可选，留空使用默认 URL'"
          />
          <el-text v-if="providerForm.provider === 'ark'" type="info" size="small" style="margin-top: 4px; display: block">
            豆包 (ARK) 默认 Base URL: https://ark.cn-beijing.volces.com/api/v3
          </el-text>
        </el-form-item>

        <el-form-item label="默认模型" prop="model">
          <el-input
            v-model="providerForm.model"
            :placeholder="defaultModels[providerForm.provider] ? `可选，留空使用默认: ${defaultModels[providerForm.provider]}` : '可选，留空不设置默认模型'"
          />
          <el-text v-if="providerForm.provider === 'cursor'" type="info" size="small" style="margin-top: 4px; display: block">
            使用 "auto" 让 Cursor 自动选择最合适的模型
          </el-text>
          <el-text v-if="providerForm.provider === 'ark'" type="info" size="small" style="margin-top: 4px; display: block">
            豆包 (ARK) 推荐模型: doubao-1-5-pro-32k-250115
          </el-text>
          <el-text v-if="providerForm.provider === 'deepseek'" type="info" size="small" style="margin-top: 4px; display: block">
            DeepSeek 推荐模型: deepseek-chat (对话) 或 deepseek-coder (代码)
          </el-text>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showProviderDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingProvider" @click="saveProviderConfig">
          {{ editingProvider ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Check, Plus, Setting, User, Document } from '@element-plus/icons-vue';
import { apiClient } from '../../api/client';
import PageHeader from '../../components/common/PageHeader.vue';

interface LLMConfig {
  id: string;
  provider: string;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  repository?: string;
  branchName?: string;
  autoCreatePr?: boolean;
  createdAt: string;
  updatedAt: string;
}

const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const savingProvider = ref(false);
const error = ref<string | null>(null);
const configs = ref<LLMConfig[]>([]);
const activeConfig = ref<LLMConfig | null>(null);
const providerConfigs = ref<Array<{ provider: string; apiKey?: string; hasApiKey: boolean; baseURL?: string; model?: string }>>([]);
const availableModels = ref<string[]>([]);
const showCreateDialog = ref(false);
const showProviderDialog = ref(false);
const editingConfig = ref<LLMConfig | null>(null);
const editingProvider = ref<string | null>(null);
const formRef = ref<FormInstance>();
const providerFormRef = ref<FormInstance>();

const form = ref({
  provider: 'zhipuai',
  apiKey: '',
  baseURL: '',
  model: 'glm-4-flash',
  temperature: 0.7,
  maxTokens: 8000,
  isActive: false,
  repository: '',
  branchName: '',
  autoCreatePr: true,
});

const providerForm = ref({
  provider: 'zhipuai',
  apiKey: '',
  baseURL: '',
  model: '',
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
        } else if (!providerConfigs.value.some(p => p.provider === value && p.hasApiKey)) {
          callback(new Error('请选择已配置的提供商'));
        } else {
          callback();
        }
      },
    },
  ],
  model: [{ required: true, message: '请选择或输入模型名称', trigger: 'blur' }],
};

const providerRules: FormRules = {
  provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
  apiKey: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (providerForm.value.provider === 'ollama') {
          callback();
        } else if (!value || value.trim() === '') {
          callback(new Error('请输入 API Key'));
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
  ark: 'doubao-1-5-pro-32k-250115', // 豆包模型
  cursor: 'auto',
  anthropic: 'claude-3-opus-20240229',
  deepseek: 'deepseek-v3-2',
  gemini: 'gemini-pro',
  qianfan: 'ERNIE-Bot',
  dashscope: 'qwen-turbo',
  ollama: 'llama2',
};

// 默认 Base URL 配置
const defaultBaseURLs: Record<string, string> = {
  ark: 'https://ark.cn-beijing.volces.com/api/v3',
  zhipuai: 'https://open.bigmodel.cn/api/paas/v4',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://localhost:11434',
};

// 更新可用模型列表
function updateAvailableModels(provider: string) {
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

// 监听提供商变化，自动填充配置
watch(() => form.value.provider, (newProvider) => {
  if (!newProvider) return;
  
  // 从已配置的 Provider 中获取配置
  const providerConfig = providerConfigs.value.find(p => p.provider === newProvider);
  if (providerConfig) {
    // 自动填充 API Key 和 Base URL
    form.value.apiKey = providerConfig.apiKey || '';
    form.value.baseURL = providerConfig.baseURL || '';
    
    // 更新可用模型列表
    updateAvailableModels(newProvider);
    
    // 如果有配置的模型，自动选择
    if (providerConfig.model && !editingConfig.value) {
      form.value.model = providerConfig.model;
    } else if (defaultModels[newProvider] && !editingConfig.value) {
      form.value.model = defaultModels[newProvider];
    }
  }
});

// 监听 Provider 配置对话框中的提供商变化，自动填充默认模型
watch(() => providerForm.value.provider, (newProvider) => {
  if (!editingProvider.value && defaultModels[newProvider]) {
    providerForm.value.model = defaultModels[newProvider];
  }
});

async function fetchConfigs() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getLLMConfigs() as any;
    configs.value = response.configs || [];
    
    // 获取激活配置
    const activeResponse = await apiClient.getActiveLLMConfig() as any;
    activeConfig.value = activeResponse.config || null;

    // 获取 Provider 配置
    await fetchProviderConfigs();
  } catch (err: any) {
    error.value = err.message || '获取配置列表失败';
  } finally {
    loading.value = false;
  }
}

async function fetchProviderConfigs() {
  try {
    const response = await apiClient.getProviderConfigs() as any;
    // API 客户端已经返回 response.data，所以直接使用
    if (response && response.providers) {
      providerConfigs.value = response.providers || [];
    } else if (Array.isArray(response)) {
      // 兼容直接返回数组的情况
      providerConfigs.value = response;
    } else {
      providerConfigs.value = [];
    }
  } catch (err: any) {
    console.error('Failed to fetch provider configs:', err);
    // 不显示错误消息，避免干扰用户
    providerConfigs.value = [];
  }
}

function getProviderName(provider: string): string {
  const names: Record<string, string> = {
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
  return names[provider] || provider;
}

async function onProviderChange() {
  // Provider change is handled by watch
  // This function can be used for additional logic if needed
}

async function editConfig(config: LLMConfig) {
  try {
    // 获取完整的配置信息（包括 API Key）
    const response = await apiClient.getLLMConfigByProvider(config.provider) as any;
    const fullConfig = response.config as LLMConfig;
    
    editingConfig.value = fullConfig;
    
    // 从 Provider 配置中获取 API Key 和 Base URL
    const providerConfig = providerConfigs.value.find(p => p.provider === config.provider);
    
    form.value = {
      provider: fullConfig.provider,
      apiKey: providerConfig?.apiKey || fullConfig.apiKey || '',
      baseURL: providerConfig?.baseURL || fullConfig.baseURL || '',
      model: fullConfig.model,
      temperature: fullConfig.temperature,
      maxTokens: fullConfig.maxTokens,
      isActive: fullConfig.isActive,
      repository: fullConfig.repository || '',
      branchName: fullConfig.branchName || '',
      autoCreatePr: fullConfig.autoCreatePr ?? true,
    };
    
    // 更新可用模型列表
    updateAvailableModels(form.value.provider);
    
    showCreateDialog.value = true;
  } catch (err: any) {
    ElMessage.error(err.message || '获取配置详情失败');
  }
}

function resetForm() {
  editingConfig.value = null;
  
  // 如果有已配置的 Provider，默认选择第一个
  const firstProvider = providerConfigs.value.find(p => p.hasApiKey);
  if (firstProvider) {
    form.value = {
      provider: firstProvider.provider,
      apiKey: firstProvider.apiKey || '',
      baseURL: firstProvider.baseURL || '',
      model: firstProvider.model || defaultModels[firstProvider.provider] || '',
      temperature: 0.7,
      maxTokens: 8000,
      isActive: false,
      repository: '',
      branchName: '',
      autoCreatePr: true,
    };
    updateAvailableModels(firstProvider.provider);
  } else {
    form.value = {
      provider: 'zhipuai',
      apiKey: '',
      baseURL: '',
      model: 'glm-4-flash',
      temperature: 0.7,
      maxTokens: 8000,
      isActive: false,
      repository: '',
      branchName: '',
      autoCreatePr: true,
    };
    availableModels.value = [];
  }
  
  formRef.value?.resetFields();
}

function resetProviderForm() {
  editingProvider.value = null;
  providerForm.value = {
    provider: 'zhipuai',
    apiKey: '',
    baseURL: '',
    model: '',
  };
  providerFormRef.value?.resetFields();
}

async function editProvider(provider: string) {
  try {
    const response = await apiClient.getProviderConfig(provider) as any;
    if (response.provider) {
      editingProvider.value = provider;
      providerForm.value = {
        provider: response.provider.provider,
        apiKey: response.provider.apiKey || '',
        baseURL: response.provider.baseURL || '',
        model: response.provider.model || '',
      };
      showProviderDialog.value = true;
    }
  } catch (err: any) {
    // Provider not configured, create new
    editingProvider.value = null;
    providerForm.value = {
      provider,
      apiKey: '',
      baseURL: '',
      model: '',
    };
    showProviderDialog.value = true;
  }
}

async function saveProviderConfig() {
  if (!providerFormRef.value) return;

  await providerFormRef.value.validate(async (valid) => {
    if (!valid) return;

    savingProvider.value = true;
    try {
      await apiClient.saveProviderConfig(providerForm.value);
      ElMessage.success(editingProvider.value ? 'Provider 配置更新成功' : 'Provider 配置创建成功');
      showProviderDialog.value = false;
      resetProviderForm();
      // 立即刷新列表
      await fetchProviderConfigs();
    } catch (err: any) {
      console.error('Failed to save provider config:', err);
      ElMessage.error(err.message || err.error || '保存 Provider 配置失败');
    } finally {
      savingProvider.value = false;
    }
  });
}

async function saveConfig() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      // 从 Provider 配置中获取 API Key 和 Base URL
      const providerConfig = providerConfigs.value.find(p => p.provider === form.value.provider);
      const configToSave = {
        ...form.value,
        // 使用 Provider 配置中的值，如果 Provider 配置中没有，则使用表单中的值（向后兼容）
        apiKey: providerConfig?.apiKey || form.value.apiKey,
        baseURL: providerConfig?.baseURL || form.value.baseURL,
      };
      
      // Both create and update use the same endpoint (upsert)
      await apiClient.createLLMConfig(configToSave);
      ElMessage.success(editingConfig.value ? '配置更新成功' : '配置创建成功');
      showCreateDialog.value = false;
      resetForm();
      await fetchConfigs();
    } catch (err: any) {
      ElMessage.error(err.message || '保存配置失败');
    } finally {
      saving.value = false;
    }
  });
}

async function activateConfig(configId: string) {
  try {
    await ElMessageBox.confirm('确定要激活此配置吗？这将停用其他配置。', '确认激活', {
      type: 'warning',
    });
    await apiClient.activateLLMConfig(configId);
    ElMessage.success('配置已激活');
    await fetchConfigs();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '激活配置失败');
    }
  }
}

async function deleteConfig(configId: string) {
  try {
    await ElMessageBox.confirm('确定要删除此配置吗？', '确认删除', {
      type: 'warning',
    });
    await apiClient.deleteLLMConfig(configId);
    ElMessage.success('配置已删除');
    await fetchConfigs();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除配置失败');
    }
  }
}

onMounted(() => {
  fetchConfigs();
});
</script>

<style scoped>
.llm-config {
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

.active-config-card {
  margin-bottom: 24px;
  border: 2px solid #67c23a;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.active-config-info {
  margin-top: 16px;
}

.configs-card {
  margin-bottom: 24px;
}

.configs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-card {
  transition: all 0.3s;
}

.config-card.is-active {
  border: 2px solid #67c23a;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.config-info {
  flex: 1;
}

.config-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-desc {
  color: #909399;
  margin: 0;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.role-config-card {
  margin-bottom: 24px;
  border: 2px solid #409eff;
}

.role-config-desc {
  color: #606266;
  line-height: 1.6;
}

.role-config-desc p {
  margin: 0;
}

.prompt-config-card {
  margin-bottom: 24px;
  border: 2px solid #409eff;
}

.prompt-config-desc {
  color: #606266;
  line-height: 1.6;
}

.prompt-config-desc p {
  margin: 0;
}

.provider-configs-card {
  margin-bottom: 24px;
  border: 2px solid #e6a23c;
}

.provider-configs-desc {
  color: #606266;
  line-height: 1.6;
  margin-bottom: 16px;
}

.provider-configs-desc p {
  margin: 0;
}

.provider-configs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.provider-config-card {
  cursor: pointer;
  transition: all 0.3s;
}

.provider-config-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.provider-config-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.provider-config-info {
  flex: 1;
}

.provider-config-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-config-details {
  margin-top: 8px;
}

.provider-config-actions {
  display: flex;
  gap: 8px;
}
</style>

