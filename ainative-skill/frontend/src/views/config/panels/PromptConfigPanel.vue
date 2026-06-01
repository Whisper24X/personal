<template>
  <div class="prompt-config-panel">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 20px" />

      <!-- 提示词类型选择 -->
      <div class="type-selector">
        <el-radio-group v-model="selectedType" size="large">
          <el-radio-button label="mrd">市场研究文档（MRD）</el-radio-button>
          <el-radio-button label="prd">产品需求文档</el-radio-button>
          <el-radio-button label="design">系统设计</el-radio-button>
          <el-radio-button label="code">代码生成</el-radio-button>
          <el-radio-button label="test">测试用例</el-radio-button>
          <el-radio-button label="task">任务拆分</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 提示词列表 -->
      <div class="prompts-section">
        <div class="section-header">
          <h3 class="section-title">{{ typeLabels[selectedType] }}提示词</h3>
          <el-button type="primary" size="small" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建提示词
          </el-button>
        </div>

        <el-empty v-if="currentPrompts.length === 0" description="还没有配置提示词">
          <el-button type="primary" @click="showCreateDialog = true">
            创建提示词
          </el-button>
        </el-empty>

        <div v-else class="prompts-list">
          <el-card v-for="prompt in currentPrompts" :key="prompt.id" shadow="hover" class="prompt-card">
            <div class="prompt-header">
              <div class="prompt-info">
                <div class="prompt-title">
                  <el-icon><Document /></el-icon>
                  <span class="prompt-key">{{ prompt.promptKey }}</span>
                  <el-tag v-if="prompt.isActive" type="success" size="small" effect="plain">启用</el-tag>
                </div>
                <p v-if="prompt.description" class="prompt-desc">{{ prompt.description }}</p>
              </div>
              <div class="prompt-actions">
                <el-button size="small" @click="editPrompt(prompt)">编辑</el-button>
                <el-button type="danger" size="small" plain @click="deletePrompt(prompt)">删除</el-button>
              </div>
            </div>
            <div class="prompt-preview">
              <pre>{{ getPreview(prompt.content) }}</pre>
            </div>
          </el-card>
        </div>
      </div>
    </div>

    <!-- 创建/编辑提示词对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingPrompt ? '编辑提示词' : '新建提示词'"
      width="800px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="提示词键名" prop="promptKey">
          <el-select v-model="form.promptKey" placeholder="选择提示词键名" style="width: 100%">
            <el-option label="系统提示词 (system_prompt)" value="system_prompt" />
            <el-option label="模板 (template)" value="template" />
            <el-option label="审查系统提示词 (review_system_prompt)" value="review_system_prompt" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.promptKey === 'custom'" label="自定义键名" prop="customKey">
          <el-input v-model="form.customKey" placeholder="输入自定义键名" />
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="输入提示词的描述信息（可选）" />
        </el-form-item>

        <el-form-item label="提示词内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="15"
            placeholder="输入提示词内容"
            show-word-limit
            maxlength="50000"
          />
        </el-form-item>

        <el-form-item label="启用状态" prop="isActive">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePrompt">
          {{ editingPrompt ? '保存修改' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Plus, Document } from '@element-plus/icons-vue';
import { apiClient } from '../../../api/client';

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

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selectedType = ref('mrd');
const prompts = ref<Record<string, PromptConfig[]>>({});
const showCreateDialog = ref(false);
const editingPrompt = ref<PromptConfig | null>(null);
const formRef = ref<FormInstance>();

const typeLabels: Record<string, string> = {
  mrd: '市场研究文档（MRD）',
  prd: '产品需求文档',
  design: '系统设计',
  code: '代码生成',
  test: '测试用例',
  task: '任务拆分',
};

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
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
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

const currentPrompts = computed(() => {
  return prompts.value[selectedType.value] || [];
});

function getPreview(content: string): string {
  if (!content) return '';
  const preview = content.substring(0, 300);
  return content.length > 300 ? preview + '...' : preview;
}

async function fetchPrompts() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getPromptConfigsGrouped() as any;
    prompts.value = response.configs || {};
  } catch (err: any) {
    error.value = err.message || '获取提示词配置失败';
  } finally {
    loading.value = false;
  }
}

function editPrompt(prompt: PromptConfig) {
  editingPrompt.value = prompt;
  form.value = {
    promptKey: ['system_prompt', 'template', 'review_system_prompt'].includes(prompt.promptKey)
      ? prompt.promptKey
      : 'custom',
    customKey: ['system_prompt', 'template', 'review_system_prompt'].includes(prompt.promptKey)
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

      ElMessage.success(editingPrompt.value ? '提示词已更新' : '提示词已创建');
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
.prompt-config-panel {
  width: 100%;
}

.type-selector {
  margin-bottom: 24px;
}

.prompts-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt-card {
  transition: all 0.3s;
}

.prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.prompt-info {
  flex: 1;
}

.prompt-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.prompt-title .el-icon {
  color: #409eff;
}

.prompt-key {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.prompt-desc {
  font-size: 13px;
  color: #606266;
  margin: 0;
}

.prompt-actions {
  display: flex;
  gap: 8px;
}

.prompt-preview {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
}

.prompt-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
}
</style>
