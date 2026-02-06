<template>
  <el-dialog v-model="dialogVisible" title="版本审查" width="800px" :close-on-click-modal="false" :close-on-press-escape="false" @close="handleClose">
    <div v-loading="loading" class="review-dialog">
      <!-- 进度显示 -->
      <div class="review-progress">
        <el-steps :active="currentRound - 1" finish-status="success" align-center>
          <el-step title="业务规则" />
          <el-step title="功能冲突" />
          <el-step title="术语一致性" />
          <el-step title="数据模型" />
          <el-step title="综合确认" />
        </el-steps>
        <div class="progress-text">
          <el-text type="info">第 {{ currentRound }} / {{ totalRounds }} 轮</el-text>
        </div>
      </div>

      <el-divider />

      <!-- 状态显示 -->
      <div v-if="status === 'pending'" class="status-message">
        <el-alert type="info" :closable="false" show-icon>
          <template #title>
            <div class="status-content">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在启动版本审查，请稍候...</span>
            </div>
          </template>
        </el-alert>
      </div>

      <div v-else-if="status === 'generating_question'" class="status-message">
        <el-alert type="info" :closable="false" show-icon>
          <template #title>
            <div class="status-content">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在生成问题，请稍候...</span>
            </div>
          </template>
        </el-alert>
      </div>

      <div v-else-if="status === 'waiting_answer'" class="question-section">
        <!-- 当前问题 -->
        <div class="question-card">
          <div class="question-header">
            <el-tag type="primary" size="large">{{ getQuestionTypeLabel(currentQuestion?.questionType) }}</el-tag>
            <el-text type="info" size="small">问题 {{ currentRound }} / {{ totalRounds }}</el-text>
          </div>
          <div class="question-content">
            <MarkdownRenderer :content="currentQuestion?.question || ''" />
          </div>
        </div>

        <!-- 答案输入 -->
        <div class="answer-section">
          <el-form-item label="您的回答" required>
            <el-input v-model="answer" type="textarea" :rows="6" placeholder="请输入您的回答..." show-word-limit :maxlength="2000" />
          </el-form-item>
        </div>
      </div>

      <div v-else-if="status === 'generating_document'" class="status-message">
        <el-alert type="success" :closable="false" show-icon>
          <template #title>
            <div class="status-content">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>所有问题已完成，正在生成审查文档...</span>
            </div>
          </template>
        </el-alert>
      </div>

      <div v-else-if="status === 'completed'" class="status-message">
        <el-alert type="success" :closable="false" show-icon>
          <template #title>
            <div class="status-content">
              <el-icon><Check /></el-icon>
              <span>版本审查已完成！</span>
            </div>
          </template>
        </el-alert>
        <div v-if="reviewDocumentPath" class="document-info">
          <el-text type="info">审查文档已生成</el-text>
        </div>
      </div>

      <div v-else-if="status === 'failed'" class="status-message">
        <el-alert type="error" :closable="false" show-icon>
          <template #title>
            <div class="status-content">
              <span>审查失败：{{ error || '未知错误' }}</span>
            </div>
          </template>
        </el-alert>
      </div>

      <!-- 历史问答记录 -->
      <div v-if="questionsAndAnswers.length > 0 && status !== 'completed'" class="history-section">
        <el-divider />
        <div class="history-header">
          <el-text type="info" size="small">已回答的问题</el-text>
        </div>
        <el-scrollbar max-height="200px">
          <div v-for="(qa, index) in questionsAndAnswers.slice(0, -1)" :key="index" class="history-item">
            <div class="history-question">
              <el-tag size="small" type="info">{{ getQuestionTypeLabel(qa.questionType) }}</el-tag>
              <MarkdownRenderer :content="qa.question" />
            </div>
            <div class="history-answer">
              <el-text type="success" size="small">回答：</el-text>
              <MarkdownRenderer :content="qa.answer || '（未回答）'" />
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="status === 'completed' || status === 'failed'" @click="handleClose"> 关闭 </el-button>
        <el-button
          v-else-if="status === 'waiting_answer'"
          type="primary"
          :loading="submitting"
          :disabled="!answer.trim()"
          @click="handleSubmitAnswer"
        >
          提交答案
        </el-button>
        <el-button v-else disabled>
          {{ status === 'pending' ? '正在启动审查...' : '等待中...' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading, Check } from '@element-plus/icons-vue';
import { apiClient } from '../../../api/client';
import MarkdownRenderer from '../../../components/common/MarkdownRenderer.vue';

const props = defineProps<{
  modelValue: boolean;
  platformId: string;
  versionId: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'completed'): void;
}>();

const dialogVisible = ref(props.modelValue);
const loading = ref(false);
const submitting = ref(false);
const answer = ref('');

// 审查状态
const status = ref<'pending' | 'generating_question' | 'waiting_answer' | 'generating_document' | 'completed' | 'failed'>('pending');
const currentRound = ref(0);
const totalRounds = ref(5);
const currentQuestion = ref<{ question: string; questionType: string } | null>(null);
const questionsAndAnswers = ref<Array<{ question: string; answer: string; questionType: string }>>([]);
const reviewDocumentPath = ref<string | null>(null);
const error = ref<string | null>(null);

let pollingInterval: ReturnType<typeof setInterval> | null = null;

// 添加对 versionId 的 watch，确保当 versionId 更新时也能启动轮询
watch(
  () => props.versionId,
  (newVersionId, oldVersionId) => {
    console.log('VersionReviewDialog versionId changed:', {
      old: oldVersionId,
      new: newVersionId,
      dialogVisible: dialogVisible.value,
    });

    // 如果对话框已显示且有有效的 versionId，启动轮询
    if (dialogVisible.value && newVersionId) {
      console.log('Starting polling due to versionId change');
      startPolling();
    }
  }
);

watch(
  () => props.modelValue,
  (val) => {
    console.log('VersionReviewDialog modelValue changed:', val);
    dialogVisible.value = val;
    if (val) {
      // 如果 versionId 已存在，立即启动轮询
      if (props.versionId) {
        console.log('Starting polling for review status');
        startPolling();
      } else {
        console.log('Waiting for versionId to be set');
      }
    } else {
      console.log('Stopping polling (dialog closed)');
      stopPolling();
    }
  }
);

watch(dialogVisible, (val) => {
  console.log('VersionReviewDialog dialogVisible changed:', val);
  emit('update:modelValue', val);
  if (!val) {
    stopPolling();
  }
});

const questionTypeLabels: Record<string, string> = {
  business_rules: '业务规则',
  feature_conflict: '功能冲突',
  terminology: '术语一致性',
  data_model: '数据模型',
  final_confirmation: '综合确认',
};

function getQuestionTypeLabel(questionType?: string): string {
  return questionType ? questionTypeLabels[questionType] || questionType : '';
}

async function fetchReviewStatus() {
  console.log('Fetching review status for version:', props.versionId);
  try {
    loading.value = true;
    const response = await apiClient.getVersionReviewStatus(props.platformId, props.versionId);
    console.log('Review status response:', response);

    if (response.success && response.data) {
      status.value = response.data.status;
      currentRound.value = response.data.currentRound || 0;
      totalRounds.value = response.data.totalRounds || 5;
      currentQuestion.value = response.data.currentQuestion;
      questionsAndAnswers.value = response.data.questionsAndAnswers || [];
      reviewDocumentPath.value = response.data.reviewDocumentPath;
      error.value = response.data.error;

      console.log('Review status updated:', {
        status: status.value,
        currentRound: currentRound.value,
        hasQuestion: !!currentQuestion.value,
      });

      // 如果审查完成，停止轮询
      if (status.value === 'completed' || status.value === 'failed') {
        stopPolling();
        if (status.value === 'completed') {
          emit('completed');
        }
      }
    }
  } catch (err: any) {
    console.error('Failed to fetch review status:', err);
    ElMessage.error('获取审查状态失败：' + (err.message || '未知错误'));
  } finally {
    loading.value = false;
  }
}

async function handleSubmitAnswer() {
  if (!answer.value.trim()) {
    ElMessage.warning('请输入答案');
    return;
  }

  try {
    submitting.value = true;
    await apiClient.submitVersionReviewAnswer(props.platformId, props.versionId, answer.value);
    ElMessage.success('答案已提交');
    answer.value = '';
    // 继续轮询状态
    await fetchReviewStatus();
  } catch (err: any) {
    console.error('Failed to submit answer:', err);
    ElMessage.error('提交答案失败：' + (err.message || '未知错误'));
  } finally {
    submitting.value = false;
  }
}

function startPolling() {
  // 立即获取一次状态
  fetchReviewStatus();

  // 每2秒轮询一次
  pollingInterval = setInterval(() => {
    if (status.value !== 'completed' && status.value !== 'failed') {
      fetchReviewStatus();
    }
  }, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function handleClose() {
  dialogVisible.value = false;
}

onMounted(() => {
  if (dialogVisible.value) {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.review-dialog {
  min-height: 400px;
}

.review-progress {
  margin-bottom: 20px;
}

.progress-text {
  text-align: center;
  margin-top: 10px;
}

.status-message {
  margin: 20px 0;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-section {
  margin: 20px 0;
}

.question-card {
  background: var(--el-bg-color-page);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.question-content {
  font-size: 15px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}

.answer-section {
  margin-top: 20px;
}

.history-section {
  margin-top: 20px;
}

.history-header {
  margin-bottom: 12px;
}

.history-item {
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
  margin-bottom: 8px;
}

.history-question {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 500;
}

.history-question :deep(.markdown-renderer) {
  flex: 1;
}

.history-answer {
  margin-left: 28px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.history-answer :deep(.markdown-renderer) {
  display: inline-block;
  width: 100%;
}

.document-info {
  margin-top: 12px;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
