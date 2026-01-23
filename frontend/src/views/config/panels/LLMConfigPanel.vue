<template>
  <div class="llm-config-panel">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 20px" />

      <!-- 默认 LLM 展示 -->
      <el-card v-if="defaultConfig" class="default-llm-card" shadow="hover">
        <div class="default-llm-content">
          <div class="default-llm-info">
            <div class="default-llm-label">
              <el-icon><Check /></el-icon>
              当前默认 LLM
            </div>
            <div class="default-llm-detail">
              <span class="provider-name">{{ getProviderName(defaultConfig.provider) }}</span>
              <span class="model-name">{{ defaultConfig.model }}</span>
            </div>
          </div>
          <el-button type="primary" plain @click="showAddDialog = true">
            <el-icon><Plus /></el-icon>
            添加 LLM
          </el-button>
        </div>
      </el-card>

      <!-- 空状态 -->
      <el-card v-else class="empty-state-card" shadow="hover">
        <el-empty description="还没有配置任何 LLM">
          <el-button type="primary" @click="showAddDialog = true">
            <el-icon><Plus /></el-icon>
            添加第一个 LLM
          </el-button>
        </el-empty>
      </el-card>

      <!-- LLM 列表 -->
      <div v-if="llmConfigs.length > 0" class="llm-list">
        <h3 class="section-title">已配置的 LLM</h3>
        <div class="llm-grid">
          <el-card
            v-for="config in llmConfigs"
            :key="config.id"
            class="llm-card"
            :class="{ 'is-default': config.isActive }"
            shadow="hover"
          >
            <div class="llm-card-header">
              <div class="llm-provider-info">
                <el-icon class="provider-icon" :size="24"><Setting /></el-icon>
                <span class="provider-name">{{ getProviderName(config.provider) }}</span>
                <el-tag v-if="config.isActive" type="success" size="small" effect="plain">默认</el-tag>
              </div>
              <el-dropdown trigger="click">
                <el-button :icon="More" circle size="small" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="editConfig(config)">
                      <el-icon><Edit /></el-icon>
                      编辑
                    </el-dropdown-item>
                    <el-dropdown-item 
                      @click="setAsDefault(config)" 
                      :disabled="config.isActive"
                    >
                      <el-icon><Check /></el-icon>
                      设为默认
                    </el-dropdown-item>
                    <el-dropdown-item divided @click="deleteConfig(config)">
                      <el-icon><Delete /></el-icon>
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="llm-card-body">
              <div class="config-row">
                <span class="config-label">模型</span>
                <span class="config-value">{{ config.model }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">API Key</span>
                <span class="config-value api-key">{{ maskApiKey(config.apiKey) }}</span>
              </div>
              <div v-if="config.baseURL" class="config-row">
                <span class="config-label">Base URL</span>
                <span class="config-value url">{{ config.baseURL }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">参数</span>
                <span class="config-value">T: {{ config.temperature }} | MaxTokens: {{ config.maxTokens }}</span>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </div>

    <!-- 添加/编辑 LLM 弹窗 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingConfig ? '编辑 LLM 配置' : '添加 LLM'"
      width="600px"
      @close="resetForm"
    >
      <!-- 步骤1: 选择服务商 -->
      <div v-if="!editingConfig && currentStep === 1" class="step-content">
        <h4 class="step-title">选择 LLM 服务商</h4>
        <div class="provider-grid">
          <div
            v-for="provider in availableProviders"
            :key="provider.value"
            class="provider-option"
            :class="{ 'is-selected': form.provider === provider.value && !form.isCustomProvider }"
            @click="selectProvider(provider.value)"
          >
            <el-icon :size="32"><Setting /></el-icon>
            <span class="provider-label">{{ provider.label }}</span>
          </div>
        </div>
        <!-- 自定义服务商选项 -->
        <div 
          class="custom-provider-option"
          :class="{ 'is-selected': form.isCustomProvider }"
          @click="selectCustomProvider"
        >
          <el-icon :size="24"><Plus /></el-icon>
          <span class="custom-provider-label">自定义服务商</span>
          <span class="custom-provider-hint">配置不在列表中的 LLM 服务</span>
        </div>
      </div>

      <!-- 步骤2: 填写配置 -->
      <div v-if="editingConfig || currentStep === 2" class="step-content">
        <h4 v-if="!editingConfig" class="step-title">
          {{ form.isCustomProvider ? '配置自定义服务商' : `配置 ${getProviderName(form.provider)}` }}
        </h4>
        
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <!-- 编辑模式显示服务商 -->
          <el-form-item v-if="editingConfig && !isCustomProviderConfig(editingConfig.provider)" label="服务商" prop="provider">
            <el-select v-model="form.provider" style="width: 100%" disabled>
              <el-option
                v-for="provider in availableProviders"
                :key="provider.value"
                :label="provider.label"
                :value="provider.value"
              />
            </el-select>
          </el-form-item>

          <!-- 自定义服务商名称 -->
          <el-form-item 
            v-if="form.isCustomProvider || isCustomProviderConfig(editingConfig?.provider || '')" 
            label="服务商名称" 
            prop="customProviderName"
          >
            <el-input
              v-model="form.customProviderName"
              placeholder="例如：My Custom LLM"
              :disabled="!!editingConfig"
            />
            <el-text type="info" size="small" style="margin-top: 4px; display: block">
              给您的自定义服务商起一个便于识别的名称
            </el-text>
          </el-form-item>

          <!-- 自定义服务商 Base URL（必填） -->
          <el-form-item 
            v-if="form.isCustomProvider || isCustomProviderConfig(editingConfig?.provider || '')" 
            label="Base URL" 
            prop="baseURL"
          >
            <el-input
              v-model="form.baseURL"
              placeholder="https://api.example.com/v1"
            />
            <el-text type="warning" size="small" style="margin-top: 4px; display: block">
              自定义服务商必须填写 API 地址
            </el-text>
          </el-form-item>

          <el-form-item label="API Key" prop="apiKey" v-if="form.provider !== 'ollama'">
            <el-input
              v-model="form.apiKey"
              type="password"
              placeholder="输入 API Key"
              show-password
            />
          </el-form-item>

          <el-form-item label="模型" prop="model">
            <el-select
              v-model="form.model"
              placeholder="选择或输入模型名称"
              style="width: 100%"
              filterable
              allow-create
              default-first-option
            >
              <el-option
                v-for="model in getModelsForProvider(form.provider)"
                :key="model"
                :label="model"
                :value="model"
              />
            </el-select>
            <el-text v-if="form.provider === 'cursor'" type="info" size="small" style="margin-top: 4px; display: block">
              使用 "auto" 让 Cursor 自动选择最合适的模型
            </el-text>
          </el-form-item>

          <!-- 高级设置 -->
          <el-collapse v-model="showAdvanced">
            <el-collapse-item title="高级设置" name="advanced">
              <!-- 预定义服务商的 Base URL（可选） -->
              <el-form-item 
                v-if="!form.isCustomProvider && !isCustomProviderConfig(editingConfig?.provider || '')" 
                label="Base URL" 
                prop="baseURL"
              >
                <el-input
                  v-model="form.baseURL"
                  :placeholder="getDefaultBaseURL(form.provider) || '可选，留空使用默认'"
                />
              </el-form-item>

              <el-row :gutter="20">
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
                    placeholder="cursor/work (可选)"
                  />
                </el-form-item>
                <el-form-item label="自动创建 PR">
                  <el-switch v-model="form.autoCreatePr" />
                </el-form-item>
              </template>
            </el-collapse-item>
          </el-collapse>

          <el-form-item label="设为默认" prop="isActive" style="margin-top: 16px">
            <el-switch v-model="form.isActive" />
            <el-text type="info" size="small" style="margin-left: 8px">
              设为默认后，系统将优先使用此 LLM
            </el-text>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleCancel">取消</el-button>
          <el-button 
            v-if="!editingConfig && currentStep === 2" 
            @click="currentStep = 1"
          >
            上一步
          </el-button>
          <el-button 
            v-if="!editingConfig && currentStep === 1" 
            type="primary" 
            :disabled="!form.provider && !form.isCustomProvider"
            @click="currentStep = 2"
          >
            下一步
          </el-button>
          <el-button 
            v-if="editingConfig || currentStep === 2" 
            type="primary" 
            :loading="saving"
            @click="saveConfig"
          >
            {{ editingConfig ? '保存修改' : (form.isActive ? '保存并设为默认' : '保存') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Check, Plus, Setting, Edit, Delete, More } from '@element-plus/icons-vue';
import { apiClient } from '../../../api/client';

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
  createdAt?: string;
  updatedAt?: string;
}

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const llmConfigs = ref<LLMConfig[]>([]);
const showAddDialog = ref(false);
const editingConfig = ref<LLMConfig | null>(null);
const currentStep = ref(1);
const showAdvanced = ref<string[]>([]);
const formRef = ref<FormInstance>();

const form = ref({
  provider: '',
  customProviderName: '',  // 自定义服务商名称
  isCustomProvider: false, // 是否为自定义服务商
  apiKey: '',
  baseURL: '',
  model: '',
  temperature: 0.7,
  maxTokens: 8000,
  isActive: false,
  repository: '',
  branchName: '',
  autoCreatePr: true,
});

const availableProviders = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'zhipuai', label: '智谱AI' },
  { value: 'ark', label: '火山引擎 Ark (豆包)' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'qianfan', label: '百度千帆' },
  { value: 'dashscope', label: '阿里通义' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'cursor', label: 'Cursor Agent' },
];

const defaultModels: Record<string, string[]> = {
  openai: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  zhipuai: ['glm-4-flash', 'glm-4', 'glm-3-turbo'],
  ark: ['doubao-1-5-pro-32k-250115', 'doubao-pro-32k'],
  anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-v3-2'],
  gemini: ['gemini-pro', 'gemini-1.5-pro'],
  qianfan: ['ERNIE-Bot', 'ERNIE-Bot-4'],
  dashscope: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  ollama: ['llama2', 'codellama', 'mistral'],
  cursor: ['auto'],
};

const defaultBaseURLs: Record<string, string> = {
  ark: 'https://ark.cn-beijing.volces.com/api/v3',
  zhipuai: 'https://open.bigmodel.cn/api/paas/v4',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://localhost:11434',
};

const rules: FormRules = {
  provider: [{ required: true, message: '请选择服务商', trigger: 'change' }],
  customProviderName: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (form.value.isCustomProvider) {
          if (!value || value.trim() === '') {
            callback(new Error('请输入服务商名称'));
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
  apiKey: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (form.value.provider === 'ollama') {
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
  baseURL: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (form.value.isCustomProvider || isCustomProviderConfig(editingConfig.value?.provider || '')) {
          if (!value || value.trim() === '') {
            callback(new Error('自定义服务商必须填写 Base URL'));
          } else if (!value.startsWith('http://') && !value.startsWith('https://')) {
            callback(new Error('请输入有效的 URL（以 http:// 或 https:// 开头）'));
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

const defaultConfig = computed(() => {
  return llmConfigs.value.find(c => c.isActive) || null;
});

// 判断是否为自定义服务商配置
function isCustomProviderConfig(provider: string): boolean {
  return provider.startsWith('custom:');
}

// 从自定义服务商 provider 中提取名称
function getCustomProviderName(provider: string): string {
  if (isCustomProviderConfig(provider)) {
    return provider.substring(7); // 移除 "custom:" 前缀
  }
  return provider;
}

function getProviderName(provider: string): string {
  // 自定义服务商
  if (isCustomProviderConfig(provider)) {
    return getCustomProviderName(provider);
  }
  // 预定义服务商
  const found = availableProviders.find(p => p.value === provider);
  return found?.label || provider;
}

function getModelsForProvider(provider: string): string[] {
  return defaultModels[provider] || [];
}

function getDefaultBaseURL(provider: string): string {
  return defaultBaseURLs[provider] || '';
}

function maskApiKey(apiKey?: string): string {
  if (!apiKey) return '未设置';
  if (apiKey.length <= 8) return '••••••••';
  return apiKey.substring(0, 4) + '••••••••' + apiKey.substring(apiKey.length - 4);
}

function selectProvider(provider: string) {
  form.value.provider = provider;
  form.value.isCustomProvider = false;
  form.value.customProviderName = '';
  // 设置默认模型
  const models = getModelsForProvider(provider);
  if (models.length > 0) {
    form.value.model = models[0];
  } else {
    form.value.model = '';
  }
  // 设置默认 Base URL
  form.value.baseURL = getDefaultBaseURL(provider);
}

function selectCustomProvider() {
  form.value.provider = 'custom';
  form.value.isCustomProvider = true;
  form.value.customProviderName = '';
  form.value.model = '';
  form.value.baseURL = '';
}

async function fetchConfigs() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getLLMConfigs() as any;
    llmConfigs.value = response.configs || [];
  } catch (err: any) {
    error.value = err.message || '获取配置列表失败';
  } finally {
    loading.value = false;
  }
}

function editConfig(config: LLMConfig) {
  editingConfig.value = config;
  const isCustom = isCustomProviderConfig(config.provider);
  form.value = {
    provider: isCustom ? 'custom' : config.provider,
    customProviderName: isCustom ? getCustomProviderName(config.provider) : '',
    isCustomProvider: isCustom,
    apiKey: config.apiKey || '',
    baseURL: config.baseURL || '',
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    isActive: config.isActive,
    repository: config.repository || '',
    branchName: config.branchName || '',
    autoCreatePr: config.autoCreatePr ?? true,
  };
  currentStep.value = 2;
  showAddDialog.value = true;
}

function resetForm() {
  editingConfig.value = null;
  currentStep.value = 1;
  showAdvanced.value = [];
  form.value = {
    provider: '',
    customProviderName: '',
    isCustomProvider: false,
    apiKey: '',
    baseURL: '',
    model: '',
    temperature: 0.7,
    maxTokens: 8000,
    isActive: llmConfigs.value.length === 0, // 第一个自动设为默认
    repository: '',
    branchName: '',
    autoCreatePr: true,
  };
  formRef.value?.resetFields();
}

function handleCancel() {
  showAddDialog.value = false;
  resetForm();
}

async function saveConfig() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      // 确定 provider 值：自定义服务商使用 "custom:名称" 格式
      let providerValue = form.value.provider;
      if (form.value.isCustomProvider && form.value.customProviderName) {
        providerValue = `custom:${form.value.customProviderName.trim()}`;
      }

      await apiClient.createLLMConfig({
        provider: providerValue,
        apiKey: form.value.apiKey || undefined,
        baseURL: form.value.baseURL || undefined,
        model: form.value.model,
        temperature: form.value.temperature,
        maxTokens: form.value.maxTokens,
        isActive: form.value.isActive,
      });

      // 如果是 Cursor，还需要保存 Provider 配置
      if (form.value.provider === 'cursor' && form.value.repository) {
        await apiClient.saveProviderConfig({
          provider: 'cursor',
          apiKey: form.value.apiKey,
          baseURL: form.value.baseURL,
          model: form.value.model,
        });
      }

      ElMessage.success(editingConfig.value ? '配置已更新' : '配置已添加');
      showAddDialog.value = false;
      resetForm();
      await fetchConfigs();
    } catch (err: any) {
      ElMessage.error(err.message || '保存配置失败');
    } finally {
      saving.value = false;
    }
  });
}

async function setAsDefault(config: LLMConfig) {
  try {
    await apiClient.activateLLMConfig(config.id);
    ElMessage.success('已设为默认');
    await fetchConfigs();
  } catch (err: any) {
    ElMessage.error(err.message || '设置默认失败');
  }
}

async function deleteConfig(config: LLMConfig) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${getProviderName(config.provider)} 的配置吗？`,
      '确认删除',
      { type: 'warning' }
    );
    await apiClient.deleteLLMConfig(config.id);
    ElMessage.success('配置已删除');
    await fetchConfigs();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败');
    }
  }
}

onMounted(() => {
  fetchConfigs();
});
</script>

<style scoped>
.llm-config-panel {
  width: 100%;
}

.default-llm-card {
  margin-bottom: 24px;
  border: 2px solid #67c23a;
}

.default-llm-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.default-llm-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.default-llm-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #67c23a;
  font-weight: 500;
}

.default-llm-detail {
  display: flex;
  align-items: center;
  gap: 12px;
}

.default-llm-detail .provider-name {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.default-llm-detail .model-name {
  font-size: 16px;
  color: #606266;
  background: #f5f7fa;
  padding: 4px 12px;
  border-radius: 4px;
}

.empty-state-card {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.llm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.llm-card {
  transition: all 0.3s;
}

.llm-card.is-default {
  border: 2px solid #67c23a;
}

.llm-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.llm-provider-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  color: #409eff;
}

.llm-provider-info .provider-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.llm-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.config-label {
  font-size: 13px;
  color: #909399;
}

.config-value {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.config-value.api-key {
  font-family: monospace;
  color: #606266;
}

.config-value.url {
  font-size: 12px;
  color: #909399;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dialog styles */
.step-content {
  min-height: 200px;
}

.step-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  text-align: center;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.provider-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 12px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.provider-option:hover {
  border-color: #409eff;
  background: #f5f7fa;
}

.provider-option.is-selected {
  border-color: #409eff;
  background: #ecf5ff;
}

.provider-option .el-icon {
  margin-bottom: 8px;
  color: #909399;
}

.provider-option.is-selected .el-icon {
  color: #409eff;
}

.provider-label {
  font-size: 13px;
  color: #606266;
  text-align: center;
}

.provider-option.is-selected .provider-label {
  color: #409eff;
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 自定义服务商选项 */
.custom-provider-option {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 16px 20px;
  border: 2px dashed #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.custom-provider-option:hover {
  border-color: #409eff;
  background: #f5f7fa;
}

.custom-provider-option.is-selected {
  border-color: #409eff;
  border-style: solid;
  background: #ecf5ff;
}

.custom-provider-option .el-icon {
  color: #909399;
}

.custom-provider-option.is-selected .el-icon {
  color: #409eff;
}

.custom-provider-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.custom-provider-option.is-selected .custom-provider-label {
  color: #409eff;
}

.custom-provider-hint {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}
</style>
