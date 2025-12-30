<template>
  <div class="llm-config">
    <el-page-header class="page-header" @back="() => router.push('/')">
      <template #content>
        <div class="header-content">
          <span class="header-title">LLM 配置</span>
          <p class="header-desc">配置大模型提供商和 API Key</p>
        </div>
      </template>
    </el-page-header>

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

      <!-- 配置列表 -->
      <el-card class="configs-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">系统默认 LLM 配置</span>
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
          <el-select v-model="form.provider" placeholder="选择提供商" style="width: 100%">
            <el-option label="OpenAI" value="openai" />
            <el-option label="智谱AI (ZhipuAI)" value="zhipuai" />
            <el-option label="火山引擎 Ark (豆包)" value="ark" />
            <el-option label="Anthropic Claude" value="anthropic" />
            <el-option label="Google Gemini" value="gemini" />
            <el-option label="百度千帆" value="qianfan" />
            <el-option label="阿里通义" value="dashscope" />
            <el-option label="Ollama" value="ollama" />
        <el-option label="Cursor Agent" value="cursor" />
          </el-select>
        </el-form-item>

        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="form.apiKey"
            type="password"
            placeholder="输入 API Key"
            show-password
            :disabled="form.provider === 'ollama'"
          />
          <el-text v-if="form.provider === 'ollama'" type="info" size="small" style="margin-top: 4px; display: block">
            Ollama 不需要 API Key
          </el-text>
        </el-form-item>

        <el-form-item label="Base URL" prop="baseURL">
          <el-input
            v-model="form.baseURL"
            placeholder="可选，留空使用默认 URL"
          />
        </el-form-item>

        <el-form-item label="模型" prop="model">
          <el-input v-model="form.model" placeholder="例如: gpt-4-turbo, glm-4-flash" />
          <el-text v-if="form.provider === 'cursor'" type="info" size="small" style="margin-top: 4px; display: block">
            使用 "auto" 让 Cursor 自动选择最合适的模型
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
                :format-tooltip="(val) => val.toFixed(1)"
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Check, Plus, Setting, User } from '@element-plus/icons-vue';
import { apiClient } from '../api/client';

interface LLMConfig {
  id: string;
  provider: string;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const configs = ref<LLMConfig[]>([]);
const activeConfig = ref<LLMConfig | null>(null);
const showCreateDialog = ref(false);
const editingConfig = ref<LLMConfig | null>(null);
const formRef = ref<FormInstance>();

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

const rules: FormRules = {
  provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
  model: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
  apiKey: [
    {
      validator: (rule, value, callback) => {
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

// 监听提供商变化，自动填充默认模型
watch(() => form.value.provider, (newProvider) => {
  if (!editingConfig.value && defaultModels[newProvider]) {
    form.value.model = defaultModels[newProvider];
  }
});

async function fetchConfigs() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getLLMConfigs();
    configs.value = response.configs || [];
    
    // 获取激活配置
    const activeResponse = await apiClient.getActiveLLMConfig();
    activeConfig.value = activeResponse.config || null;
  } catch (err: any) {
    error.value = err.message || '获取配置列表失败';
  } finally {
    loading.value = false;
  }
}

async function editConfig(config: LLMConfig) {
  try {
    // 获取完整的配置信息（包括 API Key）
    const response = await apiClient.getLLMConfigByProvider(config.provider);
    const fullConfig = response.config;
    
    editingConfig.value = fullConfig;
    form.value = {
      provider: fullConfig.provider,
      apiKey: fullConfig.apiKey || '',
      baseURL: fullConfig.baseURL || '',
      model: fullConfig.model,
      temperature: fullConfig.temperature,
      maxTokens: fullConfig.maxTokens,
      isActive: fullConfig.isActive,
      repository: fullConfig.repository || '',
      branchName: fullConfig.branchName || '',
      autoCreatePr: fullConfig.autoCreatePr ?? true,
    };
    showCreateDialog.value = true;
  } catch (err: any) {
    ElMessage.error(err.message || '获取配置详情失败');
  }
}

function resetForm() {
  editingConfig.value = null;
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
  formRef.value?.resetFields();
}

async function saveConfig() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      // Both create and update use the same endpoint (upsert)
      await apiClient.createLLMConfig(form.value);
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
</style>

