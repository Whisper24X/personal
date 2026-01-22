<template>
  <div class="project-interactive">
    <ProjectInteractiveHeader @back="handleBack" />

    <ProjectInfoCard :project-name="projectName" :user-idea="userIdea" 
      @download-code="handleDownloadCode" @download-docs="handleDownloadDocs" />

    <WorkflowKanban :workflow-kanban="workflowKanban" :is-running="isRunning" :running-role="runningRole"
      :current-action="currentAction" :current-stage-name="currentStageName" :resetting-roles="resettingRoles"
      :get-role-display-name="getRoleDisplayName" :get-role-description="getRoleDescription"
      :get-action-display-name="getActionDisplayName" :get-action-description="getActionDescription"
      :get-stage-tag-type="getStageTagType" :show-recover-button="showRecoverButton" :recovering="recovering"
      @reset-role="handleResetRole" @recover="handleRecover"
      @show-confirmation="showConfirmationDialog = true" @view-content="openContentDialog"
      @download-zip="downloadZip" />

    <CompletionCard v-if="isCompleted" :completed-steps="completedSteps" :start-time="startTime"
      @view-project="viewProject" @download-project="downloadProject" />

    <!-- Confirmation Dialog -->
    <el-dialog v-model="showConfirmationDialog"
      :title="currentStep ? `${getRoleDisplayName(currentStep.role)} - ${getActionDisplayName(currentStep.action)}` : '确认操作'"
      width="80%" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false" destroy-on-close>
      <div v-if="currentStep">
        <InteractiveConfirmation :role-info="currentStep" :loading="actionLoading" :project-id="projectId"
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
import InteractiveConfirmation from './components/InteractiveConfirmation.vue';
import ProjectInteractiveHeader from './components/ProjectInteractiveHeader.vue';
import ProjectInfoCard from './components/ProjectInfoCard.vue';
import WorkflowKanban from './components/WorkflowKanban.vue';
import CompletionCard from './components/CompletionCard.vue';
import ContentDialog from './components/ContentDialog.vue';
import apiClient from '../../api/client';
import { createPolling, type PollingResult } from '../../utils/polling';
import { useRoleActionStore } from '../../stores/roleAction';
import { getStageName, getStageTagType as getStageColor } from '../../config/stageConfig';
import { handleApiError } from '../../utils/errorHandler';
import type { WorkflowAction } from './components/ActionCard.vue';
import type { WorkflowRoleColumn } from './components/KanbanColumn.vue';

const route = useRoute();
const router = useRouter();
const roleActionStore = useRoleActionStore();

// Project Info
const projectId = ref((route.params.id as string) || (route.query.id as string) || '');
const projectName = ref(route.query.name as string || 'Untitled Project');
const userIdea = ref(route.query.idea as string || '');

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
// Workflow items from /api/workflow/:projectId/state endpoint
// This is the primary source of truth for role and action statuses
const workflowItems = ref<any[]>([]);

// Computed kanban board data
const workflowKanban = computed<WorkflowRoleColumn[]>(() => {
  const columns: WorkflowRoleColumn[] = [];

  // If workflow structure is not loaded yet, return empty array
  if (!workflowStructure.value || Object.keys(workflowStructure.value).length === 0) {
    return columns;
  }

  // Create a map of completed steps by role and action
  const completedMap = new Map<string, any>();
  completedSteps.value.forEach(step => {
    const key = `${step.role}-${step.action}`;
    completedMap.set(key, step);
  });

  // Create a map of workflow items status from API
  const workflowItemsMap = new Map<string, any>();
  workflowItems.value.forEach(item => {
    if (item.role && item.action) {
      const key = `${item.role}-${item.action}`;
      workflowItemsMap.set(key, item);
    }
  });

  // Process each role
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

      // Priority: workflowItem status (from API) > currentStep > completedStep > running state
      // Use workflowItem status as primary source of truth from /running API
      if (workflowItem) {
        // Use status from workflow items API (primary source)
        const itemStatus = workflowItem.status;
        if (itemStatus === 'completed') {
          status = 'completed';
          // If we have completedStep data, use it for additional info
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
        // Waiting for confirmation (from confirmationRequired)
        status = 'waiting';
        content = currentStep.value.content;
        outputFiles = currentStep.value.outputFiles;
        stepData = currentStep.value;
      } else if (completedStep) {
        // Fallback to local completed step
        status = 'completed';
        userAction = completedStep.userAction;
        timestamp = completedStep.timestamp;
        content = completedStep.content;
        outputFiles = completedStep.outputFiles;
        zipPath = completedStep.zipPath;
        zipType = completedStep.zipType;
        stepData = completedStep;
      } else if (isRunning.value && runningRole.value === role && currentAction.value === actionName) {
        // Fallback: Check if this action is currently running (from local state)
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

// Refs removed - handled by components

// Load workflow information from API (使用新的工作流 API)
async function loadWorkflowInfo() {
  if (!projectId.value) {
    return;
  }

  try {
    workflowLoading.value = true;
    const response = await apiClient.getWorkflowExecution(projectId.value) as any;

    if (response && response.success && response.data) {
      const execution = response.data;
      
      // Convert workflowSnapshot to workflow structure format
      if (execution.workflowSnapshot && execution.workflowSnapshot.roles) {
        const structure: Record<string, string[]> = {};
        // Sort roles by order
        const sortedRoles = [...execution.workflowSnapshot.roles].sort((a: any, b: any) => a.order - b.order);
        sortedRoles.forEach((roleConfig: any) => {
          structure[roleConfig.profile] = roleConfig.actions || [];
        });
        workflowStructure.value = structure;
      }

      // Update workflow items from steps array
      if (execution.steps && Array.isArray(execution.steps)) {
        // Map new steps format to old workflowItems format
        workflowItems.value = execution.steps.map((step: any) => ({
          role: step.role,
          action: step.action,
          status: step.state, // state -> status
          role_order: step.roleIndex,
          action_order: step.actionIndex,
          retry_count: step.retryCount,
        }));

        // Restore completed steps from steps
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
    // Fallback: use role actions from store to build workflow structure
    if (roleActionStore.roles.length > 0) {
      const structure: Record<string, string[]> = {};
      roleActionStore.roles.forEach((role) => {
        structure[role.profile] = role.actions.map((action) => action.name);
      });
      workflowStructure.value = structure;
    } else {
      // If store is not loaded yet, use a minimal default structure
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

// Track previous state for transition feedback
let previousWorkflowState = '';
let previousRole = '';

/**
 * Process workflow state data - unified function for both initial load and polling updates
 * @param stateData - Workflow state data from API
 * @param showMessages - Whether to show UI messages for state changes
 */
function processWorkflowState(stateData: any, showMessages: boolean = false) {
  const currentWorkflowState = stateData.state;
  const newRole = stateData.currentRole || '';
  const newAction = stateData.currentAction || '';

  // Update workflow items from steps array
  if (stateData.steps?.length) {
    workflowItems.value = stateData.steps.map((step: any) => ({
      role: step.role,
      action: step.action,
      status: step.state,
      role_order: step.roleIndex,
      action_order: step.actionIndex,
      retry_count: step.retryCount,
    }));

    // Update completed steps
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

  // Update running state with transition feedback
  const roleChanged = newRole && newRole !== previousRole;
  if (newRole) runningRole.value = newRole;
  if (newAction) currentAction.value = newAction;
  if (newRole && newAction) {
    currentStageName.value = getStageName(newRole, newAction);
  }

  // Show role transition message
  if (showMessages && roleChanged && previousRole && currentWorkflowState === 'running') {
    const roleName = roleActionStore.getRoleDisplayName(newRole) || newRole;
    ElMessage.info(`正在执行: ${roleName}`);
  }

  // Handle state transitions with improved feedback
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

    // Show notification for waiting state
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
      ElMessage.success('项目生成完成！');
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
    // Other states (initialized, paused)
    isRunning.value = false;
    currentStep.value = null;
    showConfirmationDialog.value = false;
  }

  // Update previous state for next comparison
  previousWorkflowState = currentWorkflowState;
  previousRole = newRole;

  // Check for stale/failed actions
  checkForStaleActions(stateData);
}

/**
 * Load current running state and workflow items from API
 */
async function loadRunningInfo() {
  if (!projectId.value) return;

  try {
    const response = await apiClient.getWorkflowState(projectId.value) as any;
    if (response?.success && response.data) {
      processWorkflowState(response.data);
    }
  } catch (error: any) {
    console.error('Failed to load running info:', error);
  }
}

onMounted(async () => {
  // Load roles and actions metadata
  await roleActionStore.fetchRolesAndActions();

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
      }
    } catch (err: any) {
      console.warn('Failed to load project info:', err);
      // Continue with query params or default values
    }
  }

  // Load running info if projectId exists (for existing projects)
  if (projectId.value) {
    await loadRunningInfo();
  }

  // Check for stale actions periodically (every 30 seconds)
  checkForStaleActions();
  staleCheckInterval = setInterval(() => {
    checkForStaleActions();
  }, 30000);

  startInteractiveSession();
});

onUnmounted(() => {
  cleanup();
});

// Watch currentStep to show dialog automatically
watch(currentStep, (newStep) => {
  if (newStep) {
    showConfirmationDialog.value = true;
  } else {
    showConfirmationDialog.value = false;
  }
}, { immediate: true });

// Auto-scroll functionality can be added later if needed
// Currently handled by component-level scrolling

async function startInteractiveSession() {
  try {
    // 如果工作流已完成，直接加载信息并开始轮询，不要尝试启动
    if (isCompleted.value) {
      await loadWorkflowInfo();
      startPolling(projectId.value);
      return;
    }

    isRunning.value = true;
    startTime.value = Date.now();

    // Set default first stage: Salesperson (市场研究阶段)
    currentStageName.value = '市场研究阶段';
    runningRole.value = 'Salesperson';

    // Check if project already exists
    if (!projectId.value) {
      // Create project first if no projectId
      const queryIdea = route.query.idea as string;
      const finalIdea = (userIdea.value && userIdea.value.trim()) || (queryIdea && queryIdea.trim()) || '';
      const finalName = (projectName.value && projectName.value.trim()) || 'Untitled Project';

      // Validate required fields
      if (!finalName || finalName.trim() === '' || finalName === 'Untitled Project') {
        throw new Error('项目名称不能为空');
      }
      if (!finalIdea || finalIdea.trim() === '') {
        throw new Error('项目想法不能为空，请提供项目描述');
      }

      // Create project via API
      const projectResponse = await apiClient.createProject({
        name: finalName,
        idea: finalIdea,
        description: route.query.description as string,
        investment: parseFloat(route.query.investment as string) || 10.0,
        applicationId: route.query.applicationId as string,
      }) as any;

      if (projectResponse.project?.id) {
        projectId.value = projectResponse.project.id;
      } else if (projectResponse.id) {
        projectId.value = projectResponse.id;
      }

      if (!projectId.value) {
        throw new Error('创建项目失败：未获取到项目ID');
      }
    }

    // Load workflow information
    await loadWorkflowInfo();

    // Start workflow via new API
    try {
      await apiClient.startWorkflow(projectId.value);
      console.log('Workflow started successfully');
    } catch (error: any) {
      // Workflow might already be running, continue with polling
      console.warn('Start workflow warning:', error.message);
    }

    // Start polling for workflow state
    startPolling(projectId.value);
  } catch (error: any) {
    handleApiError(error, '启动会话失败');
    isRunning.value = false;
  }
}

// Dynamic polling interval based on workflow state
function getPollingInterval(): number {
  if (isRunning.value) return 1000;           // Running: poll every 1 second
  if (showConfirmationDialog.value) return 3000; // Waiting confirmation: every 3 seconds
  return 5000;                                 // Other states: every 5 seconds
}

function startPolling(projectIdToUse: string) {
  try {
    // Stop existing polling if any
    if (pollingController) {
      pollingController.stop();
      pollingController = null;
    }

    ElMessage.success('已连接到服务器');

    // Create polling instance with dynamic interval
    pollingController = createPolling(
      async () => {
        const response = await apiClient.getWorkflowState(projectIdToUse) as any;
        return response;
      },
      (data: any) => {
        if (data?.success && data.data) {
          handleWorkflowStateUpdate(data.data);
        }
      },
      {
        getInterval: getPollingInterval, // Dynamic interval based on state
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

/**
 * Handle workflow state updates from polling (with UI messages)
 */
function handleWorkflowStateUpdate(stateData: any) {
  processWorkflowState(stateData, true);
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

    // Send confirmation to backend via new workflow API
    // This will transition workflow from waiting_confirmation to running state
    try {
      await apiClient.confirmWorkflow(projectId.value);
      console.log('Workflow confirmation sent successfully');
    } catch (error: any) {
      console.error('Failed to send confirmation:', error);
      ElMessage.error('确认操作失败: ' + (error.message || '未知错误'));
      actionLoading.value = false;
      return;
    }

    // Handle UI updates
    switch (action) {
      case 'continue':
      case 'edit':
        ElMessage.success('已确认，等待下一步...');
        // Close dialog
        showConfirmationDialog.value = false;
        // Clear current step - backend will send next confirmation_required
        currentStep.value = null;
        // Set running state to show loading indicator
        isRunning.value = true;
        // Clear runningRole and currentAction to wait for next role_start message
        // This ensures the next role will be correctly identified when role_start arrives
        runningRole.value = '';
        currentAction.value = '';
        // Keep stage name until next role_start message updates it
        break;

      case 'regenerate':
        ElMessage.info('重新生成中...');
        // Close dialog
        showConfirmationDialog.value = false;
        // Keep currentStep to show regeneration in progress
        // Backend will send new confirmation_required when done
        break;

      case 'skip':
        ElMessage.warning('已跳过当前步骤');
        // Close dialog
        showConfirmationDialog.value = false;
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

// Stage tag type getter using current stage name
function getStageTagType(): 'success' | 'warning' | 'info' | 'danger' {
  return getStageColor(currentStageName.value);
}

/**
 * 获取角色描述
 */
function getRoleDescription(role: string): string {
  return roleActionStore.getRoleDescription(role);
}

/**
 * 获取Action描述
 */
function getActionDescription(action: string): string {
  return roleActionStore.getActionDescription(action);
}

/**
 * 获取角色显示名称
 */
function getRoleDisplayName(role: string): string {
  return roleActionStore.getRoleDisplayName(role);
}

/**
 * 获取Action显示名称
 */
function getActionDisplayName(action: string): string {
  return roleActionStore.getActionDisplayName(action);
}

// Action status helpers moved to ActionCard component

function viewProject() {
  if (projectId.value) {
    router.push(`/project/${projectId.value}`);
  } else {
    ElMessage.info('项目详情功能开发中');
  }
}

function downloadProject() {
  if (!projectId.value) {
    ElMessage.error('项目ID不存在');
    return;
  }

  try {
    apiClient.downloadWorkspaceCode(projectId.value);
    ElMessage.success('正在下载项目文件...');
  } catch (error: any) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'));
  }
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

function handleDownloadCode() {
  if (!projectId.value) {
    ElMessage.error('项目ID不存在');
    return;
  }

  try {
    apiClient.downloadWorkspaceCode(projectId.value);
    ElMessage.success('正在下载全部代码...');
  } catch (error: any) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'));
  }
}

function handleDownloadDocs() {
  if (!projectId.value) {
    ElMessage.error('项目ID不存在');
    return;
  }

  try {
    apiClient.downloadWorkspaceDocs(projectId.value);
    ElMessage.success('正在下载文档...');
  } catch (error: any) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'));
  }
}

function openContentDialog(action: WorkflowAction) {
  // Get role from stepData if available, otherwise find from workflowKanban
  let roleForAction = '';
  if (action.stepData && action.stepData.role) {
    roleForAction = action.stepData.role;
  } else {
    // Fallback: find role from workflowKanban
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
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
  }
}

/**
 * Check for stale/failed actions to show recover button
 * 使用新的工作流状态格式
 */
async function checkForStaleActions(stateData?: any) {
  if (!projectId.value) return;

  try {
    // Use passed stateData or fetch new state
    let data = stateData;
    if (!data) {
      const response = await apiClient.getWorkflowState(projectId.value) as any;
      if (!response || !response.success) return;
      data = response.data;
    }

    const steps = data.steps || [];

    // Check for failed workflow state
    const isWorkflowFailed = data.state === 'failed';

    // Check for any step in running state that might be stale
    // (The new system handles stale detection on the backend, but we still show the button for failed state)
    const hasFailedSteps = steps.some((step: any) =>
      step.state === 'failed' && (step.retryCount || 0) < 3
    );

    showRecoverButton.value = isWorkflowFailed || hasFailedSteps;
  } catch (error) {
    console.error('Failed to check for stale actions:', error);
  }
}

/**
 * Handle recovery from stale/failed actions
 * 使用新的工作流恢复 API
 */
async function handleRecover() {
  if (!projectId.value || recovering.value) return;

  try {
    recovering.value = true;
    ElMessage.info('正在恢复工作流...');

    const response = await apiClient.recoverWorkflow(projectId.value) as any;

    if (response && response.success) {
      const result = response.data;
      ElMessage.success(result?.message || '工作流已恢复');
      showRecoverButton.value = false;

      // Reload workflow state
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

/**
 * Handle reset workflow from a specific role
 * This will reset the role and all downstream roles to pending status
 * Reset 只重置状态到 INITIALIZED，用户需要点击"开始执行"按钮来启动
 */
async function handleResetRole(role: string) {
  if (!projectId.value) {
    ElMessage.error('项目ID不存在');
    return;
  }

  try {
    // Confirm reset action
    await ElMessageBox.confirm(
      `确定要重置 ${getRoleDisplayName(role)} 及下游所有角色的工作流吗？\n\n这将清除这些角色的已完成状态，重置后需要点击"开始执行"按钮继续。`,
      '确认重置',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // Set loading state
    resettingRoles.value.add(role);

    // Call reset API - resets state to INITIALIZED
    // 不自动调用 start，让用户手动点击"开始执行"按钮
    await apiClient.resetWorkflow(projectId.value, role);
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
/* Page-level styles only - component styles are in their respective child components */
.project-interactive {
  width: 100%;
}
</style>
