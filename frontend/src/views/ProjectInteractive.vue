<template>
  <div class="project-interactive">
    <el-page-header @back="handleBack" class="page-header">
      <template #content>
        <div class="header-content">
          <span class="header-title">
            <el-icon>
              <MagicStick />
            </el-icon>
            交互式项目生成
          </span>
          <p class="header-desc">在每个步骤人工确认和审查</p>
        </div>
      </template>
    </el-page-header>

    <!-- Project Info Card -->
    <el-card class="project-info-card">
      <div class="project-info">
        <div class="info-item">
          <el-icon>
            <Document />
          </el-icon>
          <span class="label">项目名称:</span>
          <span class="value">{{ projectName }}</span>
        </div>
        <div class="info-item">
          <el-icon>
            <Refresh />
          </el-icon>
          <span class="label">当前轮次:</span>
          <span class="value">{{ currentRound }} / {{ maxRounds }}</span>
        </div>
      </div>
    </el-card>

    <!-- Progress Timeline -->
    <el-card class="timeline-card">
      <template #header>
        <div class="card-header-content">
          <span class="card-title">
            <el-icon>
              <Timer />
            </el-icon>
            执行进度
          </span>
          <el-tag :type="getStatusType()" effect="dark">
            {{ getStatusText() }}
          </el-tag>
        </div>
      </template>

      <el-timeline>
        <el-timeline-item v-for="(step, index) in completedSteps" :key="index" :timestamp="step.timestamp"
          :type="step.userAction === 'edit' ? 'warning' : 'success'" :hollow="false">
          <el-card class="timeline-step-card">
            <div class="step-header">
              <el-tag :type="getRoleTagType(step.role)">
                {{ step.role }}
              </el-tag>
              <el-tag size="small" type="info">{{ step.action }}</el-tag>
              <el-tag v-if="step.userAction" size="small" :type="getUserActionTagType(step.userAction)">
                {{ getUserActionText(step.userAction) }}
              </el-tag>
            </div>
            <div class="step-content">
              {{ step.content }}
            </div>
            <div v-if="step.outputFiles && step.outputFiles.length > 0" class="step-files">
              <el-divider content-position="left">
                <el-icon>
                  <FolderOpened />
                </el-icon>
                生成的文件 ({{ step.outputFiles.length }})
              </el-divider>
              <div class="files-list">
                <el-tag v-for="file in step.outputFiles" :key="file.path || file" class="file-tag" type="info"
                  effect="plain">
                  <el-icon>
                    <DocumentCopy />
                  </el-icon>
                  {{ typeof file === 'string' ? file : file.path }}
                </el-tag>
              </div>
            </div>
          </el-card>
        </el-timeline-item>

        <!-- Current Step (if waiting for confirmation) -->
        <el-timeline-item v-if="currentStep" :timestamp="'正在进行'" type="primary" :hollow="true" size="large">
          <InteractiveConfirmation 
            :role-info="currentStep" 
            :loading="actionLoading" 
            :project-id="projectId"
            @action="handleUserAction" />
        </el-timeline-item>

        <!-- Running indicator -->
        <el-timeline-item v-if="isRunning && !currentStep" type="primary" :hollow="true">
          <el-card class="running-card">
            <div class="running-content">
              <el-icon class="is-loading">
                <Loading />
              </el-icon>
              <span>{{ runningRole }} 正在工作中...</span>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- Completion Card -->
    <el-card v-if="isCompleted" class="completion-card">
      <el-result icon="success" title="项目生成完成！" sub-title="所有步骤已完成，您可以查看生成的文档和代码">
        <template #extra>
          <el-space>
            <el-button type="primary" size="large" @click="viewProject">
              查看项目详情
            </el-button>
            <el-button size="large" @click="downloadProject">
              下载项目文件
            </el-button>
          </el-space>
        </template>
      </el-result>

      <el-divider />

      <div class="summary-section">
        <h3>
          <el-icon>
            <DataAnalysis />
          </el-icon>
          执行摘要
        </h3>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="总步骤数">
            {{ completedSteps.length }}
          </el-descriptions-item>
          <el-descriptions-item label="编辑次数">
            {{ editCount }}
          </el-descriptions-item>
          <el-descriptions-item label="重新生成次数">
            {{ regenerateCount }}
          </el-descriptions-item>
          <el-descriptions-item label="跳过次数">
            {{ skipCount }}
          </el-descriptions-item>
          <el-descriptions-item label="总耗时">
            {{ totalDuration }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  MagicStick,
  Document,
  Refresh,
  Timer,
  Loading,
  DataAnalysis,
  FolderOpened,
  DocumentCopy,
} from '@element-plus/icons-vue';
import InteractiveConfirmation from '../components/InteractiveConfirmation.vue';

const route = useRoute();
const router = useRouter();

// Project Info
const projectId = ref(route.params.id as string || '');
const projectName = ref(route.query.name as string || 'Untitled Project');
const maxRounds = ref(parseInt(route.query.rounds as string) || 5);
const sessionId = ref<string>('');

// State
const isRunning = ref(false);
const isCompleted = ref(false);
const currentRound = ref(0);
const actionLoading = ref(false);
const runningRole = ref('');
const startTime = ref(Date.now());

// Steps
const completedSteps = ref<any[]>([]);
const currentStep = ref<any>(null);

// Stats
const editCount = computed(() =>
  completedSteps.value.filter(s => s.userAction === 'edit').length
);
const regenerateCount = computed(() =>
  completedSteps.value.filter(s => s.userAction === 'regenerate').length
);
const skipCount = computed(() =>
  completedSteps.value.filter(s => s.userAction === 'skip').length
);
const totalDuration = computed(() => {
  const duration = Date.now() - startTime.value;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}分${seconds}秒`;
});

// WebSocket connection
let ws: WebSocket | null = null;
const WS_BASE_URL = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:3000';

onMounted(() => {
  startInteractiveSession();
});

onUnmounted(() => {
  cleanup();
});

async function startInteractiveSession() {
  try {
    isRunning.value = true;
    startTime.value = Date.now();

    // Create session via API
    const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';
    const response = await fetch(`${apiUrl}/interactive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName.value,
        idea: route.query.idea as string || '',
        description: route.query.description as string,
        investment: parseFloat(route.query.investment as string) || 10.0,
        nRound: maxRounds.value,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const data = await response.json();
    const sid = data.sessionId;
    sessionId.value = sid;
    
    // In interactive session, use sessionId as projectId if no projectId provided
    // Update projectId if provided in response
    if (data.projectId) {
      projectId.value = data.projectId;
    } else if (data.project?.id) {
      projectId.value = data.project.id;
    } else if (!projectId.value && sid) {
      // Use sessionId as projectId for interactive sessions
      projectId.value = sid;
    }

    // Connect WebSocket
    connectWebSocket(sid);
  } catch (error: any) {
    ElMessage.error('启动会话失败: ' + error.message);
    isRunning.value = false;
  }
}

function connectWebSocket(sessionId: string) {
  try {
    // Close existing connection if any
    if (ws) {
      ws.close();
      ws = null;
    }

    const wsUrl = `${WS_BASE_URL}/api/interactive/${sessionId}`;
    console.log('Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      ElMessage.success('已连接到服务器');
      isRunning.value = true;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message.type);
        handleWebSocketMessage(message);
      } catch (error: any) {
        console.error('Failed to parse WebSocket message:', error);
        ElMessage.error('解析消息失败: ' + error.message);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ElMessage.error('WebSocket 连接错误，请检查服务器是否运行');
      isRunning.value = false;
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      if (event.code !== 1000) { // Not a normal closure
        ElMessage.warning(`连接已断开 (${event.code}): ${event.reason || '未知原因'}`);
      }
      ws = null;
      // Don't set isRunning to false here, as it might be intentional
    };
  } catch (error: any) {
    console.error('Failed to create WebSocket:', error);
    ElMessage.error('创建 WebSocket 连接失败: ' + error.message);
    ws = null;
    isRunning.value = false;
  }
}

function handleWebSocketMessage(message: { type: string; data: any }) {
  switch (message.type) {
    case 'connected':
      ElMessage.success('会话已连接');
      break;

    case 'started':
      ElMessage.info('项目生成已开始');
      break;

    case 'role_start':
      runningRole.value = message.data.role || '';
      break;

    case 'confirmation_required':
      // Stop running state and show confirmation UI
      isRunning.value = false;
      runningRole.value = '';
      currentStep.value = {
        role: message.data.role,
        action: message.data.action,
        content: message.data.content,
        outputFiles: message.data.outputFiles || [],
      };
      break;

    case 'progress':
      currentRound.value = message.data.currentRound || 0;
      break;

    case 'completed':
      // Update projectId from completion message
      if (message.data.projectId) {
        projectId.value = message.data.projectId;
      } else if (sessionId.value && !projectId.value) {
        // Fallback to sessionId if no projectId in message
        projectId.value = sessionId.value;
      }
      complete();
      ElMessage.success('项目生成完成！');
      break;

    case 'error':
      ElMessage.error('错误: ' + (message.data.message || '未知错误'));
      isRunning.value = false;
      break;

    case 'info':
      ElMessage.info(message.data.message || '');
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

async function handleUserAction(action: string, modifiedContent?: string) {
  actionLoading.value = true;

  try {
    // Record the step
    const step = {
      ...currentStep.value,
      userAction: action,
      timestamp: new Date().toLocaleTimeString(),
      content: modifiedContent || currentStep.value.content,
      // Preserve outputFiles if they exist
      outputFiles: currentStep.value.outputFiles || [],
    };

    completedSteps.value.push(step);

    // Send action to backend via WebSocket
    if (!ws) {
      console.error('WebSocket is null, attempting to reconnect...');
      ElMessage.error('WebSocket 未连接，请刷新页面重试');
      actionLoading.value = false;
      return;
    }

    if (ws.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket is connecting, waiting...');
      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'user_action',
        action: action,
        modifiedContent: modifiedContent,
      };
      console.log('Sending user action to backend:', message);
      try {
        ws.send(JSON.stringify(message));
        console.log('User action sent successfully');
      } catch (error: any) {
        console.error('Failed to send message:', error);
        ElMessage.error('发送消息失败: ' + error.message);
        actionLoading.value = false;
        return;
      }
    } else {
      const stateText = ws.readyState === WebSocket.CLOSING ? '正在关闭'
        : ws.readyState === WebSocket.CLOSED ? '已关闭'
          : '未知状态';
      console.error(`WebSocket not ready, state: ${ws.readyState} (${stateText})`);
      ElMessage.error(`WebSocket 未就绪 (${stateText})，请刷新页面重试`);
      actionLoading.value = false;
      return;
    }

    // Handle UI updates
    switch (action) {
      case 'continue':
      case 'edit':
        ElMessage.success('已确认，等待下一步...');
        // Clear current step - backend will send next confirmation_required
        currentStep.value = null;
        // Set running state to show loading indicator
        isRunning.value = true;
        break;

      case 'regenerate':
        ElMessage.info('重新生成中...');
        // Keep currentStep to show regeneration in progress
        // Backend will send new confirmation_required when done
        break;

      case 'skip':
        ElMessage.warning('已跳过当前步骤');
        // Clear current step - backend will send next confirmation_required
        currentStep.value = null;
        // Set running state to show loading indicator
        isRunning.value = true;
        break;

      case 'quit':
        await handleQuit();
        return;
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + error.message);
  } finally {
    actionLoading.value = false;
  }
}

async function handleQuit() {
  isRunning.value = false;
  ElMessage.info('已保存进度并退出');

  // Save state (in production)
  setTimeout(() => {
    router.push('/');
  }, 1000);
}

function complete() {
  isRunning.value = false;
  isCompleted.value = true;
  ElMessage.success('项目生成完成！');
}

function getStatusType(): 'success' | 'warning' | 'info' | 'danger' {
  if (isCompleted.value) return 'success';
  if (isRunning.value) return 'warning';
  return 'info';
}

function getStatusText(): string {
  if (isCompleted.value) return '已完成';
  if (isRunning.value) return '进行中';
  return '等待中';
}

function getRoleTagType(role: string): 'success' | 'warning' | 'info' | 'danger' {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    Salesperson: 'info',
    ProductManager: 'success',
    Architect: 'warning',
    Engineer: 'info',
    QAEngineer: 'danger',
  };
  return typeMap[role] || 'info';
}

function getUserActionTagType(action: string): 'success' | 'warning' | 'info' | 'danger' {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    continue: 'success',
    edit: 'warning',
    regenerate: 'info',
    skip: 'danger',
  };
  return typeMap[action] || 'info';
}

function getUserActionText(action: string): string {
  const textMap: Record<string, string> = {
    continue: '✓ 已确认',
    edit: '✎ 已编辑',
    regenerate: '↻ 已重生成',
    skip: '→ 已跳过',
  };
  return textMap[action] || action;
}

function viewProject() {
  if (projectId.value) {
    router.push(`/project/${projectId.value}`);
  } else {
    ElMessage.info('项目详情功能开发中');
  }
}

function downloadProject() {
  ElMessage.info('下载功能开发中');
}

async function handleBack() {
  if (isRunning.value) {
    try {
      await ElMessageBox.confirm(
        '项目还在生成中，确定要离开吗？进度将被保存。',
        '确认离开',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      );
      cleanup();
      router.push('/');
    } catch {
      // User cancelled
    }
  } else {
    router.push('/');
  }
}

function cleanup() {
  if (ws) {
    ws.close();
    ws = null;
  }
}
</script>

<style scoped>
.project-interactive {
  max-width: 1200px;
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
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-desc {
  color: #909399;
  margin-top: 8px;
  margin-bottom: 0;
}

.project-info-card {
  margin-bottom: 20px;
}

.project-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-item .label {
  font-weight: 600;
  color: #606266;
}

.info-item .value {
  color: #303133;
  font-size: 16px;
}

.timeline-card {
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

.timeline-step-card {
  background: #f5f7fa;
}

.step-header {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.step-content {
  color: #606266;
  line-height: 1.6;
  font-size: 14px;
}

.step-files {
  margin-top: 16px;
}

.files-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.running-card {
  border: 2px dashed #409EFF;
  background: #ecf5ff;
}

.running-content {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  color: #409EFF;
  padding: 12px;
}

.running-content .el-icon {
  font-size: 24px;
}

.completion-card {
  margin-top: 24px;
  border: 2px solid #67C23A;
}

.summary-section {
  padding: 20px;
}

.summary-section h3 {
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
}

@media (max-width: 768px) {
  .project-info {
    grid-template-columns: 1fr;
  }
}
</style>
