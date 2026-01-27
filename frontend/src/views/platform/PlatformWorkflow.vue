<template>
  <div class="platform-workflow">
    <PlatformWorkflowHeader @back="handleBack" />

    <PlatformInfoCard :platform-id="platformId" :platform-name="platformName" :user-idea="userIdea" 
      @download-code="handleDownloadCode" @download-docs="handleDownloadDocs" @version-changed="handleVersionChanged" />

    <WorkflowKanban :workflow-kanban="workflowKanban" :is-running="isRunning" :running-role="runningRole"
      :current-action="currentAction" :current-stage-name="currentStageName" :resetting-roles="resettingRoles"
      :get-role-display-name="getRoleDisplayName" :get-role-description="getRoleDescription"
      :get-action-display-name="getActionDisplayName" :get-action-description="getActionDescription"
      :get-stage-tag-type="getStageTagType" :show-recover-button="showRecoverButton" :recovering="recovering"
      @reset-role="handleResetRole" @recover="handleRecover"
      @show-confirmation="showConfirmationDialog = true" @view-content="openContentDialog"
      @download-zip="downloadZip" />

    <CompletionCard v-if="isCompleted" :completed-steps="completedSteps" :start-time="startTime"
      @view-project="viewPlatform" @download-project="downloadPlatform" />

    <!-- Confirmation Dialog -->
    <el-dialog v-model="showConfirmationDialog"
      :title="currentStep ? `${getRoleDisplayName(currentStep.role)} - ${getActionDisplayName(currentStep.action)}` : '确认操作'"
      width="80%" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false" destroy-on-close>
      <div v-if="currentStep">
        <InteractiveConfirmation :role-info="currentStep" :loading="actionLoading" :project-id="platformId"
          :hide-card="true" @action="handleUserAction" />
      </div>
    </el-dialog>

    <!-- Content View Dialog -->
    <ContentDialog v-model="showContentDialog" :role="contentDialogRole" :action="contentDialogAction"
      :content="contentDialogContent" :timestamp="contentDialogTimestamp"
      :role-display-name="contentDialogRole ? getRoleDisplayName(contentDialogRole) : ''"
      :action-display-name="contentDialogAction ? getActionDisplayName(contentDialogAction) : ''" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
// Import shared components from project folder
import InteractiveConfirmation from '../project/components/InteractiveConfirmation.vue';
import WorkflowKanban from '../project/components/WorkflowKanban.vue';
import CompletionCard from '../project/components/CompletionCard.vue';
import ContentDialog from '../project/components/ContentDialog.vue';
// Import platform-specific components
import PlatformWorkflowHeader from './components/PlatformWorkflowHeader.vue';
import PlatformInfoCard from './components/PlatformInfoCard.vue';
import apiClient from '../../api/client';
import { createPolling, type PollingResult } from '../../utils/polling';
import { useRoleActionStore } from '../../stores/roleAction';
import { getStageName, getStageTagType as getStageColor } from '../../config/stageConfig';
import { handleApiError } from '../../utils/errorHandler';
import type { WorkflowAction } from '../project/components/ActionCard.vue';
import type { WorkflowRoleColumn } from '../project/components/KanbanColumn.vue';

const route = useRoute();
const router = useRouter();
const roleActionStore = useRoleActionStore();

// Platform Info
const platformId = ref(route.params.id as string || '');
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
const showConfirmationDialog = ref(false);

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
  completedSteps.value.forEach(step => {
    const key = `${step.role}-${step.action}`;
    completedMap.set(key, step);
  });

  const workflowItemsMap = new Map<string, any>();
  workflowItems.value.forEach(item => {
    if (item.role && item.action) {
      const key = `${item.role}-${item.action}`;
      workflowItemsMap.set(key, item);
    }
  });

  Object.entries(workflowStructure.value).forEach(([role, actions]) => {
    const roleActions: WorkflowAction[] = actions.map(actionName => {
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

    const completedCount = roleActions.filter(a => a.status === 'completed').length;
    const isActive = runningRole.value === role ||
      (currentStep.value && currentStep.value.role === role) ||
      roleActions.some(a => a.status === 'running' || a.status === 'waiting');

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
    const response = await apiClient.getWorkflowExecution(platformId.value, versionId.value) as any;

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
        const existingKeys = new Set(completedSteps.value.map(s => `${s.role}-${s.action}`));
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
      workflowStructure.value = {
        Salesperson: ['WriteMRD'],
        ProductManager: ['WritePRD', 'SearchEnhancedQA'],
        Architect: ['WriteDesign'],
        ProjectManager: ['BreakdownTasks', 'WriteSubProjectDesign', 'GenerateTask'],
        Engineer: ['WriteCode', 'ExecuteSubtask'],
        QAEngineer: ['WriteTest'],
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
    const existingKeys = new Set(completedSteps.value.map(s => `${s.role}-${s.action}`));
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
      instructContent: pendingConfirmation.instructContent || {},
      retryCount: 0,
    };

    const roleToShow = pendingConfirmation.role || newRole;
    const actionToShow = pendingConfirmation.action || newAction;
    if (roleToShow) runningRole.value = roleToShow;
    if (actionToShow) currentAction.value = actionToShow;
    if (roleToShow && actionToShow) {
      currentStageName.value = getStageName(roleToShow, actionToShow);
    }
    showConfirmationDialog.value = true;

    if (showMessages && stateChanged) {
      const actionName = roleActionStore.getActionDisplayName(actionToShow) || actionToShow;
      ElMessage.warning(`需要确认: ${actionName}`);
    }
  } else if (currentWorkflowState === 'completed') {
    isRunning.value = false;
    isCompleted.value = true;
    currentStep.value = null;
    showConfirmationDialog.value = false;
    if (showMessages && stateChanged) {
      ElMessage.success('平台生成完成！');
    }
  } else if (currentWorkflowState === 'failed') {
    isRunning.value = false;
    currentStep.value = null;
    showConfirmationDialog.value = false;
    showRecoverButton.value = true;
    if (showMessages && stateChanged) {
      ElMessage.error('工作流执行失败，请尝试恢复');
    }
  } else if (currentWorkflowState === 'running') {
    isRunning.value = true;
    currentStep.value = null;
    showConfirmationDialog.value = false;
  } else {
    isRunning.value = false;
    currentStep.value = null;
    showConfirmationDialog.value = false;
  }

  previousWorkflowState = currentWorkflowState;
  previousRole = newRole;
  checkForStaleActions(stateData);
}

async function loadRunningInfo() {
  if (!platformId.value || !versionId.value) return;

  try {
    const response = await apiClient.getWorkflowState(platformId.value, versionId.value) as any;
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
      const response = await apiClient.getPlatform(platformId.value) as any;
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
        const versionResponse = await apiClient.getPlatformVersion(platformId.value, versionId.value) as any;
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
});

onUnmounted(() => {
  cleanup();
});

watch(currentStep, (newStep) => {
  if (newStep) {
    showConfirmationDialog.value = true;
  } else {
    showConfirmationDialog.value = false;
  }
}, { immediate: true });

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
  if (showConfirmationDialog.value) return 3000;
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
        const response = await apiClient.getWorkflowState(platformIdToUse, versionIdToUse) as any;
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
      timestamp: new Date().toLocaleTimeString(),
      content: modifiedContent || currentStep.value.content,
      outputFiles: currentStep.value.outputFiles || [],
      zipPath: currentStep.value.instructContent?.zipPath,
      zipType: currentStep.value.instructContent?.type,
    };

    completedSteps.value.push(step);

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
        showConfirmationDialog.value = false;
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
          showConfirmationDialog.value = false;
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
        showConfirmationDialog.value = false;
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

function getStageTagType(): 'success' | 'warning' | 'info' | 'danger' {
  return getStageColor(currentStageName.value);
}

function getRoleDescription(role: string): string {
  return roleActionStore.getRoleDescription(role);
}

function getActionDescription(action: string): string {
  return roleActionStore.getActionDescription(action);
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

async function downloadZip(zipPath: string) {
  if (!zipPath || !platformId.value) {
    ElMessage.error('压缩包路径或平台ID不存在');
    return;
  }

  try {
    await apiClient.downloadZip(platformId.value, zipPath);
    ElMessage.success('压缩包下载已开始');
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
      if (column.actions.some(a => a.name === action.name)) {
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
      await ElMessageBox.confirm(
        '平台还在生成中，确定要离开吗？进度将被保存。',
        '确认离开',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      );
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
      const response = await apiClient.getWorkflowState(platformId.value, versionId.value) as any;
      if (!response || !response.success) return;
      data = response.data;
    }

    const steps = data.steps || [];
    const isWorkflowFailed = data.state === 'failed';
    const hasFailedSteps = steps.some((step: any) =>
      step.state === 'failed' && (step.retryCount || 0) < 3
    );

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

    const response = await apiClient.recoverWorkflow(platformId.value, versionId.value) as any;

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
  showConfirmationDialog.value = false;
  
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
</style>
