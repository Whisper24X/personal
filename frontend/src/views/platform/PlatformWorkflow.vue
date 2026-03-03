<template>
  <div class="platform-workflow">
    <PlatformWorkflowHeader @back="handleBack" />

    <PlatformInfoCard
      :platform-id="projectId"
      :application-id="applicationId"
      :platform-name="platformName"
      :user-idea="userIdea"
      @download-code="handleDownloadCode"
      @download-docs="handleDownloadDocs"
      @version-changed="handleVersionChanged"
    />

    <div class="workflow-content">
      <div class="content-left">
        <WorkflowNodes
          :workflow-kanban="workflowKanban"
          :is-running="isRunning"
          :running-role="runningRole"
          :current-action="currentAction"
          :get-role-display-name="getRoleDisplayName"
          :get-action-display-name="getActionDisplayName"
          :show-recover-button="showRecoverButton"
          :recovering="recovering"
          @reset-role="handleResetRole"
          @recover="handleRecover"
          @view-content="openContentDialog"
        />

        <el-card class="left-panel log-panel">
          <template #header>
            <div class="panel-header">
              <div class="panel-title">工作流日志</div>
              <div class="panel-actions">
                <el-select v-model="logFilter" size="small" class="log-filter" placeholder="筛选">
                  <el-option label="全部" value="all" />
                  <el-option label="仅 CLI" value="cli" />
                  <el-option label="仅状态" value="status" />
                  <el-option label="仅错误" value="error" />
                </el-select>
                <div class="log-toggle">
                  <span>自动滚动</span>
                  <el-switch v-model="autoScroll" size="small" />
                </div>
                <el-button size="small" @click="copyVisibleLogs">复制日志</el-button>
                <el-button size="small" plain @click="clearRuntimeLogs">清空日志</el-button>
              </div>
            </div>
          </template>
          <div ref="logListRef" class="log-list">
            <div v-if="filteredLogs.length === 0" class="log-empty">暂无日志</div>
            <div v-for="log in filteredLogs" :id="`log-${log.id}`" :key="log.id" class="log-item" :class="`log-type-${log.type}`">
              <div class="log-badge">{{ logBadgeText(log) }}</div>
              <div class="log-title">{{ log.title }}</div>
              <div class="log-time">{{ log.time }}</div>
              <div v-if="log.content" class="log-content">{{ log.content }}</div>
            </div>
          </div>
        </el-card>

        <el-card class="left-panel cli-panel">
          <template #header>
            <div class="panel-header">
              <div class="panel-title">CLI 对话修改</div>
            </div>
          </template>
          <div v-if="cliHistory.length > 0" class="cli-chat-history">
            <div v-for="(msg, idx) in cliHistory" :key="idx" :class="['cli-message', msg.role]" @click="scrollToLog(msg.logId)">
              <div class="cli-role">{{ msg.role === 'user' ? '你' : 'CLI' }}</div>
              <div class="cli-content">{{ msg.content }}</div>
            </div>
          </div>
          <div v-else class="log-empty">暂无对话记录</div>
          <div v-if="cliSending" class="cli-status">正在执行中，请稍候…</div>
          <el-input
            v-model="cliMessage"
            type="textarea"
            :rows="3"
            placeholder="请输入修改要求，例如：请补充功能边界条件..."
            :disabled="cliSending"
            @keydown="handleCliKeydown"
          />
          <div class="cli-actions">
            <el-button type="primary" :loading="cliSending" :disabled="cliSending" @click="sendCliMessage">发送</el-button>
          </div>
        </el-card>

        <CompletionCard
          v-if="isCompleted"
          :completed-steps="completedSteps"
          :start-time="startTime"
          @view-project="viewPlatform"
          @download-project="downloadPlatform"
        />
      </div>
      <div class="content-right">
        <el-card class="confirmation-panel">
          <template #header>
            <div class="panel-header">
              <div class="panel-title">
                <span>确认展示区</span>
                <el-tag v-if="currentStep" type="warning" effect="dark">等待确认</el-tag>
              </div>
              <el-button
                v-if="currentStep"
                type="success"
                size="small"
                :loading="actionLoading"
                :disabled="cliSending || currentStep?.instructContent?.deployFailed"
                @click="handleUserAction('continue')"
              >
                确认继续
              </el-button>
            </div>
          </template>

          <div v-if="currentStep">
            <InteractiveConfirmation
              :role-info="currentStep"
              :loading="actionLoading"
              :project-id="projectId"
              :version-id="versionId"
              :hide-card="true"
              :hide-header="true"
              :hide-continue="true"
              @action="handleUserAction"
            />
          </div>

          <el-empty v-else description="暂无等待确认的节点" />
        </el-card>
      </div>
    </div>

    <!-- Content View Dialog -->
    <ContentDialog
      v-model="showContentDialog"
      :role="contentDialogRole"
      :action="contentDialogAction"
      :content="contentDialogContent"
      :timestamp="contentDialogTimestamp"
      :role-display-name="contentDialogRole ? getRoleDisplayName(contentDialogRole) : ''"
      :action-display-name="contentDialogAction ? getActionDisplayName(contentDialogAction) : ''"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
// Import shared components from project folder
import InteractiveConfirmation from '../project/components/InteractiveConfirmation.vue';
import WorkflowNodes from '../project/components/WorkflowNodes.vue';
import CompletionCard from '../project/components/CompletionCard.vue';
import ContentDialog from '../project/components/ContentDialog.vue';
// Import platform-specific components
import PlatformWorkflowHeader from './components/PlatformWorkflowHeader.vue';
import PlatformInfoCard from './components/PlatformInfoCard.vue';
import apiClient from '../../api/client';
import { createPolling, type PollingResult } from '../../utils/polling';
import { useRoleActionStore } from '../../stores/roleAction';
import { getStageName } from '../../config/stageConfig';
import { handleApiError } from '../../utils/errorHandler';
import type { WorkflowAction } from '../project/components/ActionCard.vue';
import type { WorkflowRoleColumn } from '../project/components/KanbanColumn.vue';

const route = useRoute();
const router = useRouter();
const roleActionStore = useRoleActionStore();

// Platform Info (from route params: applicationId, projectId, versionId)
const applicationId = computed(() => (route.params.applicationId as string) || '');
const projectId = computed(() => (route.params.projectId as string) || '');
const platformId = projectId; // Alias for API calls
const platformName = ref('未命名平台');
const userIdea = ref('');
const businessLineId = ref('');

// State
const isRunning = ref(false);
const isCompleted = ref(false);
const actionLoading = ref(false);
const runningRole = ref('');
const currentAction = ref('');
const currentStageName = ref('');
const startTime = ref(Date.now());

// Steps
const completedSteps = ref<any[]>([]);
const currentStep = ref<any>(null);
const cliMessage = ref('');
const cliSending = ref(false);
const cliHistory = ref<Array<{ role: 'user' | 'assistant'; content: string; logId?: string }>>([]);

type LogType = 'input' | 'output' | 'status' | 'error' | 'info';
type LogSource = 'cli' | 'workflow';
type LogItem = { id: string; title: string; time: string; content?: string; type: LogType; source: LogSource };
const runtimeLogs = ref<LogItem[]>([]);
const cliLogInterval = ref<number | null>(null);
const lastCliLogTs = ref<string>('');
const logIdCounter = ref(0);
const logListRef = ref<HTMLElement | null>(null);
const logFilter = ref<'all' | 'cli' | 'status' | 'error'>('all');
const autoScroll = ref(true);

const allLogs = computed<LogItem[]>(() => {
  const completedLogs: LogItem[] = completedSteps.value.map((step: any) => ({
    id: `completed-${step.role}-${step.action}-${step.timestamp || step.completedAt || ''}`,
    title: `${getRoleDisplayName(step.role)} - ${getActionDisplayName(step.action)}`,
    time: step.timestamp || step.completedAt || '',
    content: step.userAction ? `操作: ${step.userAction}` : undefined,
    type: 'status',
    source: 'workflow',
  }));
  const combined = [...runtimeLogs.value, ...completedLogs];
  return combined.sort((a, b) => {
    const aTime = Date.parse(a.time || '') || 0;
    const bTime = Date.parse(b.time || '') || 0;
    return aTime - bTime;
  });
});

const filteredLogs = computed(() => {
  const logs = allLogs.value.filter((log) => {
    if (logFilter.value === 'cli') return log.source === 'cli';
    if (logFilter.value === 'status') return log.type === 'status';
    if (logFilter.value === 'error') return log.type === 'error';
    return true;
  });
  return logs.slice(-200);
});

// Reset state
const resettingRoles = ref<Set<string>>(new Set());

// Recovery state
const showRecoverButton = ref(false);
const recovering = ref(false);
let staleCheckInterval: NodeJS.Timeout | null = null;

// Content Dialog
const showContentDialog = ref(false);
const contentDialogRole = ref('');
const contentDialogAction = ref('');
const contentDialogContent = ref('');
const contentDialogTimestamp = ref('');

// Workflow structure: role -> actions mapping (loaded from API)
const workflowStructure = ref<Record<string, string[]>>({});
const workflowLoading = ref(false);
const workflowItems = ref<any[]>([]);

// Version ID from route params (required)
const versionId = computed(() => route.params.versionId as string);

// Computed kanban board data
const workflowKanban = computed<WorkflowRoleColumn[]>(() => {
  const columns: WorkflowRoleColumn[] = [];

  if (!workflowStructure.value || Object.keys(workflowStructure.value).length === 0) {
    return columns;
  }

  const completedMap = new Map<string, any>();
  completedSteps.value.forEach((step) => {
    const key = `${step.role}-${step.action}`;
    completedMap.set(key, step);
  });

  const workflowItemsMap = new Map<string, any>();
  workflowItems.value.forEach((item) => {
    if (item.role && item.action) {
      const key = `${item.role}-${item.action}`;
      workflowItemsMap.set(key, item);
    }
  });

  Object.entries(workflowStructure.value).forEach(([role, actions]) => {
    const roleActions: WorkflowAction[] = actions.map((actionName) => {
      const key = `${role}-${actionName}`;
      const completedStep = completedMap.get(key);
      const workflowItem = workflowItemsMap.get(key);

      let status: 'pending' | 'running' | 'waiting' | 'completed' = 'pending';
      let userAction: string | undefined;
      let timestamp: string | undefined;
      let content: string | undefined;
      let outputFiles: any[] | undefined;
      let zipPath: string | undefined;
      let zipType: string | undefined;
      let stepData: any | undefined;

      if (workflowItem) {
        const itemStatus = workflowItem.status;
        if (itemStatus === 'completed') {
          status = 'completed';
          if (completedStep) {
            userAction = completedStep.userAction;
            timestamp = completedStep.timestamp;
            content = completedStep.content;
            outputFiles = completedStep.outputFiles;
            zipPath = completedStep.zipPath;
            zipType = completedStep.zipType;
            stepData = completedStep;
          }
        } else if (itemStatus === 'running') {
          status = 'running';
        } else if (itemStatus === 'pending') {
          status = 'pending';
        }
      } else if (currentStep.value && currentStep.value.role === role && currentStep.value.action === actionName) {
        status = 'waiting';
        content = currentStep.value.content;
        outputFiles = currentStep.value.outputFiles;
        stepData = currentStep.value;
      } else if (completedStep) {
        status = 'completed';
        userAction = completedStep.userAction;
        timestamp = completedStep.timestamp;
        content = completedStep.content;
        outputFiles = completedStep.outputFiles;
        zipPath = completedStep.zipPath;
        zipType = completedStep.zipType;
        stepData = completedStep;
      } else if (isRunning.value && runningRole.value === role && currentAction.value === actionName) {
        status = 'running';
      }

      return {
        name: actionName,
        status,
        userAction,
        timestamp,
        content,
        outputFiles,
        zipPath,
        zipType,
        stepData,
      };
    });

    const completedCount = roleActions.filter((a) => a.status === 'completed').length;
    const isActive =
      runningRole.value === role ||
      (currentStep.value && currentStep.value.role === role) ||
      roleActions.some((a) => a.status === 'running' || a.status === 'waiting');

    const currentStepForRole = currentStep.value && currentStep.value.role === role ? currentStep.value : undefined;
    const runningActionForRole = runningRole.value === role && currentAction.value ? currentAction.value : undefined;

    columns.push({
      role,
      actions: roleActions,
      isActive,
      completedCount,
      totalCount: actions.length,
      currentStep: currentStepForRole,
      runningAction: runningActionForRole,
    });
  });

  return columns;
});

// Polling mechanism
let pollingController: PollingResult | null = null;

// Load workflow information from API
async function loadWorkflowInfo() {
  if (!platformId.value || !versionId.value) return;

  try {
    workflowLoading.value = true;
    const response = (await apiClient.getWorkflowExecution(platformId.value, versionId.value)) as any;

    if (response && response.success && response.data) {
      const execution = response.data;

      if (execution.workflowSnapshot && execution.workflowSnapshot.roles) {
        const structure: Record<string, string[]> = {};
        const sortedRoles = [...execution.workflowSnapshot.roles].sort((a: any, b: any) => a.order - b.order);
        sortedRoles.forEach((roleConfig: any) => {
          structure[roleConfig.profile] = roleConfig.actions || [];
        });
        workflowStructure.value = structure;
      }

      if (execution.steps && Array.isArray(execution.steps)) {
        workflowItems.value = execution.steps.map((step: any) => ({
          role: step.role,
          action: step.action,
          status: step.state,
          role_order: step.roleIndex,
          action_order: step.actionIndex,
          retry_count: step.retryCount,
        }));

        const completedItems = execution.steps.filter((step: any) => step.state === 'completed');
        const existingKeys = new Set(completedSteps.value.map((s) => `${s.role}-${s.action}`));
        const newSteps = completedItems
          .filter((step: any) => step.role && step.action && !existingKeys.has(`${step.role}-${step.action}`))
          .map((step: any) => ({
            role: step.role,
            action: step.action,
            userAction: 'skip',
            timestamp: step.completedAt || new Date().toISOString(),
            content: undefined,
            outputFiles: undefined,
            zipPath: undefined,
            zipType: undefined,
          }));
        completedSteps.value.push(...newSteps);
      }
    }
  } catch (error: any) {
    console.error('Failed to load workflow info:', error);
    ElMessage.warning('加载工作流信息失败，使用角色配置');
    if (roleActionStore.roles.length > 0) {
      const structure: Record<string, string[]> = {};
      roleActionStore.roles.forEach((role) => {
        structure[role.profile] = role.actions.map((action) => action.name);
      });
      workflowStructure.value = structure;
    } else {
      // Fallback workflow structure matching defaultWorkflowConfig.ts
      workflowStructure.value = {
        Salesperson: ['WriteMRD', 'MRDReview', 'ImproveMRD'],
        ProductManager: ['WritePRD', 'PRDReview', 'ImprovePRD', 'GeneratePrototype'],
        QAEngineer: ['WriteTestPlan', 'WriteTest', 'TestReview', 'ImproveTest'],
        Architect: ['WriteDesign', 'DesignReview', 'ImproveDesign'],
        ProjectManager: [
          'FillProjectContext',
          'CreateOpenSpecProposal',
          'ValidateOpenSpecProposal',
          'EstimateStoryPoints',
          'ValidateStoryPointEstimates',
        ],
        Engineer: ['WriteCode', 'ImproveCode', 'Deploy'],
        AutomationEngineer: ['AutomationPlanning', 'AutomationExecution', 'CoverageQualityCheck', 'QAConclusion'],
      };
    }
  } finally {
    workflowLoading.value = false;
  }
}

let previousWorkflowState = '';
let previousRole = '';

function processWorkflowState(stateData: any, showMessages: boolean = false) {
  const currentWorkflowState = stateData.state;
  const newRole = stateData.currentRole || '';
  const newAction = stateData.currentAction || '';

  if (stateData.steps?.length) {
    workflowItems.value = stateData.steps.map((step: any) => ({
      role: step.role,
      action: step.action,
      status: step.state,
      role_order: step.roleIndex,
      action_order: step.actionIndex,
      retry_count: step.retryCount,
    }));

    const completedItems = stateData.steps.filter((step: any) => step.state === 'completed');
    const existingKeys = new Set(completedSteps.value.map((s) => `${s.role}-${s.action}`));
    const newSteps = completedItems
      .filter((step: any) => step.role && step.action && !existingKeys.has(`${step.role}-${step.action}`))
      .map((step: any) => ({
        role: step.role,
        action: step.action,
        userAction: 'skip',
        timestamp: step.completedAt || new Date().toISOString(),
        content: undefined,
        outputFiles: undefined,
        zipPath: undefined,
        zipType: undefined,
      }));
    completedSteps.value.push(...newSteps);
  }

  const roleChanged = newRole && newRole !== previousRole;
  if (newRole) runningRole.value = newRole;
  if (newAction) currentAction.value = newAction;
  if (newRole && newAction) {
    currentStageName.value = getStageName(newRole, newAction);
  }

  if (showMessages && roleChanged && previousRole && currentWorkflowState === 'running') {
    const roleName = roleActionStore.getRoleDisplayName(newRole) || newRole;
    ElMessage.info(`正在执行: ${roleName}`);
  }

  const stateChanged = currentWorkflowState !== previousWorkflowState;
  const pendingConfirmation = stateData.pendingConfirmation;

  if (currentWorkflowState === 'waiting_confirmation' && pendingConfirmation) {
    isRunning.value = false;
    currentStep.value = {
      role: pendingConfirmation.role,
      action: pendingConfirmation.action,
      content: pendingConfirmation.content,
      outputFiles: pendingConfirmation.outputFiles || [],
      instructContent: {
        ...(pendingConfirmation.instructContent || {}),
        deployFailed: pendingConfirmation.deployFailed || stateData.deployFailed || false,
      },
      retryCount: 0,
    };

    const roleToShow = pendingConfirmation.role || newRole;
    const actionToShow = pendingConfirmation.action || newAction;
    if (roleToShow) runningRole.value = roleToShow;
    if (actionToShow) currentAction.value = actionToShow;
    if (roleToShow && actionToShow) {
      currentStageName.value = getStageName(roleToShow, actionToShow);
    }
    // Right panel will display confirmation content

    if (showMessages && stateChanged) {
      const actionName = roleActionStore.getActionDisplayName(actionToShow) || actionToShow;
      ElMessage.warning(`需要确认: ${actionName}`);
    }
  } else if (currentWorkflowState === 'completed') {
    isRunning.value = false;
    isCompleted.value = true;
    currentStep.value = null;
    if (showMessages && stateChanged) {
      ElMessage.success('平台生成完成！');
    }
  } else if (currentWorkflowState === 'failed') {
    isRunning.value = false;
    currentStep.value = null;
    showRecoverButton.value = true;
    if (showMessages && stateChanged) {
      ElMessage.error('工作流执行失败，请尝试恢复');
    }
  } else if (currentWorkflowState === 'running') {
    isRunning.value = true;
    currentStep.value = null;
  } else {
    isRunning.value = false;
    currentStep.value = null;
  }

  previousWorkflowState = currentWorkflowState;
  previousRole = newRole;
  checkForStaleActions(stateData);
}

function pushRuntimeLog(payload: { title: string; content?: string; type?: LogType; source?: LogSource }) {
  const id = `rt-${++logIdCounter.value}`;
  runtimeLogs.value.push({
    id,
    title: payload.title,
    time: new Date().toISOString(),
    content: payload.content,
    type: payload.type || 'info',
    source: payload.source || 'workflow',
  });
  return id;
}

function logBadgeText(log: LogItem) {
  if (log.type === 'input') return 'IN';
  if (log.type === 'output') return 'OUT';
  if (log.type === 'error') return 'ERR';
  if (log.type === 'status') return 'STA';
  return 'INFO';
}

async function loadRunningInfo() {
  if (!platformId.value || !versionId.value) return;

  try {
    const response = (await apiClient.getWorkflowState(platformId.value, versionId.value)) as any;
    if (response?.success && response.data) {
      processWorkflowState(response.data);
    }
  } catch (error: any) {
    console.error('Failed to load running info:', error);
  }
}

onMounted(async () => {
  // 检查必需的 versionId 路由参数
  if (!versionId.value) {
    ElMessage.error('未指定版本，请从版本列表进入');
    router.push(`/platform/${platformId.value}/versions`);
    return;
  }

  await roleActionStore.fetchRolesAndActions();

  if (platformId.value) {
    try {
      const response = (await apiClient.getPlatform(platformId.value)) as any;
      const platform = response.platform || response.project || response;
      if (platform) {
        platformName.value = platform.name || 'Untitled Platform';
        businessLineId.value = platform.applicationId || platform.application_id || '';
      }
    } catch (err: any) {
      console.warn('Failed to load platform info:', err);
    }

    // 获取版本详情以获取版本的 idea
    if (versionId.value) {
      try {
        const versionResponse = (await apiClient.getPlatformVersion(platformId.value, versionId.value)) as any;
        const version = versionResponse.version;
        if (version && version.idea) {
          userIdea.value = version.idea;
        }
      } catch (err: any) {
        console.warn('Failed to load version info:', err);
      }
    }
  }

  if (platformId.value && versionId.value) {
    await loadRunningInfo();
  }

  checkForStaleActions();
  staleCheckInterval = setInterval(() => {
    checkForStaleActions();
  }, 30000);

  startWorkflowSession();

  if (platformId.value && versionId.value) {
    await pollCliLogs();
    cliLogInterval.value = window.setInterval(() => {
      pollCliLogs();
    }, 5000);
  }
});

onUnmounted(() => {
  cleanup();
  if (cliLogInterval.value) {
    clearInterval(cliLogInterval.value);
    cliLogInterval.value = null;
  }
});

async function startWorkflowSession() {
  if (!versionId.value) {
    console.warn('No active version, cannot start workflow');
    return;
  }

  try {
    if (isCompleted.value) {
      await loadWorkflowInfo();
      startPolling(platformId.value, versionId.value);
      return;
    }

    isRunning.value = true;
    startTime.value = Date.now();
    currentStageName.value = '市场研究阶段';
    runningRole.value = 'Salesperson';

    // 1. 先启动工作流（会自动创建执行记录）
    try {
      await apiClient.startWorkflow(platformId.value, versionId.value);
      console.log('Workflow started successfully');
    } catch (error: any) {
      console.warn('Start workflow warning:', error.message);
    }

    // 2. 后加载工作流信息（此时记录已存在）
    await loadWorkflowInfo();

    startPolling(platformId.value, versionId.value);
  } catch (error: any) {
    handleApiError(error, '启动会话失败');
    isRunning.value = false;
  }
}

function getPollingInterval(): number {
  if (isRunning.value) return 1000;
  if (currentStep.value) return 3000;
  return 5000;
}

function startPolling(platformIdToUse: string, versionIdToUse: string) {
  try {
    if (pollingController) {
      pollingController.stop();
      pollingController = null;
    }

    ElMessage.success('已连接到服务器');

    pollingController = createPolling(
      async () => {
        const response = (await apiClient.getWorkflowState(platformIdToUse, versionIdToUse)) as any;
        return response;
      },
      (data: any) => {
        if (data?.success && data.data) {
          processWorkflowState(data.data, true);
        }
      },
      {
        getInterval: getPollingInterval,
        maxRetries: 3,
        retryDelay: 2000,
        immediate: true,
        shouldContinue: () => !isCompleted.value,
        onError: (error: Error) => {
          handleApiError(error, '轮询错误');
        },
      }
    );
  } catch (error: any) {
    handleApiError(error, '启动轮询失败');
    isRunning.value = false;
  }
}

async function handleUserAction(action: string, modifiedContent?: string) {
  actionLoading.value = true;

  try {
    const step = {
      ...currentStep.value,
      userAction: action,
      timestamp: new Date().toISOString(),
      content: modifiedContent || currentStep.value.content,
      outputFiles: currentStep.value.outputFiles || [],
      zipPath: currentStep.value.instructContent?.zipPath,
      zipType: currentStep.value.instructContent?.type,
    };

    completedSteps.value.push(step);

    // 工程师角色的编辑操作：直接重置到 Engineer 角色，不调用 confirmWorkflow
    if (action === 'edit' && currentStep.value?.role === 'Engineer') {
      try {
        await apiClient.resetWorkflow(platformId.value, versionId.value!, 'Engineer');
        ElMessage.success('改进建议已保存，正在重新执行工程师角色...');
        currentStep.value = null;

        // 刷新页面以更新工作流状态
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error: any) {
        console.error('Failed to reset workflow:', error);
        ElMessage.error('重置失败: ' + (error.message || '未知错误'));
      } finally {
        actionLoading.value = false;
      }
      return;
    }

    try {
      await apiClient.confirmWorkflow(platformId.value, versionId.value!);
      console.log('Workflow confirmation sent successfully');
    } catch (error: any) {
      console.error('Failed to send confirmation:', error);
      ElMessage.error('确认操作失败: ' + (error.message || '未知错误'));
      actionLoading.value = false;
      return;
    }

    switch (action) {
      case 'continue':
      case 'edit':
        ElMessage.success('已确认，等待下一步...');
        currentStep.value = null;
        isRunning.value = true;
        runningRole.value = '';
        currentAction.value = '';
        break;

      case 'regenerate':
        // 调用与重置按钮相同的接口
        if (!platformId.value || !versionId.value) {
          ElMessage.error('平台ID或版本ID不存在');
          return;
        }

        if (!currentStep.value || !currentStep.value.role) {
          ElMessage.error('当前步骤信息不存在');
          return;
        }

        try {
          const role = currentStep.value.role;
          resettingRoles.value.add(role);
          await apiClient.resetWorkflow(platformId.value, versionId.value, role);
          ElMessage.success(`已重置到 ${getRoleDisplayName(role)}，请点击"开始执行"按钮继续`);
          currentStep.value = null;

          // 刷新页面以更新工作流状态
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error: any) {
          console.error('Failed to reset workflow:', error);
          ElMessage.error('重置失败: ' + (error.message || '未知错误'));
        } finally {
          const role = currentStep.value?.role;
          if (role) {
            resettingRoles.value.delete(role);
          }
        }
        break;

      case 'skip':
        ElMessage.warning('已跳过当前步骤');
        currentStep.value = null;
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

async function sendCliMessage() {
  if (!cliMessage.value.trim()) {
    ElMessage.warning('请输入修改要求');
    return;
  }
  if (!platformId.value || !versionId.value) {
    ElMessage.warning('平台ID或版本ID不存在');
    return;
  }
  const message = cliMessage.value.trim();
  const inputLogId = pushRuntimeLog({
    title: 'CLI input',
    content: message,
    type: 'input',
    source: 'cli',
  });
  cliHistory.value.push({ role: 'user', content: message, logId: inputLogId });
  cliMessage.value = '';
  cliSending.value = true;
  try {
    const scope = currentStep.value ? 'pending' : 'last_completed';
    pushRuntimeLog({
      title: 'CLI 执行开始',
      content: scope === 'pending' ? '修改等待确认角色产物' : '修改最近完成角色产物',
      type: 'status',
      source: 'cli',
    });
    const response: any = await apiClient.editWorkflowDraftByCLI(platformId.value, versionId.value!, message, scope);
    const updatedContent = response?.data?.content || response?.content;
    if (updatedContent) {
      if (currentStep.value) {
        currentStep.value = {
          ...currentStep.value,
          content: updatedContent,
        };
      }
    }
    const responseData = response?.data;
    if (responseData?.prototypeRegenerating) {
      cliHistory.value.push({ role: 'assistant', content: 'PRD 已更新，正在通过工作流重新生成原型图...' });
      ElMessage.success('PRD 已更新，原型图重新生成已启动');
    } else {
      cliHistory.value.push({ role: 'assistant', content: '已保存草稿并更新内容。' });
      ElMessage.success('草稿已更新');
    }
    cliMessage.value = '';
  } catch (error: any) {
    console.error('Failed to edit via CLI:', error);
    ElMessage.error('CLI 修改失败: ' + (error.message || '未知错误'));
  } finally {
    cliSending.value = false;
  }
}

async function pollCliLogs() {
  if (!platformId.value || !versionId.value) return;
  try {
    const response: any = await apiClient.getCliLogs(platformId.value, versionId.value, lastCliLogTs.value || undefined);
    let logs = response?.data || response?.data?.data;
    if (response?.success && Array.isArray(logs)) {
      logs.forEach((item: any) => {
        runtimeLogs.value.push({
          id: `cli-${++logIdCounter.value}`,
          title: `CLI ${item.type}`,
          time: item.ts || new Date().toISOString(),
          content: item.message,
          type: (item.type as LogType) || 'info',
          source: 'cli',
        });
        if (!lastCliLogTs.value || new Date(item.ts).getTime() > new Date(lastCliLogTs.value).getTime()) {
          lastCliLogTs.value = item.ts;
        }
      });
      return;
    }

    if (businessLineId.value) {
      const fallbackResp: any = await apiClient.getCliLogs(businessLineId.value, versionId.value, lastCliLogTs.value || undefined);
      const fallbackLogs = fallbackResp?.data || fallbackResp?.data?.data;
      if (fallbackResp?.success && Array.isArray(fallbackLogs)) {
        fallbackLogs.forEach((item: any) => {
          runtimeLogs.value.push({
            id: `cli-${++logIdCounter.value}`,
            title: `CLI ${item.type}`,
            time: item.ts || new Date().toISOString(),
            content: item.message,
            type: (item.type as LogType) || 'info',
            source: 'cli',
          });
          if (!lastCliLogTs.value || new Date(item.ts).getTime() > new Date(lastCliLogTs.value).getTime()) {
            lastCliLogTs.value = item.ts;
          }
        });
      }
    }
  } catch (error) {
    runtimeLogs.value.push({
      id: `cli-${++logIdCounter.value}`,
      title: 'CLI error',
      time: new Date().toISOString(),
      content: 'CLI 日志轮询失败',
      type: 'error',
      source: 'cli',
    });
  }
}

function handleCliKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!cliSending.value) {
      sendCliMessage();
    }
  }
}

function scrollToLog(logId?: string) {
  if (!logId) return;
  const element = document.getElementById(`log-${logId}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearRuntimeLogs() {
  runtimeLogs.value = [];
  ElMessage.success('已清空日志');
}

function copyVisibleLogs() {
  const text = filteredLogs.value
    .map((log) => `[${log.time}] [${log.source}/${log.type}] ${log.title}${log.content ? ` - ${log.content}` : ''}`)
    .join('\n');
  if (!text) {
    ElMessage.warning('暂无可复制日志');
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    ElMessage.success('日志已复制');
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  ElMessage.success('日志已复制');
}

watch(
  () => filteredLogs.value.length,
  async () => {
    if (!autoScroll.value) return;
    await nextTick();
    if (logListRef.value) {
      logListRef.value.scrollTop = logListRef.value.scrollHeight;
    }
  }
);

async function handleQuit() {
  isRunning.value = false;
  ElMessage.info('已保存进度并退出');

  setTimeout(() => {
    if (businessLineId.value) {
      router.push(`/business-line/${businessLineId.value}/platforms`);
    } else {
      router.push('/business-lines');
    }
  }, 1000);
}

function getRoleDisplayName(role: string): string {
  return roleActionStore.getRoleDisplayName(role);
}

function getActionDisplayName(action: string): string {
  return roleActionStore.getActionDisplayName(action);
}

function viewPlatform() {
  if (platformId.value) {
    router.push(`/platform/${platformId.value}`);
  } else {
    ElMessage.info('平台详情功能开发中');
  }
}

function downloadPlatform() {
  if (!platformId.value) {
    ElMessage.error('平台ID不存在');
    return;
  }

  try {
    apiClient.downloadWorkspaceCode(platformId.value, versionId.value);
    ElMessage.success('正在下载平台文件...');
  } catch (error: any) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'));
  }
}

function handleDownloadCode() {
  if (!platformId.value) {
    ElMessage.error('平台ID不存在');
    return;
  }

  try {
    apiClient.downloadWorkspaceCode(platformId.value, versionId.value);
    ElMessage.success('正在下载全部代码...');
  } catch (error: any) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'));
  }
}

function handleDownloadDocs() {
  if (!platformId.value) {
    ElMessage.error('平台ID不存在');
    return;
  }

  try {
    apiClient.downloadWorkspaceDocs(platformId.value, versionId.value);
    ElMessage.success('正在下载文档...');
  } catch (error: any) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'));
  }
}

function openContentDialog(action: WorkflowAction) {
  let roleForAction = '';
  if (action.stepData && action.stepData.role) {
    roleForAction = action.stepData.role;
  } else {
    for (const column of workflowKanban.value) {
      if (column.actions.some((a) => a.name === action.name)) {
        roleForAction = column.role;
        break;
      }
    }
  }

  contentDialogRole.value = roleForAction;
  contentDialogAction.value = action.name;
  contentDialogContent.value = action.content || '';
  contentDialogTimestamp.value = action.timestamp || '';
  showContentDialog.value = true;
}

async function handleBack() {
  if (isRunning.value) {
    try {
      await ElMessageBox.confirm('平台还在生成中，确定要离开吗？进度将被保存。', '确认离开', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      });
      cleanup();
      if (businessLineId.value) {
        router.push(`/business-line/${businessLineId.value}/platforms`);
      } else {
        router.push('/business-lines');
      }
    } catch {
      // User cancelled
    }
  } else {
    if (businessLineId.value) {
      router.push(`/business-line/${businessLineId.value}/platforms`);
    } else {
      router.push('/business-lines');
    }
  }
}

function cleanup() {
  if (pollingController) {
    pollingController.stop();
    pollingController = null;
  }
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
  }
}

async function checkForStaleActions(stateData?: any) {
  if (!platformId.value || !versionId.value) return;

  try {
    let data = stateData;
    if (!data) {
      const response = (await apiClient.getWorkflowState(platformId.value, versionId.value)) as any;
      if (!response || !response.success) return;
      data = response.data;
    }

    const steps = data.steps || [];
    const isWorkflowFailed = data.state === 'failed';
    const hasFailedSteps = steps.some((step: any) => step.state === 'failed' && (step.retryCount || 0) < 3);

    showRecoverButton.value = isWorkflowFailed || hasFailedSteps;
  } catch (error) {
    console.error('Failed to check for stale actions:', error);
  }
}

async function handleRecover() {
  if (!platformId.value || !versionId.value || recovering.value) return;

  try {
    recovering.value = true;
    ElMessage.info('正在恢复工作流...');

    const response = (await apiClient.recoverWorkflow(platformId.value, versionId.value)) as any;

    if (response && response.success) {
      const result = response.data;
      ElMessage.success(result?.message || '工作流已恢复');
      showRecoverButton.value = false;
      await loadRunningInfo();
      await loadWorkflowInfo();
    } else {
      ElMessage.warning(response?.message || '未发现需要恢复的操作');
      showRecoverButton.value = false;
    }
  } catch (error: any) {
    console.error('Failed to recover:', error);
    ElMessage.error(error?.message || '恢复失败，请稍后重试');
  } finally {
    recovering.value = false;
  }
}

async function handleVersionChanged(version: any) {
  if (!version) return;

  ElMessage.info(`已切换到版本: ${version.versionName}`);

  // 重置状态
  completedSteps.value = [];
  workflowItems.value = [];
  workflowStructure.value = {};
  isCompleted.value = false;
  isRunning.value = false;
  currentStep.value = null;

  // Reload workflow info for the new version
  await loadWorkflowInfo();
  await loadRunningInfo();

  // Restart polling for the new version
  startWorkflowSession();
}

async function handleResetRole(role: string) {
  if (!platformId.value || !versionId.value) {
    ElMessage.error('平台ID或版本ID不存在');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要重置 ${getRoleDisplayName(role)} 及下游所有角色的工作流吗？\n\n这将清除这些角色的已完成状态，重置后需要点击"开始执行"按钮继续。`,
      '确认重置',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    resettingRoles.value.add(role);
    await apiClient.resetWorkflow(platformId.value, versionId.value, role);
    ElMessage.success(`已重置到 ${getRoleDisplayName(role)}，请点击"开始执行"按钮继续`);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to reset workflow:', error);
      ElMessage.error('重置失败: ' + (error.message || '未知错误'));
    }
  } finally {
    resettingRoles.value.delete(role);
  }
}
</script>

<style scoped>
.platform-workflow {
  width: 100%;
}

.workflow-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}

.content-left {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.left-panel {
  width: 100%;
}

.confirmation-panel {
  position: sticky;
  top: 20px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.log-filter {
  width: 110px;
}

.log-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}

.log-panel :deep(.el-card__body) {
  padding: 12px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.log-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  position: relative;
}

.log-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #e4e7ed;
  color: #606266;
}

.log-type-input .log-badge {
  background: #d9ecff;
  color: #409eff;
}

.log-type-output .log-badge {
  background: #f0f9eb;
  color: #67c23a;
}

.log-type-error .log-badge {
  background: #fde2e2;
  color: #f56c6c;
}

.log-type-status .log-badge {
  background: #faecd8;
  color: #e6a23c;
}

.log-title {
  font-weight: 600;
  font-size: 12px;
  color: #303133;
}

.log-time {
  font-size: 11px;
  color: #909399;
}

.log-empty {
  font-size: 12px;
  color: #909399;
}

.log-content {
  margin-top: 4px;
  font-size: 11px;
  color: #606266;
  white-space: pre-wrap;
}

.cli-chat-history {
  max-height: 200px;
  overflow-y: auto;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

.cli-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  cursor: pointer;
}

.cli-message:last-child {
  margin-bottom: 0;
}

.cli-message.user .cli-role {
  color: #409eff;
}

.cli-message.assistant .cli-role {
  color: #67c23a;
}

.cli-role {
  font-size: 12px;
  font-weight: 600;
}

.cli-content {
  font-size: 12px;
  white-space: pre-wrap;
  color: #606266;
}

.cli-status {
  font-size: 12px;
  color: #e6a23c;
  margin-bottom: 6px;
}

.cli-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.cli-panel {
  flex: 1;
}

@media (max-width: 1200px) {
  .workflow-content {
    grid-template-columns: 1fr;
  }

  .confirmation-panel {
    position: static;
  }
}
</style>
