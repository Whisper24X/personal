/**
 * Workflow Execution Types
 * Unified types for the simplified state management system
 */

import { WorkflowConfig } from '../database/repositories/ApplicationWorkflowRepository';

// ==================== State Enums ====================

/**
 * Workflow overall state (state machine states)
 */
export enum WorkflowState {
  INITIALIZED = 'initialized',           // 初始化完成，等待开始
  RUNNING = 'running',                   // 执行中
  WAITING_CONFIRMATION = 'waiting_confirmation', // 等待用户确认
  PAUSED = 'paused',                     // 暂停（手动暂停）
  COMPLETED = 'completed',               // 全部完成
  FAILED = 'failed',                     // 失败（超过重试次数）
}

/**
 * Individual step state
 */
export enum StepState {
  PENDING = 'pending',       // 待执行
  RUNNING = 'running',       // 执行中
  COMPLETED = 'completed',   // 完成
  FAILED = 'failed',         // 失败
  SKIPPED = 'skipped',       // 跳过
}

// ==================== Data Structures ====================

/**
 * Current execution position
 */
export interface CurrentPosition {
  roleIndex: number;    // 角色索引（基于工作流配置中的顺序）
  actionIndex: number;  // Action索引（基于角色actions数组中的顺序）
}

/**
 * Individual step status
 */
export interface StepStatus {
  role: string;              // 角色名称
  action: string;            // Action名称
  roleIndex: number;         // 角色索引
  actionIndex: number;       // Action索引
  state: StepState;          // 步骤状态
  retryCount: number;        // 重试次数
  startedAt?: string;        // 开始时间 (ISO string)
  completedAt?: string;      // 完成时间 (ISO string)
  error?: string;            // 错误信息
}

/**
 * Pending confirmation information
 */
export interface PendingConfirmation {
  role: string;              // 触发确认的角色
  action: string;            // 触发确认的Action
  content: string;           // 确认内容（通常是Action输出）
  outputFiles: string[];     // 输出文件列表
  instructContent?: any;     // 结构化输出内容
  createdAt: string;         // 创建时间 (ISO string)
}

/**
 * Error information
 */
export interface WorkflowError {
  message: string;           // 错误消息
  stack?: string;            // 错误堆栈
  timestamp: string;         // 发生时间 (ISO string)
}

/**
 * Workflow execution record (database model)
 */
export interface WorkflowExecution {
  id: string;
  projectId: string;
  versionId: string;  // 关联的项目版本ID
  workflowSnapshot: WorkflowConfig;
  state: WorkflowState;
  currentPosition: CurrentPosition | null;
  steps: StepStatus[];
  pendingConfirmation: PendingConfirmation | null;
  lastError: WorkflowError | null;
  executionContext: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database row type (snake_case)
 */
export interface WorkflowExecutionRow {
  id: string;
  project_id: string;
  version_id: string;  // 关联的项目版本ID
  workflow_snapshot: WorkflowConfig;
  state: string;
  current_position: CurrentPosition | null;
  steps: StepStatus[];
  pending_confirmation: PendingConfirmation | null;
  last_error: WorkflowError | null;
  execution_context: Record<string, any>;
  version: number;
  created_at: Date;
  updated_at: Date;
}

// ==================== Service Types ====================

/**
 * Current state response (for API)
 */
export interface WorkflowCurrentState {
  state: WorkflowState;
  currentRole: string | null;
  currentAction: string | null;
  steps: StepStatus[];
  pendingConfirmation: PendingConfirmation | null;
  lastError: WorkflowError | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

/**
 * Step completion output
 */
export interface StepOutput {
  content: string;
  outputFiles: string[];
  instructContent?: any;
}

/**
 * Step completion result
 */
export interface StepCompleteResult {
  needsConfirmation: boolean;
  isCompleted: boolean;
}

/**
 * Step failure result
 */
export interface StepFailResult {
  shouldRetry: boolean;
  retryCount: number;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  status: 'not_found' | 'ready' | 'running' | 'waiting' | 'paused' | 'failed' | 'completed' | 'recovered' | 'unknown';
  message: string;
  action?: 'start' | 'continue' | 'wait_confirmation' | 'wait_resume' | 'wait_retry_or_reset' | 'none';
  pendingConfirmation?: PendingConfirmation | null;
  error?: WorkflowError | null;
}

// ==================== Create/Initialize Types ====================

/**
 * Options for creating a new workflow execution
 */
export interface CreateWorkflowExecutionOptions {
  projectId: string;
  versionId: string;  // 必需：关联的项目版本ID
  workflowConfig: WorkflowConfig;
}

/**
 * Convert WorkflowConfig to initial steps array
 */
export function workflowConfigToSteps(config: WorkflowConfig): StepStatus[] {
  const steps: StepStatus[] = [];
  
  // Sort roles by order
  const sortedRoles = [...config.roles].sort((a, b) => a.order - b.order);
  
  for (let roleIndex = 0; roleIndex < sortedRoles.length; roleIndex++) {
    const role = sortedRoles[roleIndex];
    for (let actionIndex = 0; actionIndex < role.actions.length; actionIndex++) {
      steps.push({
        role: role.profile,
        action: role.actions[actionIndex],
        roleIndex,
        actionIndex,
        state: StepState.PENDING,
        retryCount: 0,
      });
    }
  }
  
  return steps;
}

/**
 * Convert database row to WorkflowExecution
 */
export function rowToWorkflowExecution(row: WorkflowExecutionRow): WorkflowExecution {
  return {
    id: row.id,
    projectId: row.project_id,
    versionId: row.version_id,
    workflowSnapshot: row.workflow_snapshot,
    state: row.state as WorkflowState,
    currentPosition: row.current_position,
    steps: row.steps || [],
    pendingConfirmation: row.pending_confirmation,
    lastError: row.last_error,
    executionContext: row.execution_context || {},
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Convert WorkflowExecution to database row params
 */
export function workflowExecutionToRowParams(exec: WorkflowExecution): any[] {
  return [
    exec.id,
    exec.projectId,
    exec.versionId,
    JSON.stringify(exec.workflowSnapshot),
    exec.state,
    exec.currentPosition ? JSON.stringify(exec.currentPosition) : null,
    JSON.stringify(exec.steps),
    exec.pendingConfirmation ? JSON.stringify(exec.pendingConfirmation) : null,
    exec.lastError ? JSON.stringify(exec.lastError) : null,
    JSON.stringify(exec.executionContext),
    exec.version,
  ];
}
