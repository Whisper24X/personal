<template>
  <div class="project-interactive">
    <ProjectInteractiveHeader @back="handleBack" />

    <ProjectInfoCard :project-name="projectName" :user-idea="userIdea" />

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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
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

// Stats moved to CompletionCard component

// Types are imported from components

// Workflow structure: role -> actions mapping (loaded from API)
const workflowStructure = ref<Record<string, string[]>>({});
const workflowLoading = ref(false);
// Workflow items from /api/interactive/:projectId/running endpoint
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

  // Create a map of action_order and role_order from workflowItems for sorting
  const actionOrderMap = new Map<string, number>();
  const roleOrderMap = new Map<string, number>();
  workflowItems.value.forEach(item => {
    if (item.role && item.action && item.action_order !== null && item.action_order !== undefined) {
      const key = `${item.role}-${item.action}`;
      actionOrderMap.set(key, item.action_order);
    }
    if (item.role && (item as any).role_order !== null && (item as any).role_order !== undefined) {
      if (!roleOrderMap.has(item.role)) {
        roleOrderMap.set(item.role, (item as any).role_order);
      }
    }
  });

  // Sort roles by role_order if available
  const sortedRoles = Object.entries(workflowStructure.value).sort(([roleA], [roleB]) => {
    const orderA = roleOrderMap.get(roleA) ?? 999;
    const orderB = roleOrderMap.get(roleB) ?? 999;
    return orderA - orderB;
  });

  // Process each role
  sortedRoles.forEach(([role, actions]) => {
    // Sort actions by action_order if available, otherwise keep original order
    const sortedActions = [...actions].sort((a, b) => {
      const keyA = `${role}-${a}`;
      const keyB = `${role}-${b}`;
      const orderA = actionOrderMap.get(keyA) ?? 999;
      const orderB = actionOrderMap.get(keyB) ?? 999;
      return orderA - orderB;
    });

    const roleActions: WorkflowAction[] = sortedActions.map(actionName => {
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
          // Clear any stale completed step data when action is running
          userAction = undefined;
          timestamp = undefined;
          content = undefined;
          outputFiles = undefined;
          zipPath = undefined;
          zipType = undefined;
          stepData = undefined;
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
        // Only use this if workflowItem doesn't exist (shouldn't happen, but safety fallback)
        status = 'running';
      }
      
      // Debug: Log status changes for QAEngineer actions (only in development)
      if (import.meta.env.DEV && role === 'QAEngineer' && (status === 'running' || status === 'completed')) {
        console.debug(`[QAEngineer Status] ${actionName}: ${status}`, {
          workflowItem: workflowItem ? { status: workflowItem.status } : null,
          isRunning: isRunning.value,
          runningRole: runningRole.value,
          currentAction: currentAction.value,
        });
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
let lastMessageId: string | null = null;

// Refs removed - handled by components

// Load workflow information from API
async function loadWorkflowInfo() {
  if (!projectId.value) {
    return;
  }

  try {
    workflowLoading.value = true;
    const response = await apiClient.getInteractiveWorkflow(projectId.value) as any;

    if (response && response.roles) {
      // Convert API response to workflow structure format
      const structure: Record<string, string[]> = {};
      response.roles.forEach((roleInfo: any) => {
        structure[roleInfo.role] = roleInfo.actions.map((action: any) => action.name);
      });
      workflowStructure.value = structure;

      // Update workflow items from API response
      if (response.items && Array.isArray(response.items)) {
        // Force reactivity by creating a new array reference
        workflowItems.value = [...response.items];

        // Restore completed steps from workflow items
        const completedItems = response.items.filter((item: any) => item.status === 'completed');
        // Only restore if we don't already have these steps (to avoid duplicates)
        const existingKeys = new Set(completedSteps.value.map(s => `${s.role}-${s.action}`));
        const newSteps = completedItems
          .filter((item: any) => item.role && item.action && !existingKeys.has(`${item.role}-${item.action}`))
          .map((item: any) => ({
            role: item.role,
            action: item.action,
            userAction: 'skip', // Default, will be updated if we have more info
            timestamp: new Date().toISOString(),
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
      // This should rarely happen as we load store in onMounted
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

/**
 * Load current running state and workflow items from /api/interactive/:projectId/running
 * This is the primary source of truth for rendering role and action statuses in the UI
 */
async function loadRunningInfo() {
  if (!projectId.value) {
    return;
  }

  try {
    // Call /api/interactive/:projectId/running endpoint
    const response = await apiClient.getInteractiveRunning(projectId.value) as any;

    if (!response || !response.success) {
      return;
    }

    // Update workflow items from API response (primary source for status rendering)
    // This array contains all workflow items with their current status (pending/running/completed)
    if (response.items && Array.isArray(response.items)) {
      // Force reactivity by creating a new array reference
      // This ensures Vue detects the change even if the array structure is similar
      const newItems = [...response.items];
      
      // Debug: Log QAEngineer status changes
      if (import.meta.env.DEV) {
        const qaItems = newItems.filter((item: any) => item.role === 'QAEngineer');
        const runningQa = qaItems.find((item: any) => item.status === 'running');
        const oldRunningQa = workflowItems.value.find((item: any) => item.role === 'QAEngineer' && item.status === 'running');
        if (runningQa && (!oldRunningQa || oldRunningQa.action !== runningQa.action)) {
          console.log(`[loadRunningInfo] QAEngineer action changed: ${oldRunningQa?.action || 'none'} -> ${runningQa.action}`);
        }
      }
      
      // Force reactivity update by assigning new array reference
      // Vue 3 reactivity should detect array reference changes automatically
      workflowItems.value = newItems;

      // Update completed steps from workflow items
      const completedItems = response.items.filter((item: any) => item.status === 'completed');
      const existingKeys = new Set(completedSteps.value.map(s => `${s.role}-${s.action}`));
      const newSteps = completedItems
        .filter((item: any) => item.role && item.action && !existingKeys.has(`${item.role}-${item.action}`))
        .map((item: any) => ({
          role: item.role,
          action: item.action,
          userAction: 'skip', // Default, will be updated if we have more info
          timestamp: new Date().toISOString(),
          content: undefined,
          outputFiles: undefined,
          zipPath: undefined,
          zipType: undefined,
        }));
      completedSteps.value.push(...newSteps);
    }

    // Update running state from API response
    const runningState = response.running || { role: null, action: null };

    if (runningState.role) {
      runningRole.value = runningState.role;
    }
    if (runningState.action) {
      currentAction.value = runningState.action;
    }

    if (runningState.role && runningState.action) {
      currentStageName.value = getStageName(runningState.role, runningState.action);
    }

    // Check for stale/failed actions to show recover button
    await checkForStaleActions(response);

    // Handle confirmation state (waiting for manual confirmation)
    const requiresConfirmation = response.requiresConfirmation || false;
    const confirmationRequired = response.confirmationRequired;

    // If confirmation is required, show confirmation dialog
    if (requiresConfirmation && confirmationRequired) {
      // Workflow is paused waiting for confirmation
      isRunning.value = false;

      // Set current step for confirmation dialog
      currentStep.value = {
        role: confirmationRequired.role,
        action: confirmationRequired.action,
        content: confirmationRequired.content,
        outputFiles: confirmationRequired.outputFiles || [],
        instructContent: confirmationRequired.instructContent || {},
        retryCount: confirmationRequired.retryCount || 0,
      };

      // Update running role and action for display
      const roleToShow = confirmationRequired.role || runningState.role;
      const actionToShow = confirmationRequired.action || runningState.action;

      if (roleToShow) {
        runningRole.value = roleToShow;
      }
      if (actionToShow) {
        currentAction.value = actionToShow;
      }
      if (roleToShow && actionToShow) {
        currentStageName.value = getStageName(roleToShow, actionToShow);
      }

      // Show confirmation dialog
      showConfirmationDialog.value = true;
    } else {
      // Workflow is running (no confirmation required)
      // Check if there's a running state
      if (runningState.role && runningState.action) {
        isRunning.value = true;
        // Clear current step if workflow is running
        currentStep.value = null;
        showConfirmationDialog.value = false;
      } else {
        // No running state, workflow might be idle or completed
        isRunning.value = false;
        currentStep.value = null;
        showConfirmationDialog.value = false;
      }
    }
  } catch (error: any) {
    console.error('Failed to load running info:', error);
    // Don't show error message for this, as it's called frequently
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
    await loadWorkflowInfo();
    // Start polling for existing projects
    startPolling(projectId.value);
  } else {
    // Only start new session if projectId doesn't exist
    startInteractiveSession();
  }

  // Check for stale actions periodically (every 30 seconds)
  checkForStaleActions();
  staleCheckInterval = setInterval(() => {
    checkForStaleActions();
  }, 30000);
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

    // Update projectId from response
    if (data.projectId) {
      projectId.value = data.projectId;
    } else if (data.project?.id) {
      projectId.value = data.project.id;
    }

    if (!projectId.value) {
      throw new Error('Project ID not found in response');
    }


    // Load workflow information
    await loadWorkflowInfo();

    // Start polling
    startPolling(projectId.value);
  } catch (error: any) {
    ElMessage.error('启动会话失败: ' + error.message);
    isRunning.value = false;
  }
}

function startPolling(projectId: string) {
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
          // Always load running info first to get latest workflow status
          await loadRunningInfo();
          // Then poll for new messages
          const response = await apiClient.pollInteractiveMessages(projectId, lastMessageId);
          return response;
        } catch (error: any) {
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
        }
      },
      {
        interval: 1000, // Poll every 1 second
        maxRetries: 3,
        retryDelay: 2000,
        immediate: true,
        shouldContinue: () => {
          // Continue polling if project is not completed
          // Also continue if projectId exists (for existing projects)
          return !isCompleted.value && !!projectId.value;
        },
        onError: (error: Error) => {
          const errorMessage = error?.message || '未知错误';
          // Only show error for critical errors, not for network timeouts
          if (!errorMessage.includes('timeout') && !errorMessage.includes('Network')) {
            console.error('轮询错误:', errorMessage);
            // Don't show error message to user for every polling error
            // ElMessage.error('轮询错误: ' + errorMessage);
          }
        },
      }
    );
  } catch (error: any) {
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
        currentAction.value = 'WriteMRD';
      }
      // Auto-scroll handled by components
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
        // Set default action for Salesperson (usually WriteMRD)
        currentAction.value = 'WriteMRD';
      }
      // Auto-scroll handled by components
      break;

    case 'role_start':
      isRunning.value = true;
      runningRole.value = message.data.role || '';
      currentAction.value = message.data.action || '';
      currentStageName.value = getStageName(message.data.role, message.data.action);
      // Clear currentStep when a new role starts
      currentStep.value = null;
      // Auto-scroll handled by components
      // Debug: log running state
      console.log('[role_start]', {
        role: runningRole.value,
        action: currentAction.value,
        isRunning: isRunning.value,
        stage: currentStageName.value
      });
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
      // Show confirmation dialog
      showConfirmationDialog.value = true;
      break;

    case 'progress':
      // Progress is now calculated based on completed actions
      break;

    case 'completed':
      // Update projectId from completion message if provided
      if (message.data.projectId) {
        projectId.value = message.data.projectId;
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

    // Send confirmation to backend via HTTP API
    // This will clear the confirmation status in database and allow workflow to proceed
    try {
      await apiClient.confirmRoleCompletion(projectId.value, action, modifiedContent);
      console.log('Role confirmation sent successfully');
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

function complete() {
  isRunning.value = false;
  isCompleted.value = true;
  ElMessage.success('项目生成完成！');
}

// Helper functions moved to components

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
  lastMessageId = null;
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
  }
}

/**
 * Check for stale/failed actions to show recover button
 */
async function checkForStaleActions(response?: any) {
  if (!projectId.value) return;

  try {
    const data = response || await apiClient.getInteractiveRunning(projectId.value) as any;
    if (!data || !data.success) return;

    const items = data.items || [];
    const runningState = data.running || {};

    // Check for stale running action (running for more than 5 minutes)
    const hasStaleRunning = runningState.role && runningState.action &&
      runningState.updatedAt &&
      (Date.now() - new Date(runningState.updatedAt).getTime() > 5 * 60 * 1000);

    // Check for failed actions that can be retried
    const hasFailedActions = items.some((item: any) =>
      item.status === 'failed' && (item.retry_count || 0) < 3
    );

    showRecoverButton.value = hasStaleRunning || hasFailedActions;
  } catch (error) {
    console.error('Failed to check for stale actions:', error);
  }
}

/**
 * Handle recovery from stale/failed actions
 */
async function handleRecover() {
  if (!projectId.value || recovering.value) return;

  try {
    recovering.value = true;
    ElMessage.info('正在恢复工作流...');

    const response = await apiClient.recoverFromStaleActions(projectId.value) as any;

    if (response && response.success) {
      ElMessage.success(response.message || '工作流已恢复');
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
 */
async function handleResetRole(role: string) {
  if (!projectId.value) {
    ElMessage.error('项目ID不存在');
    return;
  }

  try {
    // Confirm reset action
    await ElMessageBox.confirm(
      `确定要重置 ${getRoleDisplayName(role)} 及下游所有角色的工作流吗？\n\n这将清除这些角色的已完成状态，需要重新执行。`,
      '确认重置',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // Set loading state
    resettingRoles.value.add(role);

    // Call API to reset workflow
    await apiClient.resetInteractiveWorkflow(projectId.value, role);

    // Remove completed steps for this role and downstream roles
    const roleOrder = [
      'Salesperson',
      'ProductManager',
      'Architect',
      'ProjectManager',
      'Engineer',
      'QAEngineer',
    ];
    const roleIndex = roleOrder.indexOf(role);
    if (roleIndex !== -1) {
      const downstreamRoles = roleOrder.slice(roleIndex);
      completedSteps.value = completedSteps.value.filter(
        step => !downstreamRoles.includes(step.role)
      );
    }

    // Reload workflow info to refresh the kanban board
    await loadWorkflowInfo();

    ElMessage.success(`已重置 ${getRoleDisplayName(role)} 及下游角色的工作流`);
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
.project-interactive {
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

.kanban-card {
  margin-bottom: 20px;
}

.kanban-board {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 0;
  min-height: 400px;
}

.kanban-column {
  flex: 1;
  min-width: 280px;
  max-width: 320px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.kanban-column.column-active {
  border-color: #409EFF;
  background: #ecf5ff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
}

.kanban-column.column-running {
  border-color: #f56c6c !important;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%) !important;
  box-shadow: 0 4px 16px rgba(245, 108, 108, 0.4) !important;
  animation: pulse-column 2s ease-in-out infinite;
  position: relative;
}

.kanban-column.column-running::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #f56c6c, #ff8787, #f56c6c);
  background-size: 200% 100%;
  animation: shimmer-border 2s linear infinite;
  border-radius: 8px 8px 0 0;
}

@keyframes pulse-column {

  0%,
  100% {
    box-shadow: 0 4px 16px rgba(245, 108, 108, 0.4);
    transform: scale(1);
  }

  50% {
    box-shadow: 0 6px 20px rgba(245, 108, 108, 0.6);
    transform: scale(1.01);
  }
}

@keyframes shimmer-border {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.role-tag-running {
  animation: pulse-tag 1.5s ease-in-out infinite;
}

@keyframes pulse-tag {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.8;
  }
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.column-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reset-button {
  font-size: 12px;
  padding: 4px 8px;
}

.column-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.running-badge {
  margin-left: 4px;
}

.running-badge :deep(.el-badge__content) {
  font-size: 10px;
  padding: 2px 6px;
  animation: pulse-badge 1.5s ease-in-out infinite;
}

@keyframes pulse-badge {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.column-count {
  font-size: 12px;
  color: #909399;
  font-weight: 600;
}

.column-description {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  margin-bottom: 16px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
}

.column-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kanban-card-item {
  background: #ffffff;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #e4e7ed;
  transition: all 0.3s ease;
  cursor: pointer;
}

.kanban-card-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.kanban-card-item.card-status-pending {
  opacity: 0.6;
  border-color: #dcdfe6;
}

.kanban-card-item.card-status-running,
.kanban-card-item.action-running {
  border-color: #f56c6c !important;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%) !important;
  border-left: 5px solid #f56c6c !important;
  border-right: 2px solid #f56c6c !important;
  border-top: 2px solid #f56c6c !important;
  border-bottom: 2px solid #f56c6c !important;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3) !important;
  animation: pulse-running 2s ease-in-out infinite;
  position: relative;
  overflow: hidden;
  z-index: 10;
  transform: scale(1.02);
}

.kanban-card-item.card-status-running::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 2s infinite;
}

@keyframes pulse-running {

  0%,
  100% {
    box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3);
    transform: scale(1);
  }

  50% {
    box-shadow: 0 6px 16px rgba(245, 108, 108, 0.5);
    transform: scale(1.01);
  }
}

@keyframes shimmer {
  0% {
    left: -100%;
  }

  100% {
    left: 100%;
  }
}

.kanban-card-item.card-status-waiting {
  border-color: #409EFF;
  background: #ecf5ff;
  border-left: 4px solid #409EFF;
}

.kanban-card-item.card-status-completed {
  border-color: #67c23a;
  background: #f0f9ff;
  border-left: 4px solid #67c23a;
}

.card-item-header {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.card-item-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-bottom: 6px;
}

.card-item-title.running-title {
  color: #f56c6c;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}

.running-icon {
  color: #f56c6c;
  font-size: 16px;
}

.card-item-description {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-item-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #909399;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.card-item-stage {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}

.card-item-confirmation {
  margin-top: 12px;
}

.card-item-content {
  margin-top: 12px;
}

.content-preview {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.content-dialog-body {
  max-height: 70vh;
  overflow-y: auto;
}

.content-dialog-info {
  margin-bottom: 16px;
}

.content-dialog-content {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
  border-left: 3px solid #409EFF;
}

.content-dialog-content .content-text {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
}

.card-item-files {
  margin-top: 12px;
}

.card-item-files .files-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.card-item-files .file-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.card-item-zip {
  margin-top: 12px;
}

.card-item-zip .zip-alert-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.kanban-card-item .is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
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

  .kanban-board {
    flex-direction: column;
  }

  .kanban-column {
    min-width: 100%;
    max-width: 100%;
  }
}
</style>
