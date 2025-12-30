<template>
  <div class="role-llm-config">
    <el-page-header class="page-header" @back="() => router.push('/config/llm')">
      <template #content>
        <div class="header-content">
          <span class="header-title">角色 LLM 配置</span>
          <p class="header-desc">为每个角色配置专属的大模型提供商</p>
        </div>
      </template>
    </el-page-header>

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
            placeholder="选择提供商"
            style="width: 100%"
            @change="onProviderChange"
          >
            <el-option label="OpenAI" value="openai" />
            <el-option label="智谱AI (ZhipuAI)" value="zhipuai" />
            <el-option label="火山引擎 Ark (豆包)" value="ark" />
            <el-option label="Cursor Agent" value="cursor" />
            <el-option label="Anthropic Claude" value="anthropic" />
            <el-option label="Google Gemini" value="gemini" />
            <el-option label="百度千帆" value="qianfan" />
            <el-option label="阿里通义" value="dashscope" />
            <el-option label="Ollama" value="ollama" />
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

        <el-form-item v-if="form.provider !== 'cursor'" label="Base URL" prop="baseURL">
          <el-input
            v-model="form.baseURL"
            placeholder="可选，留空使用默认 URL"
          />
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
          <el-input
            v-model="form.model"
            placeholder="例如: gpt-4-turbo, glm-4-flash, auto"
          />
          <el-text v-if="form.provider === 'cursor'" type="info" size="small" style="margin-top: 4px; display: block">
            使用 "auto" 让 Cursor 自动选择最合适的模型
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
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { User, Plus, Edit, Delete } from '@element-plus/icons-vue';
import { apiClient } from '../api/client';

interface Role {
  profile: string;
  name: string;
  description: string;
  goal: string;
}

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

// 定义所有角色
const roles: Role[] = [
  {
    profile: 'Salesperson',
    name: '销售',
    description: '需求收集、市场调研',
    goal: '收集用户需求并编写需求说明文档',
  },
  {
    profile: 'ProductManager',
    name: '产品经理',
    description: 'PRD编写、需求分析',
    goal: '基于需求说明文档编写产品需求文档（PRD）',
  },
  {
    profile: 'Architect',
    name: '架构师',
    description: '系统设计、架构规划',
    goal: '基于PRD设计系统架构和技术方案',
  },
  {
    profile: 'ProjectManager',
    name: '项目经理',
    description: '任务拆分、项目管理',
    goal: '将项目拆分为可执行的任务',
  },
  {
    profile: 'Engineer',
    name: '工程师',
    description: '代码实现',
    goal: '根据设计文档和任务拆分实现代码',
  },
  {
    profile: 'QAEngineer',
    name: 'QA工程师',
    description: '测试编写与执行',
    goal: '编写和执行测试用例',
  },
];

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const roleConfigs = ref<Record<string, RoleLLMConfig>>({});
const showConfigDialog = ref(false);
const currentRole = ref<Role | null>(null);
const formRef = ref<FormInstance>();

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
  repository: [
    {
      validator: (rule, value, callback) => {
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
  if (defaultModels[newProvider]) {
    form.value.model = defaultModels[newProvider];
  }
  
  // 重置 Cursor 特定字段
  if (newProvider !== 'cursor') {
    form.value.repository = '';
    form.value.branchName = '';
    form.value.autoCreatePr = true;
  }
});

function onProviderChange() {
  // 当切换提供商时，重置相关字段
  if (form.value.provider !== 'cursor') {
    form.value.repository = '';
    form.value.branchName = '';
  }
}

async function fetchRoleConfigs() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getRoleLLMConfigs();
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
  } else {
    resetForm();
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
      await apiClient.saveRoleLLMConfig(currentRole.value.profile, form.value);
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
    await ElMessageBox.confirm(
      `确定要清除 ${roles.find(r => r.profile === profile)?.name} 的 LLM 配置吗？清除后将使用系统默认 LLM。`,
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

onMounted(() => {
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

