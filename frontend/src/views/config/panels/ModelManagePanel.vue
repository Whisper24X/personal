<template>
  <div class="model-manage-panel">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 20px" />

      <!-- Header with add button -->
      <div class="panel-header">
        <h3 class="section-title">模型管理</h3>
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon><Plus /></el-icon>
          添加模型
        </el-button>
      </div>

      <el-text type="info" style="display: block; margin-bottom: 20px">
        管理各 LLM 服务商可用的模型列表。这里配置的模型会出现在 LLM 配置的模型下拉列表中。
      </el-text>

      <!-- Models grouped by provider -->
      <el-collapse v-model="activeProviders">
        <el-collapse-item
          v-for="provider in availableProviders"
          :key="provider.value"
          :name="provider.value"
        >
          <template #title>
            <div class="provider-collapse-title">
              <span class="provider-name">{{ provider.label }}</span>
              <el-tag size="small" type="info">
                {{ getModelCount(provider.value) }} 个模型
              </el-tag>
            </div>
          </template>

          <div class="model-list">
            <el-table
              :data="getModelsForProvider(provider.value)"
              style="width: 100%"
              size="small"
            >
              <el-table-column prop="modelName" label="模型名称" min-width="200">
                <template #default="{ row }">
                  <code>{{ row.modelName }}</code>
                </template>
              </el-table-column>
              <el-table-column prop="displayName" label="显示名称" min-width="150">
                <template #default="{ row }">
                  {{ row.displayName || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="isDefault" label="默认" width="80" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.isDefault" type="success" size="small">默认</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="sortOrder" label="排序" width="80" align="center" />
              <el-table-column label="操作" width="150" align="center">
                <template #default="{ row }">
                  <el-button-group size="small">
                    <el-button @click="editModel(row)">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                    <el-button 
                      type="danger" 
                      @click="deleteModel(row)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>

            <el-empty 
              v-if="getModelCount(provider.value) === 0" 
              description="暂无模型"
            >
              <el-button size="small" @click="openAddDialogForProvider(provider.value)">
                添加模型
              </el-button>
            </el-empty>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- Add/Edit Model Dialog -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingModel ? '编辑模型' : '添加模型'"
      width="500px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="服务商" prop="provider">
          <el-select
            v-model="form.provider"
            placeholder="选择服务商"
            style="width: 100%"
            :disabled="!!editingModel"
          >
            <el-option
              v-for="provider in availableProviders"
              :key="provider.value"
              :label="provider.label"
              :value="provider.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="模型名称" prop="modelName">
          <el-input
            v-model="form.modelName"
            placeholder="例如：gpt-4-turbo"
            :disabled="!!editingModel"
          />
          <el-text type="info" size="small" style="margin-top: 4px; display: block">
            模型的 API 调用名称，需与服务商 API 一致
          </el-text>
        </el-form-item>

        <el-form-item label="显示名称" prop="displayName">
          <el-input
            v-model="form.displayName"
            placeholder="例如：GPT-4 Turbo（可选）"
          />
          <el-text type="info" size="small" style="margin-top: 4px; display: block">
            用户友好的显示名称，留空则使用模型名称
          </el-text>
        </el-form-item>

        <el-form-item label="排序" prop="sortOrder">
          <el-input-number
            v-model="form.sortOrder"
            :min="0"
            :max="999"
            style="width: 100%"
          />
          <el-text type="info" size="small" style="margin-top: 4px; display: block">
            数值越小越靠前
          </el-text>
        </el-form-item>

        <el-form-item label="设为默认" prop="isDefault">
          <el-switch v-model="form.isDefault" />
          <el-text type="info" size="small" style="margin-left: 8px">
            该服务商的默认推荐模型
          </el-text>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showAddDialog = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveModel">
            {{ editingModel ? '保存修改' : '添加' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Plus, Edit, Delete } from '@element-plus/icons-vue';
import { apiClient } from '../../../api/client';

interface LLMModel {
  id: string;
  provider: string;
  modelName: string;
  displayName: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const models = ref<Record<string, LLMModel[]>>({});
const showAddDialog = ref(false);
const editingModel = ref<LLMModel | null>(null);
const activeProviders = ref<string[]>([]);
const formRef = ref<FormInstance>();

const form = ref({
  provider: '',
  modelName: '',
  displayName: '',
  sortOrder: 0,
  isDefault: false,
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

const rules: FormRules = {
  provider: [{ required: true, message: '请选择服务商', trigger: 'change' }],
  modelName: [
    { required: true, message: '请输入模型名称', trigger: 'blur' },
    { min: 1, max: 100, message: '模型名称长度在 1 到 100 个字符', trigger: 'blur' },
  ],
  displayName: [
    { max: 100, message: '显示名称长度不能超过 100 个字符', trigger: 'blur' },
  ],
};

function getModelsForProvider(provider: string): LLMModel[] {
  return models.value[provider] || [];
}

function getModelCount(provider: string): number {
  return getModelsForProvider(provider).length;
}

function openAddDialogForProvider(provider: string) {
  form.value.provider = provider;
  showAddDialog.value = true;
}

function editModel(model: LLMModel) {
  editingModel.value = model;
  form.value = {
    provider: model.provider,
    modelName: model.modelName,
    displayName: model.displayName || '',
    sortOrder: model.sortOrder,
    isDefault: model.isDefault,
  };
  showAddDialog.value = true;
}

function resetForm() {
  editingModel.value = null;
  form.value = {
    provider: '',
    modelName: '',
    displayName: '',
    sortOrder: 0,
    isDefault: false,
  };
  formRef.value?.resetFields();
}

async function fetchModels() {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.getLLMModels() as any;
    if (response.models) {
      // Transform the API response
      const transformedModels: Record<string, LLMModel[]> = {};
      for (const [provider, modelList] of Object.entries(response.models)) {
        transformedModels[provider] = (modelList as any[]).map(m => ({
          id: m.id,
          provider: m.provider,
          modelName: m.model_name,
          displayName: m.display_name,
          isDefault: m.is_default,
          sortOrder: m.sort_order,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
        }));
      }
      models.value = transformedModels;
      
      // Open all providers that have models
      activeProviders.value = Object.keys(transformedModels).filter(
        p => transformedModels[p].length > 0
      );
    }
  } catch (err: any) {
    error.value = err.message || '获取模型列表失败';
  } finally {
    loading.value = false;
  }
}

async function saveModel() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      if (editingModel.value) {
        // Update existing model
        await apiClient.updateLLMModel(editingModel.value.id, {
          displayName: form.value.displayName || undefined,
          isDefault: form.value.isDefault,
          sortOrder: form.value.sortOrder,
        });
        ElMessage.success('模型已更新');
      } else {
        // Create new model
        await apiClient.createLLMModel({
          provider: form.value.provider,
          modelName: form.value.modelName,
          displayName: form.value.displayName || undefined,
          isDefault: form.value.isDefault,
          sortOrder: form.value.sortOrder,
        });
        ElMessage.success('模型已添加');
      }
      
      showAddDialog.value = false;
      resetForm();
      await fetchModels();
    } catch (err: any) {
      ElMessage.error(err.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

async function deleteModel(model: LLMModel) {
  try {
    await ElMessageBox.confirm(
      `确定要删除模型 "${model.displayName || model.modelName}" 吗？`,
      '确认删除',
      { type: 'warning' }
    );
    
    await apiClient.deleteLLMModel(model.id);
    ElMessage.success('模型已删除');
    await fetchModels();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败');
    }
  }
}

onMounted(() => {
  fetchModels();
});
</script>

<style scoped>
.model-manage-panel {
  width: 100%;
}

.panel-header {
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

.provider-collapse-title {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.provider-collapse-title .provider-name {
  font-weight: 500;
  font-size: 15px;
}

.model-list {
  padding: 8px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.el-collapse-item__header) {
  font-size: 14px;
}

:deep(.el-table code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
