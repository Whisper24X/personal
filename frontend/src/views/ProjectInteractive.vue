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

    <!-- Workflow Kanban Board -->
    <el-card class="kanban-card">
      <template #header>
        <div class="card-header-content">
          <span class="card-title">
            <el-icon>
              <Operation />
            </el-icon>
            工作流看板
          </span>
          <el-tag :type="getStatusType()" effect="dark">
            {{ getStatusText() }}
          </el-tag>
        </div>
      </template>

      <div class="kanban-board" ref="kanbanBoardRef">
        <div v-for="roleColumn in workflowKanban" :key="roleColumn.role" class="kanban-column" :class="{
          'column-active': roleColumn.isActive,
          'column-running': isRunning && runningRole === roleColumn.role
        }" :ref="el => setColumnRef(el, roleColumn.role)">
          <div class="column-header">
            <div class="column-header-left">
              <el-tag :type="getRoleTagType(roleColumn.role)" size="large"
                :effect="isRunning && runningRole === roleColumn.role ? 'dark' : 'plain'"
                :class="{ 'role-tag-running': isRunning && runningRole === roleColumn.role }">
                <el-icon v-if="isRunning && runningRole === roleColumn.role" class="is-loading"
                  style="margin-right: 4px;">
                  <Loading />
                </el-icon>
                {{ getRoleDisplayName(roleColumn.role) }}
              </el-tag>
              <el-badge v-if="isRunning && runningRole === roleColumn.role && currentAction" :value="'运行中'"
                class="running-badge" type="danger" />
            </div>
            <div class="column-header-right">
              <span class="column-count">{{ roleColumn.completedCount }} / {{ roleColumn.totalCount }}</span>
              <el-button v-if="roleColumn.completedCount === roleColumn.totalCount && roleColumn.totalCount > 0"
                type="warning" size="small" :icon="Refresh" @click.stop="handleResetRole(roleColumn.role)"
                :loading="resettingRoles.has(roleColumn.role)" plain class="reset-button"
                :title="`重置 ${getRoleDisplayName(roleColumn.role)} 及下游所有角色的工作流`">
                重置
              </el-button>
            </div>
          </div>
          <div class="column-description">
            {{ getRoleDescription(roleColumn.role) }}
          </div>
          <div class="column-cards">
            <!-- Running indicator for this role (only show if action is not in the list) -->
            <div
              v-if="roleColumn.runningAction && !roleColumn.currentStep && isRunning && !roleColumn.actions.some(a => a.name === roleColumn.runningAction && a.status === 'running')"
              class="kanban-card-item card-status-running" style="order: -2;">
              <div class="card-item-header">
                <el-tag type="danger" size="small" effect="dark">
                  <el-icon class="is-loading" style="margin-right: 4px;">
                    <Loading />
                  </el-icon>
                  正在运行
                </el-tag>
              </div>
              <div class="card-item-title running-title">
                <el-icon class="is-loading running-icon">
                  <Loading />
                </el-icon>
                {{ getActionDisplayName(roleColumn.runningAction) }}
              </div>
              <div class="card-item-description">{{ getActionDescription(roleColumn.runningAction) }}</div>
              <div v-if="currentStageName && runningRole === roleColumn.role" class="card-item-stage">
                <el-icon>
                  <Timer />
                </el-icon>
                <el-tag size="small" :type="getStageTagType()">{{ currentStageName }}</el-tag>
              </div>
            </div>

            <!-- Current step waiting for confirmation -->
            <div v-if="roleColumn.currentStep" class="kanban-card-item card-status-waiting"
              @click="showConfirmationDialog = true">
              <div class="card-item-header">
                <el-tag type="warning" size="small" effect="plain">
                  等待确认
                </el-tag>
              </div>
              <div class="card-item-title">{{ getActionDisplayName(roleColumn.currentStep.action) }}</div>
              <div class="card-item-description">{{ getActionDescription(roleColumn.currentStep.action) }}</div>
              <div class="card-item-footer">
                <el-button type="primary" size="small" @click.stop="showConfirmationDialog = true">
                  点击确认
                </el-button>
              </div>
            </div>

            <!-- Action cards (exclude waiting actions, but show running actions) -->
            <div v-for="action in roleColumn.actions" :key="action.name" v-show="action.status !== 'waiting'"
              class="kanban-card-item" :class="[
                getActionCardClass(action.status),
                { 'action-running': action.status === 'running' && isRunning && runningRole === roleColumn.role }
              ]" :ref="el => setActionRef(el, roleColumn.role, action.name)"
              :style="action.status === 'running' ? { order: -1, zIndex: 10 } : {}">
              <div class="card-item-header">
                <el-tag :type="getActionStatusTagType(action.status)" size="small"
                  :effect="action.status === 'running' ? 'dark' : 'plain'">
                  <el-icon v-if="action.status === 'running'" class="is-loading" style="margin-right: 4px;">
                    <Loading />
                  </el-icon>
                  {{ getActionStatusText(action.status) }}
                </el-tag>
                <el-tag v-if="action.userAction" size="small" :type="getUserActionTagType(action.userAction)">
                  {{ getUserActionText(action.userAction) }}
                </el-tag>
              </div>
              <div class="card-item-title" :class="{ 'running-title': action.status === 'running' }">
                <el-icon v-if="action.status === 'running'" class="is-loading running-icon">
                  <Loading />
                </el-icon>
                {{ getActionDisplayName(action.name) }}
              </div>
              <div class="card-item-description">{{ getActionDescription(action.name) }}</div>

              <!-- Content preview for completed actions -->
              <div v-if="action.status === 'completed' && action.content" class="card-item-content">
                <el-button type="primary" size="small" @click="openContentDialog(action)">
                  <el-icon>
                    <Document />
                  </el-icon>
                  查看内容
                </el-button>
              </div>

              <!-- Output files -->
              <div v-if="action.outputFiles && action.outputFiles.length > 0" class="card-item-files">
                <el-divider content-position="left">
                  <el-icon>
                    <FolderOpened />
                  </el-icon>
                  生成的文件 ({{ action.outputFiles.length }})
                </el-divider>
                <div class="files-list">
                  <el-tag v-for="file in action.outputFiles" :key="file.path || file" class="file-tag" type="info"
                    effect="plain" size="small">
                    <el-icon>
                      <DocumentCopy />
                    </el-icon>
                    {{ typeof file === 'string' ? file : file.path }}
                  </el-tag>
                </div>
              </div>

              <!-- Zip archive -->
              <div v-if="action.zipPath" class="card-item-zip">
                <el-divider content-position="left">
                  <el-icon>
                    <Download />
                  </el-icon>
                  压缩包
                </el-divider>
                <el-alert type="success" :closable="false" show-icon>
                  <template #title>
                    <div class="zip-alert-content">
                      <span>{{ action.zipType === 'workspace_zip' ? 'Workspace压缩包' : '代码压缩包' }}</span>
                      <el-button type="primary" size="small" :icon="Download" @click="downloadZip(action.zipPath!)">
                        下载
                      </el-button>
                    </div>
                  </template>
                </el-alert>
              </div>

              <div v-if="action.timestamp" class="card-item-footer">
                <el-icon>
                  <Timer />
                </el-icon>
                <span>{{ action.timestamp }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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
    <el-dialog v-model="showContentDialog" :title="contentDialogTitle" width="80%" destroy-on-close>
      <div class="content-dialog-body">
        <div class="content-dialog-info">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="角色">
              {{ contentDialogRole ? getRoleDisplayName(contentDialogRole) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="操作">
              {{ contentDialogAction ? getActionDisplayName(contentDialogAction) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag type="success" size="small">已完成</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="时间" v-if="contentDialogTimestamp">
              {{ contentDialogTimestamp }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
        <el-divider />
        <div class="content-dialog-content">
          <div class="content-text">{{ contentDialogContent }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showContentDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
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
  Operation,
} from '@element-plus/icons-vue';
import InteractiveConfirmation from '../components/InteractiveConfirmation.vue';
import apiClient from '../api/client';
import { createPolling, type PollingResult } from '../utils/polling';
import { useRoleActionStore } from '../stores/roleAction';

const route = useRoute();
const router = useRouter();
const roleActionStore = useRoleActionStore();

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
const showConfirmationDialog = ref(false);

// Reset state
const resettingRoles = ref<Set<string>>(new Set());

// Content Dialog
const showContentDialog = ref(false);
const contentDialogTitle = ref('');
const contentDialogRole = ref('');
const contentDialogAction = ref('');
const contentDialogContent = ref('');
const contentDialogTimestamp = ref('');

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

// Workflow Kanban Data Structure
interface WorkflowAction {
  name: string;
  status: 'pending' | 'running' | 'waiting' | 'completed';
  userAction?: string;
  timestamp?: string;
  content?: string;
  outputFiles?: any[];
  zipPath?: string;
  zipType?: string;
  stepData?: any; // Full step data for detailed view
}

interface WorkflowRoleColumn {
  role: string;
  actions: WorkflowAction[];
  isActive: boolean;
  completedCount: number;
  totalCount: number;
  currentStep?: any; // Current step waiting for confirmation
  runningAction?: string; // Currently running action
}

// Workflow structure: role -> actions mapping (loaded from API)
const workflowStructure = ref<Record<string, string[]>>({});
const workflowLoading = ref(false);

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

  // Process each role
  Object.entries(workflowStructure.value).forEach(([role, actions]) => {
    const roleActions: WorkflowAction[] = actions.map(actionName => {
      const key = `${role}-${actionName}`;
      const completedStep = completedMap.get(key);

      let status: 'pending' | 'running' | 'waiting' | 'completed' = 'pending';
      let userAction: string | undefined;
      let timestamp: string | undefined;
      let content: string | undefined;
      let outputFiles: any[] | undefined;
      let zipPath: string | undefined;
      let zipType: string | undefined;
      let stepData: any | undefined;

      if (completedStep) {
        status = 'completed';
        userAction = completedStep.userAction;
        timestamp = completedStep.timestamp;
        content = completedStep.content;
        outputFiles = completedStep.outputFiles;
        zipPath = completedStep.zipPath;
        zipType = completedStep.zipType;
        stepData = completedStep;
      } else if (currentStep.value && currentStep.value.role === role && currentStep.value.action === actionName) {
        status = 'waiting';
        content = currentStep.value.content;
        outputFiles = currentStep.value.outputFiles;
        stepData = currentStep.value;
      } else if (isRunning.value && runningRole.value === role && currentAction.value === actionName) {
        // Check if this action is currently running
        status = 'running';
        // Debug log for Salesperson
        if (role === 'Salesperson') {
          console.log('[Salesperson running check]', {
            role,
            actionName,
            runningRole: runningRole.value,
            currentAction: currentAction.value,
            isRunning: isRunning.value,
            status: 'running'
          });
        }
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

// Refs for auto-scrolling
const kanbanBoardRef = ref<HTMLElement | null>(null);
const columnRefs = new Map<string, HTMLElement>();
const actionRefs = new Map<string, HTMLElement>();

// Helper functions for refs
function setColumnRef(el: any, role: string) {
  if (el) {
    columnRefs.set(role, el);
  } else {
    columnRefs.delete(role);
  }
}

function setActionRef(el: any, role: string, action: string) {
  if (el) {
    const key = `${role}-${action}`;
    actionRefs.set(key, el);
  } else {
    const key = `${role}-${action}`;
    actionRefs.delete(key);
  }
}

// Load workflow information from API
async function loadWorkflowInfo() {
  if (!sessionId.value) {
    return;
  }

  try {
    workflowLoading.value = true;
    const response = await apiClient.getInteractiveWorkflow(sessionId.value) as any;

    if (response && response.roles) {
      // Convert API response to workflow structure format
      const structure: Record<string, string[]> = {};
      response.roles.forEach((roleInfo: any) => {
        structure[roleInfo.role] = roleInfo.actions.map((action: any) => action.name);
      });
      workflowStructure.value = structure;

      // Restore completed steps from workflow items
      if (response.items && Array.isArray(response.items)) {
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

// Load current running role and action from API
async function loadRunningInfo() {
  if (!sessionId.value) {
    return;
  }

  try {
    const response = await apiClient.getInteractiveRunning(sessionId.value) as any;

    if (response && (response.role || response.action)) {
      // Update running state from API
      if (response.role) {
        runningRole.value = response.role;
      }
      if (response.action) {
        currentAction.value = response.action;
      }
      if (response.role && response.action) {
        currentStageName.value = getStageName(response.role, response.action);
        isRunning.value = true;
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

// Watch currentStep to show dialog automatically
watch(currentStep, (newStep) => {
  if (newStep) {
    showConfirmationDialog.value = true;
  } else {
    showConfirmationDialog.value = false;
  }
}, { immediate: true });

// Watch runningRole and currentAction to auto-scroll to current position
watch([runningRole, currentAction, isRunning], ([newRole, newAction, running]) => {
  if (running && newRole && newAction) {
    nextTick(() => {
      scrollToCurrentPosition(newRole, newAction);
    });
  }
}, { immediate: false });

// Auto-scroll function
function scrollToCurrentPosition(role: string, action: string) {
  // First try to scroll to the action
  const actionKey = `${role}-${action}`;
  const actionEl = actionRefs.get(actionKey);
  if (actionEl) {
    actionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    return;
  }

  // Fallback to scroll to the column
  const columnEl = columnRefs.get(role);
  if (columnEl && kanbanBoardRef.value) {
    columnEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

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

    // Load workflow information
    await loadWorkflowInfo();

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
          // Also load running info periodically
          await loadRunningInfo();
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
        shouldContinue: () => !isCompleted.value,
        onError: (error: Error) => {
          const errorMessage = error?.message || '未知错误';
          ElMessage.error('轮询错误: ' + errorMessage);
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
      // Auto-scroll to current position
      if (runningRole.value && currentAction.value) {
        nextTick(() => {
          scrollToCurrentPosition(runningRole.value, currentAction.value);
        });
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
        // Set default action for Salesperson (usually WriteMRD)
        currentAction.value = 'WriteMRD';
      }
      // Auto-scroll to current position
      nextTick(() => {
        scrollToCurrentPosition(runningRole.value, currentAction.value);
      });
      break;

    case 'role_start':
      isRunning.value = true;
      runningRole.value = message.data.role || '';
      currentAction.value = message.data.action || '';
      currentStageName.value = getStageName(message.data.role, message.data.action);
      // Clear currentStep when a new role starts
      currentStep.value = null;
      // Auto-scroll to current position
      nextTick(() => {
        scrollToCurrentPosition(runningRole.value, currentAction.value);
      });
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

/**
 * 获取Action卡片样式类
 */
function getActionCardClass(status: string): string {
  return `card-status-${status}`;
}

/**
 * 获取Action状态标签类型
 */
function getActionStatusTagType(status: string): 'success' | 'warning' | 'info' | 'danger' {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'info',
    running: 'danger', // 使用danger类型（红色）来突出显示运行中的action
    waiting: 'warning',
    completed: 'success',
  };
  return typeMap[status] || 'info';
}

/**
 * 获取Action状态文本
 */
function getActionStatusText(status: string): string {
  const textMap: Record<string, string> = {
    pending: '待处理',
    running: '进行中',
    waiting: '等待确认',
    completed: '已完成',
  };
  return textMap[status] || status;
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
  contentDialogTitle.value = `${getRoleDisplayName(roleForAction)} - ${getActionDisplayName(action.name)}`;
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
}

/**
 * Handle reset workflow from a specific role
 * This will reset the role and all downstream roles to pending status
 */
async function handleResetRole(role: string) {
  if (!sessionId.value) {
    ElMessage.error('会话ID不存在');
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
    await apiClient.resetInteractiveWorkflow(sessionId.value, role);

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
