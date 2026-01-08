<template>
  <div class="knowledge-base">
    <el-page-header @back="goBack" class="page-header">
      <template #content>
        <div class="header-content">
          <div class="header-left">
            <span class="header-title">知识库管理</span>
            <el-text type="info" size="small" class="project-info">
              项目: {{ projectName }}
            </el-text>
          </div>
          <div class="header-right">
            <el-button type="primary" @click="showCreateDialog = true">
              <el-icon><Plus /></el-icon>
              添加文档
            </el-button>
          </div>
        </div>
      </template>
    </el-page-header>

    <!-- 搜索栏 -->
    <el-card class="search-card">
      <el-input
        v-model="searchQuery"
        placeholder="搜索知识库文档..."
        clearable
        @input="handleSearch"
        @clear="handleSearchClear"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #append>
          <el-button :icon="Search" @click="handleSearch" :loading="searching">
            搜索
          </el-button>
        </template>
      </el-input>
    </el-card>

    <!-- 文档列表 -->
    <el-card class="documents-card">
      <template #header>
        <div class="card-header-content">
          <span class="card-title">
            <el-icon><Collection /></el-icon>
            知识库文档
          </span>
          <el-tag>{{ documents.length }}</el-tag>
        </div>
      </template>

      <el-empty v-if="documents.length === 0 && !loading" description="暂无知识库文档" :image-size="100">
        <el-button type="primary" @click="showCreateDialog = true">
          添加第一个文档
        </el-button>
      </el-empty>

      <el-loading v-if="loading" />

      <div v-else class="documents-list">
        <el-card
          v-for="doc in documents"
          :key="doc.id"
          shadow="hover"
          class="document-item"
        >
          <div class="document-header">
            <div class="document-info">
              <h3 class="document-title">{{ doc.title }}</h3>
              <el-text v-if="doc.description" type="info" size="small" class="document-description">
                {{ doc.description }}
              </el-text>
              <div class="document-meta">
                <el-tag v-if="doc.tags && doc.tags.length > 0" v-for="tag in doc.tags" :key="tag" size="small" class="tag-item">
                  {{ tag }}
                </el-tag>
                <el-tag :type="doc.isActive ? 'success' : 'info'" size="small">
                  {{ doc.isActive ? '激活' : '停用' }}
                </el-tag>
                <el-text type="info" size="small">
                  {{ formatDate(doc.createdAt) }}
                </el-text>
              </div>
            </div>
            <div class="document-actions">
              <el-button type="primary" link @click="viewDocument(doc)">
                <el-icon><View /></el-icon>
                查看
              </el-button>
              <el-button type="primary" link @click="editDocument(doc)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="danger" link @click="handleDelete(doc)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 搜索结果 -->
    <el-card v-if="searchResults.length > 0" class="search-results-card">
      <template #header>
        <div class="card-header-content">
          <span class="card-title">
            <el-icon><Search /></el-icon>
            搜索结果
          </span>
          <el-tag>{{ searchResults.length }}</el-tag>
        </div>
      </template>

      <div class="search-results-list">
        <el-card
          v-for="result in searchResults"
          :key="result.id"
          shadow="hover"
          class="search-result-item"
        >
          <div class="result-header">
            <h4 class="result-title">{{ result.title }}</h4>
            <el-tag type="success" size="small">
              相似度: {{ (result.similarity * 100).toFixed(1) }}%
            </el-tag>
          </div>
          <div v-if="result.relevantChunks && result.relevantChunks.length > 0" class="result-chunks">
            <div
              v-for="(chunk, index) in result.relevantChunks"
              :key="index"
              class="chunk-item"
            >
              <el-text size="small">{{ chunk.chunk }}</el-text>
            </div>
          </div>
          <div class="result-actions">
            <el-button type="primary" link @click="viewSearchResult(result)">
              查看完整文档
            </el-button>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingDoc ? '编辑文档' : '添加文档'"
      width="80%"
      :close-on-click-modal="false"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入文档标题" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="请输入文档描述（可选）"
          />
        </el-form-item>
        <el-form-item label="标签" prop="tags">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入标签"
            style="width: 100%"
          >
            <el-option
              v-for="tag in availableTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="15"
            placeholder="请输入文档内容"
          />
        </el-form-item>
        <el-form-item v-if="editingDoc" label="状态">
          <el-switch
            v-model="form.isActive"
            active-text="激活"
            inactive-text="停用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="saving">
          {{ editingDoc ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 查看文档对话框 -->
    <el-dialog
      v-model="showViewDialog"
      title="查看文档"
      width="80%"
    >
      <div v-if="viewingDoc" class="view-content">
        <h2>{{ viewingDoc.title }}</h2>
        <el-text v-if="viewingDoc.description" type="info" class="view-description">
          {{ viewingDoc.description }}
        </el-text>
        <div class="view-meta">
          <el-tag v-if="viewingDoc.tags && viewingDoc.tags.length > 0" v-for="tag in viewingDoc.tags" :key="tag" size="small" class="tag-item">
            {{ tag }}
          </el-tag>
          <el-text type="info" size="small">
            创建时间: {{ formatDate(viewingDoc.createdAt) }}
          </el-text>
        </div>
        <el-divider />
        <div class="view-body">
          <pre class="content-text">{{ viewingDoc.content }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="showViewDialog = false">关闭</el-button>
        <el-button type="primary" @click="editDocument(viewingDoc)">编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import {
  Plus,
  Search,
  Collection,
  View,
  Edit,
  Delete,
} from '@element-plus/icons-vue';
import { apiClient } from '../api/client';

const route = useRoute();
const router = useRouter();

const projectId = route.params.id as string;
const projectName = ref<string>('');

const documents = ref<any[]>([]);
const searchResults = ref<any[]>([]);
const loading = ref(false);
const searching = ref(false);
const saving = ref(false);
const searchQuery = ref('');

const showCreateDialog = ref(false);
const showViewDialog = ref(false);
const editingDoc = ref<any>(null);
const viewingDoc = ref<any>(null);

const form = ref({
  title: '',
  content: '',
  description: '',
  tags: [] as string[],
  isActive: true,
});

const formRef = ref<FormInstance>();

const rules: FormRules = {
  title: [
    { required: true, message: '请输入文档标题', trigger: 'blur' },
  ],
  content: [
    { required: true, message: '请输入文档内容', trigger: 'blur' },
  ],
};

const availableTags = computed(() => {
  const tags = new Set<string>();
  documents.value.forEach(doc => {
    if (doc.tags && Array.isArray(doc.tags)) {
      doc.tags.forEach((tag: string) => tags.add(tag));
    }
  });
  return Array.from(tags);
});

onMounted(async () => {
  await fetchProjectInfo();
  await fetchDocuments();
});

async function fetchProjectInfo() {
  try {
    const response = await apiClient.getProject(projectId) as any;
    projectName.value = response.project?.name || response.name || '未知项目';
  } catch (err: any) {
    console.error('Failed to fetch project info:', err);
  }
}

async function fetchDocuments() {
  loading.value = true;
  try {
    const response = await apiClient.getKnowledgeBases(projectId) as any;
    documents.value = response.documents || [];
  } catch (err: any) {
    ElMessage.error(err.message || '获取知识库文档失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  searching.value = true;
  try {
    const response = await apiClient.searchKnowledgeBase(projectId, searchQuery.value, 10) as any;
    searchResults.value = response.results || [];
    if (searchResults.value.length === 0) {
      ElMessage.info('未找到相关文档');
    }
  } catch (err: any) {
    ElMessage.error(err.message || '搜索失败');
  } finally {
    searching.value = false;
  }
}

function handleSearchClear() {
  searchQuery.value = '';
  searchResults.value = [];
}

function viewDocument(doc: any) {
  viewingDoc.value = doc;
  showViewDialog.value = true;
}

function viewSearchResult(result: any) {
  // 从文档列表中找到完整文档
  const doc = documents.value.find(d => d.id === result.id);
  if (doc) {
    viewDocument(doc);
  } else {
    // 如果不在列表中，获取完整文档
    apiClient.getKnowledgeBase(projectId, result.id).then((response: any) => {
      viewDocument(response.document);
    }).catch((err: any) => {
      ElMessage.error(err.message || '获取文档失败');
    });
  }
}

function editDocument(doc: any) {
  editingDoc.value = doc;
  form.value = {
    title: doc.title,
    content: doc.content,
    description: doc.description || '',
    tags: doc.tags || [],
    isActive: doc.isActive !== undefined ? doc.isActive : true,
  };
  showCreateDialog.value = true;
  showViewDialog.value = false;
}

function resetForm() {
  editingDoc.value = null;
  form.value = {
    title: '',
    content: '',
    description: '',
    tags: [],
    isActive: true,
  };
  formRef.value?.resetFields();
}

async function handleSubmit() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      if (editingDoc.value) {
        // 更新文档
        await apiClient.updateKnowledgeBase(projectId, editingDoc.value.id, {
          title: form.value.title,
          content: form.value.content,
          description: form.value.description,
          tags: form.value.tags,
          isActive: form.value.isActive,
        });
        ElMessage.success('文档更新成功');
      } else {
        // 创建文档
        await apiClient.createKnowledgeBase(projectId, {
          title: form.value.title,
          content: form.value.content,
          description: form.value.description,
          tags: form.value.tags,
        });
        ElMessage.success('文档创建成功');
      }
      showCreateDialog.value = false;
      resetForm();
      await fetchDocuments();
    } catch (err: any) {
      ElMessage.error(err.message || (editingDoc.value ? '更新失败' : '创建失败'));
    } finally {
      saving.value = false;
    }
  });
}

async function handleDelete(doc: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除文档"${doc.title}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await apiClient.deleteKnowledgeBase(projectId, doc.id);
    ElMessage.success('删除成功');
    await fetchDocuments();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败');
    }
  }
}

function goBack() {
  router.push(`/project/${projectId}`);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}
</script>

<style scoped>
.knowledge-base {
  max-width: 100%;
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-title {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.project-info {
  font-size: 12px;
}

.search-card {
  margin-bottom: 20px;
}

.documents-card,
.search-results-card {
  margin-bottom: 20px;
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

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.document-item {
  transition: all 0.3s;
}

.document-item:hover {
  transform: translateY(-2px);
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.document-info {
  flex: 1;
}

.document-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #303133;
}

.document-description {
  display: block;
  margin-bottom: 12px;
}

.document-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-item {
  margin-right: 4px;
}

.document-actions {
  display: flex;
  gap: 8px;
}

.search-results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-result-item {
  border-left: 4px solid #409EFF;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.result-chunks {
  margin: 12px 0;
}

.chunk-item {
  padding: 8px;
  margin-bottom: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.result-actions {
  margin-top: 12px;
}

.view-content {
  padding: 20px 0;
}

.view-content h2 {
  margin: 0 0 12px 0;
  color: #303133;
}

.view-description {
  display: block;
  margin-bottom: 16px;
}

.view-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.view-body {
  margin-top: 20px;
}

.content-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  max-height: 500px;
  overflow-y: auto;
}
</style>

