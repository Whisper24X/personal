<template>
  <div class="project-create">
    <el-page-header @back="router.push('/')" class="page-header">
      <template #content>
        <div class="header-content">
          <span class="header-title">创建新项目</span>
          <p class="header-desc">描述您的项目想法，让 AI 帮您构建</p>
        </div>
      </template>
    </el-page-header>

    <el-card class="form-card">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="项目名称" prop="name" required>
          <el-input
            v-model="formData.name"
            placeholder="我的项目"
            :prefix-icon="Edit"
          />
        </el-form-item>

        <el-form-item label="项目想法" prop="idea" required>
          <el-input
            v-model="formData.idea"
            type="textarea"
            :rows="6"
            placeholder="详细描述您的项目想法..."
            show-word-limit
            :maxlength="2000"
          />
          <template #extra>
            <el-text type="info" size="small">
              <el-icon><InfoFilled /></el-icon>
              请具体说明功能、目标用户和需求
            </el-text>
          </template>
        </el-form-item>

        <el-form-item label="附加说明" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="任何额外的背景或限制..."
            show-word-limit
            :maxlength="1000"
          />
        </el-form-item>

        <el-form-item label="最大轮次" prop="nRound">
          <el-input-number
            v-model="formData.nRound"
            :min="1"
            :max="20"
            :step="1"
            controls-position="right"
            style="width: 100%"
          />
          <template #extra>
            <el-text type="info" size="small">
              <el-icon><Refresh /></el-icon>
              执行迭代次数
            </el-text>
          </template>
        </el-form-item>

        <el-form-item label="生成模式">
          <el-radio-group v-model="formData.mode" size="large">
            <el-radio-button value="auto">
              <div class="mode-option">
                <el-icon><Lightning /></el-icon>
                <span>自动模式</span>
              </div>
            </el-radio-button>
            <el-radio-button value="interactive">
              <div class="mode-option">
                <el-icon><UserFilled /></el-icon>
                <span>交互模式</span>
              </div>
            </el-radio-button>
          </el-radio-group>
          <template #extra>
            <el-alert
              v-if="formData.mode === 'interactive'"
              title="交互模式: 每个 SOP 步骤完成后会暂停，等待您的确认和修改"
              type="info"
              :closable="false"
              show-icon
              class="mode-alert"
            />
            <el-alert
              v-else
              title="自动模式: 项目将自动生成，无需人工干预"
              type="success"
              :closable="false"
              show-icon
              class="mode-alert"
            />
          </template>
        </el-form-item>

        <el-alert
          v-if="error"
          :title="error"
          type="error"
          :closable="false"
          show-icon
          class="error-alert"
        />

        <el-form-item class="submit-buttons">
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            :icon="MagicStick"
            @click="handleSubmit"
            style="flex: 1"
          >
            {{ loading ? '创建中...' : '创建并启动项目' }}
          </el-button>
          <el-button
            size="large"
            :icon="Close"
            @click="router.push('/')"
          >
            取消
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { storeToRefs } from 'pinia';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { 
  Edit, 
  InfoFilled, 
  Refresh, 
  MagicStick, 
  Close,
  Lightning,
  UserFilled 
} from '@element-plus/icons-vue';

const router = useRouter();
const projectStore = useProjectStore();
const { loading, error } = storeToRefs(projectStore);

const formRef = ref<FormInstance>();

const formData = reactive({
  name: '',
  idea: '',
  description: '',
  nRound: 5,
  mode: 'auto' as 'auto' | 'interactive',
});

const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 3, max: 100, message: '长度应在 3 到 100 个字符之间', trigger: 'blur' }
  ],
  idea: [
    { required: true, message: '请描述您的项目想法', trigger: 'blur' },
    { min: 10, message: '请提供更多细节（至少 10 个字符）', trigger: 'blur' }
  ],
});

async function handleSubmit() {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        // Check if interactive mode
        if (formData.mode === 'interactive') {
          ElMessage.success('启动交互式项目生成');
          
          // Navigate to interactive page
          router.push({
            path: '/project/interactive',
            query: {
              name: formData.name,
              idea: formData.idea,
              description: formData.description,
              rounds: formData.nRound.toString(),
            }
          });
        } else {
          // Automatic mode - original logic
          const project = await projectStore.createProject(formData);
          
          ElMessage.success('项目创建成功！');
          
          // Start the project
          await projectStore.startProject(project.id);
          
          ElMessage.info('项目已启动，正在生成...');
          
          // Navigate to project detail
          router.push(`/project/${project.id}`);
        }
      } catch (err: any) {
        console.error('Failed to create project:', err);
        ElMessage.error(err.message || '创建项目失败');
      }
    }
  });
}
</script>

<style scoped>
.project-create {
  max-width: 800px;
  margin: 0 auto;
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

.form-card {
  padding: 24px;
}

.error-alert {
  margin-bottom: 20px;
}

.submit-buttons {
  margin-top: 24px;
  display: flex;
  gap: 16px;
}

.submit-buttons :deep(.el-form-item__content) {
  display: flex;
  gap: 16px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
}

.mode-alert {
  margin-top: 8px;
}
</style>

