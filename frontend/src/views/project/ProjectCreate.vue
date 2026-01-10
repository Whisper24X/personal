<template>
  <div class="project-create">
    <PageHeader
      title="创建新项目"
      description="描述您的项目想法，让 AI 帮您构建"
      :back-handler="handleBack"
    />

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

        <el-form-item label="所属应用" prop="applicationId">
          <el-select
            v-model="formData.applicationId"
            placeholder="选择应用（可选）"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="app in applications"
              :key="app.id"
              :label="app.name"
              :value="app.id"
            >
              <div style="display: flex; justify-content: space-between;">
                <span>{{ app.name }}</span>
                <span style="color: #909399; font-size: 12px;">
                  {{ app.projectCount }} 个项目
                </span>
              </div>
            </el-option>
          </el-select>
          <template #extra>
            <el-text type="info" size="small">
              <el-icon><InfoFilled /></el-icon>
              选择应用后，新项目将使用该应用的历史PRD进行RAG增强
            </el-text>
          </template>
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
            @click="handleBack"
          >
            取消
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useProjectStore } from '../../stores/project';
import { useApplicationStore } from '../../stores/application';
import { storeToRefs } from 'pinia';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import PageHeader from '../../components/common/PageHeader.vue';
import { 
  Edit, 
  InfoFilled, 
  Refresh, 
  MagicStick, 
  Close
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const applicationStore = useApplicationStore();
const { loading, error } = storeToRefs(projectStore);
const { applications } = storeToRefs(applicationStore);

const formRef = ref<FormInstance>();

const formData = reactive({
  name: '',
  idea: '',
  description: '',
  nRound: 5,
  applicationId: '',
});

onMounted(async () => {
  // 如果URL中有applicationId参数，设置默认应用
  const applicationId = route.query.applicationId as string;
  if (applicationId) {
    formData.applicationId = applicationId;
  }
  
  // 加载应用列表
  await applicationStore.fetchApplications();
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

function handleBack() {
  const applicationId = route.query.applicationId as string;
  if (applicationId) {
    router.push(`/application/${applicationId}`);
  } else {
    router.push('/');
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        // Create project in database first
        const project = await projectStore.createProject({
          name: formData.name,
          idea: formData.idea,
          description: formData.description || undefined,
          nRound: formData.nRound,
          applicationId: formData.applicationId || undefined,
        });
        
        ElMessage.success('项目创建成功，启动交互式项目生成');
        
        // Navigate to interactive page with project ID
        const query: Record<string, string> = {
          id: project.id,
          name: formData.name,
          idea: formData.idea,
          description: formData.description,
          rounds: formData.nRound.toString(),
        };
        if (formData.applicationId) {
          query.applicationId = formData.applicationId;
        }
        router.push({
          path: '/project/interactive',
          query
        });
      } catch (err: any) {
        console.error('Failed to create project:', err);
        // Handle duplicate project name error
        if (err.status === 409 || err.error === 'Duplicate project name') {
          ElMessage.error(err.message || '项目名称已存在，请使用不同的名称');
        } else {
          ElMessage.error(err.message || '创建项目失败');
        }
      }
    }
  });
}
</script>

<style scoped>
.project-create {
  width: 100%;
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
</style>

