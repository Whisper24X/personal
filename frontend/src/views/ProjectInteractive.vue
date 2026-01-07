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
      <!-- Current Input Display -->
      <el-divider v-if="userIdea" />
      <div v-if="userIdea" class="user-input-section">
        <div class="user-input-header">
          <el-icon>
            <Edit />
          </el-icon>
          <span class="user-input-label">当前输入:</span>
        </div>
        <div class="user-input-content">
          {{ userIdea }}
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
            <!-- Role and Action Description -->
            <div v-if="getRoleDescription(step.role) || getActionDescription(step.action)" class="step-description">
              <div v-if="getRoleDescription(step.role)" class="description-item">
                <el-icon>
                  <User />
                </el-icon>
                <span class="description-label">角色职责:</span>
                <span class="description-text">{{ getRoleDescription(step.role) }}</span>
              </div>
              <div v-if="getActionDescription(step.action)" class="description-item">
                <el-icon>
                  <Operation />
                </el-icon>
                <span class="description-label">操作说明:</span>
                <span class="description-text">{{ getActionDescription(step.action) }}</span>
              </div>
            </div>
            <div v-if="!step.userAction" class="step-content">
              {{ step.content }}
            </div>
            <!-- Zip Archive Info -->
            <div v-if="step.zipPath" class="step-zip">
              <el-divider content-position="left">
                <el-icon>
                  <Download />
                </el-icon>
                压缩包
              </el-divider>
              <el-alert type="success" :closable="false" show-icon>
                <template #title>
                  <div class="zip-alert-content">
                    <span>{{ step.zipType === 'workspace_zip' ? 'Workspace压缩包' : '代码压缩包' }}</span>
                    <el-button type="primary" size="small" :icon="Download" @click="downloadZip(step.zipPath)">
                      下载
                    </el-button>
                  </div>
                </template>
              </el-alert>
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
          <InteractiveConfirmation :role-info="currentStep" :loading="actionLoading" :project-id="projectId"
            @action="handleUserAction" />
        </el-timeline-item>

        <!-- Running indicator -->
        <el-timeline-item v-if="isRunning && !currentStep" type="primary" :hollow="true">
          <el-card class="running-card">
            <div class="running-content">
              <el-icon class="is-loading">
                <Loading />
              </el-icon>
              <div class="running-info">
                <div class="running-role">AI {{ runningRole || '系统' }} 正在工作中...</div>
                <div v-if="currentStageName" class="running-stage">
                  <el-icon>
                    <Timer />
                  </el-icon>
                  <span class="stage-label">当前阶段:</span>
                  <el-tag size="small" :type="getStageTagType()">{{ currentStageName }}</el-tag>
                </div>
                <div v-if="currentAction" class="running-action">
                  <el-tag size="small" type="info">{{ currentAction }}</el-tag>
                </div>
                <!-- Running Role and Action Description -->
                <div
                  v-if="(runningRole && getRoleDescription(runningRole)) || (currentAction && getActionDescription(currentAction))"
                  class="running-description">
                  <div v-if="runningRole && getRoleDescription(runningRole)" class="description-item">
                    <el-icon>
                      <User />
                    </el-icon>
                    <span class="description-label">角色职责:</span>
                    <span class="description-text">{{ getRoleDescription(runningRole) }}</span>
                  </div>
                  <div v-if="currentAction && getActionDescription(currentAction)" class="description-item">
                    <el-icon>
                      <Operation />
                    </el-icon>
                    <span class="description-label">操作说明:</span>
                    <span class="description-text">{{ getActionDescription(currentAction) }}</span>
                  </div>
                </div>
                <div v-if="userIdea" class="running-input">
                  <el-icon>
                    <Edit />
                  </el-icon>
                  <span class="input-label">处理中:</span>
                  <span class="input-text">{{ userIdea }}</span>
                </div>
              </div>
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
  Download,
  Edit,
  User,
  Operation,
} from '@element-plus/icons-vue';
import InteractiveConfirmation from '../components/InteractiveConfirmation.vue';
import apiClient from '../api/client';
import { createPolling, type PollingResult } from '../utils/polling';

const route = useRoute();
const router = useRouter();

// Project Info
const projectId = ref((route.params.id as string) || (route.query.id as string) || '');
const projectName = ref(route.query.name as string || 'Untitled Project');
const maxRounds = ref(parseInt(route.query.rounds as string) || 5);
const sessionId = ref<string>('');
const userIdea = ref(route.query.idea as string || '');

// State
const isRunning = ref(false);
const isCompleted = ref(false);
const currentRound = ref(0);
const actionLoading = ref(false);
const runningRole = ref('');
const currentAction = ref('');
const currentStageName = ref('');
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

// Polling mechanism
let pollingController: PollingResult | null = null;
let lastMessageId: string | null = null;

onMounted(async () => {
  // If projectId is provided, load project info first
  if (projectId.value) {
    try {
      const response = await apiClient.getProject(projectId.value) as any;
      const project = response.project || response;
      if (project) {
        // Always use project data if available, as it's the source of truth
        // Only use query params as fallback if project data is missing
        projectName.value = project.name || projectName.value || 'Untitled Project';

        // For idea, prioritize project data, then query param, then existing userIdea
        const projectIdea = project.idea;
        const queryIdea = route.query.idea as string;
        userIdea.value = projectIdea || queryIdea || userIdea.value;

        // For rounds, use project data or query param
        if (project.nRound !== undefined && project.nRound !== null) {
          maxRounds.value = project.nRound;
        } else if (project.n_round !== undefined && project.n_round !== null) {
          maxRounds.value = project.n_round;
        } else if (route.query.rounds) {
          maxRounds.value = parseInt(route.query.rounds as string) || maxRounds.value;
        }
      }
    } catch (err: any) {
      console.warn('Failed to load project info:', err);
      // Continue with query params or default values
    }
  }

  startInteractiveSession();
});

onUnmounted(() => {
  cleanup();
});

async function startInteractiveSession() {
  try {
    isRunning.value = true;
    startTime.value = Date.now();

    // Set default first stage: Salesperson (市场研究阶段)
    currentStageName.value = '市场研究阶段';
    runningRole.value = 'Salesperson';

    // Create session via API
    const apiUrl = (import.meta as any).env?.VITE_API_URL;
    if (!apiUrl) {
      throw new Error('VITE_API_URL environment variable is not set. Please configure it in your .env file.');
    }

    // Get the final idea value (prioritize userIdea, then query param)
    const queryIdea = route.query.idea as string;
    const finalIdea = (userIdea.value && userIdea.value.trim()) || (queryIdea && queryIdea.trim()) || '';
    const finalName = (projectName.value && projectName.value.trim()) || 'Untitled Project';

    // Validate required fields before sending request
    if (!finalName || finalName.trim() === '' || finalName === 'Untitled Project') {
      // If we have projectId but no name, it means project loading failed or incomplete
      if (projectId.value) {
        throw new Error('无法加载项目信息，请刷新页面重试');
      }
      throw new Error('项目名称不能为空');
    }
    if (!finalIdea || finalIdea.trim() === '') {
      // If we have projectId but no idea, it means project loading failed or project has no idea
      if (projectId.value) {
        throw new Error('项目缺少必要的描述信息，请先编辑项目添加项目描述');
      }
      throw new Error('项目想法不能为空，请提供项目描述');
    }

    const requestBody: any = {
      name: finalName,
      idea: finalIdea,
      description: route.query.description as string,
      investment: parseFloat(route.query.investment as string) || 10.0,
      nRound: maxRounds.value,
    };

    // If projectId is provided, pass it to the API
    if (projectId.value) {
      requestBody.projectId = projectId.value;
    }

    // If applicationId is provided, pass it to the API
    if (route.query.applicationId) {
      requestBody.applicationId = route.query.applicationId as string;
    }

    const response = await fetch(`${apiUrl}/interactive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `Failed to create session: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
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

    // Start polling
    startPolling(sid);
  } catch (error: any) {
    ElMessage.error('启动会话失败: ' + error.message);
    isRunning.value = false;
  }
}

function startPolling(sessionId: string) {
  try {
    // Stop existing polling if any
    if (pollingController) {
      pollingController.stop();
      pollingController = null;
    }

    lastMessageId = null;
    ElMessage.success('已连接到服务器');

    // Create polling instance
    pollingController = createPolling(
      async () => {
        try {
          const response = await apiClient.pollInteractiveMessages(sessionId, lastMessageId);
          return response;
        } catch (error: any) {
          console.error('Poll API error:', error);
          // 重新抛出错误以便轮询工具处理
          throw error;
        }
      },
      (data: any) => {
        // Process messages
        if (data && data.messages && Array.isArray(data.messages)) {
          data.messages.forEach((msg: any) => {
            handlePollingMessage({
              type: msg.type,
              data: msg.data,
            });
          });

          // Update last message ID
          if (data.lastMessageId) {
            lastMessageId = data.lastMessageId;
          }
        } else {
          console.warn('Unexpected polling response format:', data);
        }
      },
      {
        interval: 1000, // Poll every 1 second
        maxRetries: 3,
        retryDelay: 2000,
        immediate: true,
        shouldContinue: () => !isCompleted.value,
        onError: (error: Error) => {
          console.error('Polling error:', error);
          const errorMessage = error?.message || '未知错误';
          ElMessage.error('轮询错误: ' + errorMessage);
        },
      }
    );
  } catch (error: any) {
    console.error('Failed to start polling:', error);
    ElMessage.error('启动轮询失败: ' + error.message);
    isRunning.value = false;
  }
}

function handlePollingMessage(message: { type: string; data: any }) {
  switch (message.type) {
    case 'connected':
      ElMessage.success('会话已连接');
      isRunning.value = true;
      // Set default first stage: Salesperson (市场研究阶段)
      if (!currentStageName.value) {
        currentStageName.value = '市场研究阶段';
        runningRole.value = 'Salesperson';
      }
      break;

    case 'started':
      ElMessage.info('项目生成已开始');
      isRunning.value = true;
      // Set initial stage name - default to Salesperson (市场研究阶段)
      if (message.data?.role && message.data?.action) {
        currentStageName.value = getStageName(message.data.role, message.data.action);
        runningRole.value = message.data.role || '';
        currentAction.value = message.data.action || '';
      } else {
        // Default to first stage: Salesperson (市场研究阶段)
        currentStageName.value = '市场研究阶段';
        runningRole.value = 'Salesperson';
      }
      break;

    case 'role_start':
      runningRole.value = message.data.role || '';
      currentAction.value = message.data.action || '';
      currentStageName.value = getStageName(message.data.role, message.data.action);
      break;

    case 'confirmation_required':
      // Stop running state and show confirmation UI
      isRunning.value = false;
      // Keep runningRole and currentAction for display, but update stage name
      runningRole.value = message.data.role || '';
      currentAction.value = message.data.action || '';
      currentStageName.value = getStageName(message.data.role, message.data.action);
      currentStep.value = {
        role: message.data.role,
        action: message.data.action,
        content: message.data.content,
        outputFiles: message.data.outputFiles || [],
        instructContent: message.data.instructContent || {},
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
      // Preserve zip info if it exists
      zipPath: currentStep.value.instructContent?.zipPath,
      zipType: currentStep.value.instructContent?.type,
    };

    completedSteps.value.push(step);

    // Send action to backend via HTTP API
    try {
      await apiClient.sendInteractiveAction(sessionId.value, action, modifiedContent);
      console.log('User action sent successfully');
    } catch (error: any) {
      console.error('Failed to send action:', error);
      ElMessage.error('发送操作失败: ' + (error.message || '未知错误'));
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
        // Keep stage name until next role_start message updates it
        // Don't clear currentAction and currentStageName here
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
        // Keep stage name until next role_start message updates it
        // Don't clear currentAction and currentStageName here
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

/**
 * 根据角色和操作获取阶段名称
 * 支持的阶段：
 * 1. 市场研究阶段（Salesperson - WriteMRD）
 * 2. 产品需求阶段（ProductManager - WritePRD）
 * 3. 系统设计阶段（Architect - WriteDesign）
 * 4. 任务拆分阶段（ProjectManager - BreakdownTasks）
 * 5. 代码实现阶段（Engineer - WriteCode）
 * 6. 测试编写阶段（QAEngineer - WriteTest）
 */
function getStageName(role: string, action: string): string {
  // 根据角色和操作确定阶段
  const stageMap: Record<string, Record<string, string>> = {
    Salesperson: {
      WriteMRD: '市场研究阶段',
      MRDReview: '市场研究阶段',
      RequirementSpecReview: '市场研究阶段',
      WriteRequirementSpec: '市场研究阶段',
    },
    ProductManager: {
      WritePRD: '产品需求阶段',
      PRDReview: '产品需求阶段',
      ImproveDocument: '产品需求阶段',
    },
    Architect: {
      WriteDesign: '系统设计阶段',
    },
    ProjectManager: {
      BreakdownTasks: '任务拆分阶段',
      WriteSubProjectDesign: '任务拆分阶段',
      GenerateTask: '任务拆分阶段',
    },
    Engineer: {
      WriteCode: '代码实现阶段',
      ExecuteSubtask: '代码实现阶段',
    },
    QAEngineer: {
      WriteTest: '测试编写阶段',
      CodeReview: '测试编写阶段',
    },
  };

  // 优先根据角色和操作匹配
  const roleStages = stageMap[role] || {};
  if (roleStages[action]) {
    return roleStages[action];
  }

  // 如果操作不匹配，根据角色返回默认阶段
  const roleDefaultStages: Record<string, string> = {
    Salesperson: '市场研究阶段',
    ProductManager: '产品需求阶段',
    Architect: '系统设计阶段',
    ProjectManager: '任务拆分阶段',
    Engineer: '代码实现阶段',
    QAEngineer: '测试编写阶段',
  };

  return roleDefaultStages[role] || `${role} - ${action}`;
}

/**
 * 获取阶段标签类型
 * 支持的阶段颜色：
 * - 市场研究阶段: info (蓝色)
 * - 产品需求阶段: success (绿色)
 * - 系统设计阶段: warning (橙色)
 * - 任务拆分阶段: warning (橙色)
 * - 代码实现阶段: danger (红色)
 * - 测试编写阶段: danger (红色)
 */
function getStageTagType(): 'success' | 'warning' | 'info' | 'danger' {
  if (!currentStageName.value) return 'info';

  if (currentStageName.value.includes('市场研究')) return 'info';
  if (currentStageName.value.includes('产品需求')) return 'success';
  if (currentStageName.value.includes('系统设计')) return 'warning';
  if (currentStageName.value.includes('任务拆分')) return 'warning';
  if (currentStageName.value.includes('代码实现')) return 'danger';
  if (currentStageName.value.includes('测试编写')) return 'danger';

  return 'info';
}

/**
 * 获取角色描述
 */
function getRoleDescription(role: string): string {
  const roleDescriptions: Record<string, string> = {
    Salesperson: '需求收集专家，负责收集和分析用户需求，进行市场调研和业务分析，输出市场研究文档（MRD）',
    ProductManager: '产品经理，负责基于市场研究文档（MRD）编写产品需求文档（PRD），进行需求分析和产品规划',
    Architect: '系统架构师，负责系统设计、架构规划，输出系统设计文档和技术方案',
    ProjectManager: '项目经理，负责任务拆分、子项目设计和代码审查，为工程师提供清晰的开发指南',
    Engineer: '工程师，负责代码实现，根据设计文档和任务说明编写高质量的代码',
    QAEngineer: 'QA工程师，负责测试用例编写和执行，确保代码质量和功能正确性',
    TeamLeader: '团队领导，负责协调团队工作、做出决策和任务分配',
    DataAnalyst: '数据分析师，负责数据分析和可视化，提供数据洞察',
  };
  return roleDescriptions[role] || '';
}

/**
 * 获取Action描述
 */
function getActionDescription(action: string): string {
  const actionDescriptions: Record<string, string> = {
    // Salesperson actions
    WriteMRD: '编写市场研究文档（MRD），包含需求背景、目标价值分析、用户分析、业务流程分析、市场分析和可行性分析',
    MRDReview: '审查市场研究文档（MRD），评估文档质量和完整性，提供改进建议',
    WriteRequirementSpec: '编写需求说明文档，整理和分析用户需求，进行市场调研和竞品分析',
    RequirementSpecReview: '审查需求说明文档，确保需求描述的准确性和完整性',

    // ProductManager actions
    WritePRD: '编写产品需求文档（PRD），基于MRD进行详细的功能需求分析和产品规划',
    PRDReview: '审查产品需求文档（PRD），评估需求的合理性和可实现性',
    ImproveDocument: '根据审查报告改进和完善PRD或MRD文档，补充详细描述和缺失内容',
    SearchEnhancedQA: '使用RAG检索历史PRD文档，增强文档质量和一致性',

    // Architect actions
    WriteDesign: '编写系统设计文档，包含架构设计、数据结构设计、API设计和技术选型说明',

    // ProjectManager actions
    BreakdownTasks: '基于PRD和系统设计文档进行任务拆分，将项目拆分为可独立完成的小任务',
    WriteSubProjectDesign: '编写子项目设计文档，为每个子任务提供详细的技术实现方案',
    GenerateTask: '生成任务说明文档，为工程师提供清晰的开发指南和代码示例',
    CodeReview: '进行代码审查，评估代码质量，提供改进建议',

    // Engineer actions
    WriteCode: '编写代码实现，根据设计文档和任务说明生成高质量的源代码',
    ExecuteSubtask: '执行子任务，根据任务描述和设计文档实现具体的代码功能',

    // QAEngineer actions
    WriteTest: '编写测试用例，确保代码的功能正确性和质量',

    // TeamLeader actions
    Coordinate: '协调团队工作，做出决策，分配任务，确保项目顺利进行',

    // DataAnalyst actions
    DataAnalysis: '进行数据分析和可视化，提供数据洞察和报告',
  };
  return actionDescriptions[action] || '';
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

async function downloadZip(zipPath: string) {
  if (!zipPath || !projectId.value) {
    ElMessage.error('压缩包路径或项目ID不存在');
    return;
  }

  try {
    await apiClient.downloadZip(projectId.value, zipPath);
    ElMessage.success('压缩包下载已开始');
  } catch (error: any) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'));
  }
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
  if (pollingController) {
    pollingController.stop();
    pollingController = null;
  }
  lastMessageId = null;
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

.user-input-section {
  margin-top: 16px;
}

.user-input-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #606266;
  font-size: 14px;
}

.user-input-label {
  color: #606266;
}

.user-input-content {
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #303133;
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  border-left: 3px solid #409EFF;
}

.current-stage-section {
  margin-top: 16px;
}

.current-stage-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #606266;
  font-size: 14px;
}

.current-stage-label {
  color: #606266;
}

.current-stage-content {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.current-stage-description {
  margin-top: 12px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 4px;
  border-left: 3px solid #409EFF;
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

.step-description {
  margin-bottom: 12px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 4px;
  border-left: 3px solid #409EFF;
}

.description-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.description-item:last-child {
  margin-bottom: 0;
}

.description-item .el-icon {
  color: #409EFF;
  margin-top: 2px;
  flex-shrink: 0;
}

.description-label {
  font-weight: 600;
  color: #606266;
  flex-shrink: 0;
  min-width: 80px;
}

.description-text {
  color: #303133;
  line-height: 1.5;
  flex: 1;
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

.step-zip {
  margin-top: 16px;
}

.zip-alert-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.running-card {
  border: 2px dashed #409EFF;
  background: #ecf5ff;
}

.running-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 16px;
  color: #409EFF;
  padding: 12px;
}

.running-content .el-icon {
  font-size: 24px;
  margin-top: 2px;
}

.running-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.running-role {
  font-weight: 600;
  font-size: 16px;
}

.running-stage {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.running-stage .stage-label {
  font-weight: 600;
  color: #606266;
  font-size: 14px;
}

.running-action {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.running-description {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  border-left: 3px solid #409EFF;
}

.running-description .description-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.running-description .description-item:last-child {
  margin-bottom: 0;
}

.running-description .description-item .el-icon {
  color: #409EFF;
  margin-top: 2px;
  flex-shrink: 0;
}

.running-description .description-label {
  font-weight: 600;
  color: #606266;
  flex-shrink: 0;
  min-width: 80px;
}

.running-description .description-text {
  color: #303133;
  line-height: 1.5;
  flex: 1;
  font-size: 14px;
}

.running-input {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 4px;
  font-size: 14px;
}

.running-input .input-label {
  font-weight: 600;
  color: #606266;
}

.running-input .input-text {
  color: #303133;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
