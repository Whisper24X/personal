<template>
  <div class="prompt-config">
    <el-page-header class="page-header" @back="() => router.push('/')">
      <template #content>
        <div class="header-content">
          <span class="header-title">提示词配置</span>
          <p class="header-desc">配置各类提示词模板和系统提示词</p>
        </div>
      </template>
    </el-page-header>

    <div v-loading="loading" class="content-section">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />

      <!-- 提示词类型选择 -->
      <el-card class="type-selector-card" shadow="hover">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">提示词类型</span>
          </div>
        </template>
        <el-radio-group v-model="selectedType" @change="handleTypeChange">
          <el-radio-button label="requirement">需求说明</el-radio-button>
          <el-radio-button label="prd">产品需求文档</el-radio-button>
          <el-radio-button label="design">系统设计</el-radio-button>
          <el-radio-button label="code">代码生成</el-radio-button>
          <el-radio-button label="test">测试用例</el-radio-button>
          <el-radio-button label="task">任务拆分</el-radio-button>
        </el-radio-group>
      </el-card>

      <!-- 提示词列表 -->
      <el-card class="prompts-card">
        <template #header>
          <div class="card-header-content">
            <span class="card-title">{{ typeLabels[selectedType] }}提示词配置</span>
            <el-button type="primary" @click="showCreateDialog = true">
              <el-icon>
                <Plus />
              </el-icon>
              新建提示词
            </el-button>
          </div>
        </template>

        <el-empty v-if="currentPrompts.length === 0" description="还没有配置提示词。创建您的第一个提示词配置！">
          <el-button type="primary" @click="showCreateDialog = true">
            创建提示词
          </el-button>
        </el-empty>

        <div v-else class="prompts-list">
          <el-card
            v-for="prompt in currentPrompts"
            :key="prompt.id"
            shadow="hover"
            class="prompt-card"
          >
            <div class="prompt-header">
              <div class="prompt-info">
                <h3 class="prompt-name">
                  <el-icon>
                    <Document />
                  </el-icon>
                  {{ prompt.promptKey }}
                  <el-tag v-if="prompt.isActive" type="success" size="small" effect="plain">激活</el-tag>
                </h3>
                <p v-if="prompt.description" class="prompt-desc">{{ prompt.description }}</p>
                <p class="prompt-preview">{{ getPreview(prompt.content) }}</p>
              </div>
              <div class="prompt-actions">
                <el-button size="small" @click="editPrompt(prompt)">
                  编辑
                </el-button>
                <el-button type="danger" size="small" @click="deletePrompt(prompt)">
                  删除
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
      </el-card>
    </div>

    <!-- 创建/编辑提示词对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingPrompt ? '编辑提示词' : '新建提示词'"
      width="900px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="提示词键名" prop="promptKey">
          <el-select v-model="form.promptKey" placeholder="选择提示词键名" style="width: 100%">
            <el-option label="系统提示词 (system_prompt)" value="system_prompt" />
            <el-option label="模板 (template)" value="template" />
            <el-option label="审查系统提示词 (review_system_prompt)" value="review_system_prompt" />
            <el-option label="自定义" value="custom">
              <template #default>
                <span>自定义键名</span>
              </template>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.promptKey === 'custom'" label="自定义键名" prop="customKey">
          <el-input v-model="form.customKey" placeholder="输入自定义键名" />
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="输入提示词的描述信息（可选）"
          />
        </el-form-item>

        <el-form-item label="提示词内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="20"
            placeholder="输入提示词内容"
            show-word-limit
            maxlength="50000"
          />
        </el-form-item>

        <el-form-item label="激活状态" prop="isActive">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePrompt">
          {{ editingPrompt ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Plus, Document } from '@element-plus/icons-vue';
import { apiClient } from '../api/client';

interface PromptConfig {
  id: string;
  promptType: string;
  promptKey: string;
  content: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selectedType = ref<string>('requirement');
const prompts = ref<Record<string, PromptConfig[]>>({});
const showCreateDialog = ref(false);
const editingPrompt = ref<PromptConfig | null>(null);
const formRef = ref<FormInstance>();

const typeLabels: Record<string, string> = {
  requirement: '需求说明',
  prd: '产品需求文档',
  design: '系统设计',
  code: '代码生成',
  test: '测试用例',
  task: '任务拆分',
};

const currentPrompts = computed(() => {
  return prompts.value[selectedType.value] || [];
});

const form = ref({
  promptKey: 'system_prompt',
  customKey: '',
  content: '',
  description: '',
  isActive: true,
});

const rules: FormRules = {
  promptKey: [{ required: true, message: '请选择提示词键名', trigger: 'change' }],
  customKey: [
    {
      validator: (rule, value, callback) => {
        if (form.value.promptKey === 'custom' && (!value || value.trim() === '')) {
          callback(new Error('请输入自定义键名'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  content: [{ required: true, message: '请输入提示词内容', trigger: 'blur' }],
};

function getPreview(content: string): string {
  if (!content) return '';
  const preview = content.substring(0, 200);
  return content.length > 200 ? preview + '...' : preview;
}

async function fetchPrompts() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getPromptConfigsGrouped();
    prompts.value = response.configs || {};
  } catch (err: any) {
    error.value = err.message || '获取提示词配置失败';
  } finally {
    loading.value = false;
  }
}

function handleTypeChange() {
  // Type changed, prompts will be updated via computed property
}

function editPrompt(prompt: PromptConfig) {
  editingPrompt.value = prompt;
  form.value = {
    promptKey: prompt.promptKey === 'system_prompt' || prompt.promptKey === 'template' || prompt.promptKey === 'review_system_prompt'
      ? prompt.promptKey
      : 'custom',
    customKey: prompt.promptKey === 'system_prompt' || prompt.promptKey === 'template' || prompt.promptKey === 'review_system_prompt'
      ? ''
      : prompt.promptKey,
    content: prompt.content,
    description: prompt.description || '',
    isActive: prompt.isActive,
  };
  showCreateDialog.value = true;
}

function resetForm() {
  editingPrompt.value = null;
  form.value = {
    promptKey: 'system_prompt',
    customKey: '',
    content: '',
    description: '',
    isActive: true,
  };
  formRef.value?.resetFields();
}

async function savePrompt() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      const promptKey = form.value.promptKey === 'custom' ? form.value.customKey : form.value.promptKey;
      
      await apiClient.savePromptConfig({
        promptType: selectedType.value,
        promptKey,
        content: form.value.content,
        description: form.value.description || undefined,
        isActive: form.value.isActive,
      });
      
      ElMessage.success(editingPrompt.value ? '提示词更新成功' : '提示词创建成功');
      showCreateDialog.value = false;
      resetForm();
      await fetchPrompts();
    } catch (err: any) {
      ElMessage.error(err.message || '保存提示词失败');
    } finally {
      saving.value = false;
    }
  });
}

async function deletePrompt(prompt: PromptConfig) {
  try {
    await ElMessageBox.confirm('确定要删除此提示词配置吗？', '确认删除', {
      type: 'warning',
    });
    await apiClient.deletePromptConfig(prompt.promptType, prompt.promptKey);
    ElMessage.success('提示词已删除');
    await fetchPrompts();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除提示词失败');
    }
  }
}

onMounted(() => {
  fetchPrompts();
});
</script>

<style scoped>
.prompt-config {
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

.type-selector-card {
  margin-bottom: 24px;
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

.prompts-card {
  margin-bottom: 24px;
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prompt-card {
  transition: all 0.3s;
}

.prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.prompt-info {
  flex: 1;
}

.prompt-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.prompt-desc {
  color: #606266;
  margin: 0 0 8px 0;
}

.prompt-preview {
  color: #909399;
  margin: 0;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

.prompt-actions {
  display: flex;
  gap: 8px;
}
</style>

