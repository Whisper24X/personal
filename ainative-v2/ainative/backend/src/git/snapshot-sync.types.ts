/**
 * Snapshot-Sync 模型类型定义
 *
 * 正式名称："snapshot-sync" 模式（任务前 snapshot sync，部署后 untrack cleanup）
 * 不是标准 git subtree。文档和代码统一使用 snapshot-sync。
 *
 * 过渡实现：runtimeGitState 存储在 project.configJson 中，字段增长后迁独立表。
 */

// ─── Git Phase 状态机 ───────────────────────────────────────────────────────

/**
 * 项目 Git 操作阶段
 *
 * 正常流转：idle → snapshot_synced → task_active → deploy_pending → cleanup_pending → idle
 * 迁移流转：(any) → migrating → idle
 * 异常流转：deploy_pending/cleanup_pending → stale（超时标记）→ idle（管理员 force_idle）
 */
export type ProjectGitPhase =
  | 'idle'
  | 'snapshot_synced'
  | 'task_active'
  | 'deploy_pending'
  | 'cleanup_pending'
  | 'migrating'
  | 'stale';

/**
 * 合法的 phase 流转映射
 */
export const VALID_PHASE_TRANSITIONS: Record<
  ProjectGitPhase,
  ProjectGitPhase[]
> = {
  idle: ['snapshot_synced', 'migrating'],
  snapshot_synced: ['task_active', 'idle'],
  task_active: ['deploy_pending', 'idle'],
  deploy_pending: ['cleanup_pending', 'stale', 'idle'],
  cleanup_pending: ['idle', 'stale'],
  migrating: ['idle'],
  stale: ['idle', 'migrating'],
};

// ─── Deploy Status ──────────────────────────────────────────────────────────

export type SubtreeDeployItemStatus =
  | 'pending'
  | 'pushing'
  | 'success'
  | 'failed'
  | 'skipped';

export interface SubtreeDeployItem {
  prefix: string;
  targetBranch: string;
  sourceCommitSha: string;
  status: SubtreeDeployItemStatus;
  attempts: number;
  error?: string;
  skippedReason?: 'no_changes';
  pushedAt?: string;
}

export interface DeployStatus {
  snapshotEpoch: string;
  deployCommitSha?: string;
  cleanupCommitSha?: string;
  updatedAt: string;
  subtrees: SubtreeDeployItem[];
  mainRepoPushed: boolean;
}

// ─── Runtime Git State ──────────────────────────────────────────────────────

export interface ProjectRuntimeGitState {
  gitPhase: ProjectGitPhase;
  snapshotEpoch?: string;
  activeTaskId?: string;
  lastOperationAt?: string;
  lastError?: string;
  deployStatus?: DeployStatus;
}

// ─── 审计日志 ────────────────────────────────────────────────────────────────

export type SubtreeOperationType =
  | 'sync_snapshot'
  | 'snapshot_push'
  | 'untrack_cleanup'
  | 'phase_recovery'
  | 'force_push'
  | 'migration';

export interface SubtreeOperationLog {
  projectId: string;
  taskId?: string;
  snapshotEpoch?: string;
  deployCommitSha?: string;
  cleanupCommitSha?: string;
  prefix?: string;
  targetBranch?: string;
  operationType: SubtreeOperationType;
  phaseBefore: ProjectGitPhase;
  phaseAfter: ProjectGitPhase;
  operatorId?: string;
  success: boolean;
  error?: string;
  durationMs?: number;
  timestamp: string;
}

// ─── 故障恢复 ────────────────────────────────────────────────────────────────

export type GitPhaseRecoveryAction =
  | 'retry_deploy'
  | 'retry_cleanup'
  | 'skip_to_cleanup'
  | 'force_idle'
  | 'diagnose';

export interface GitPhaseRecoveryRequest {
  action: GitPhaseRecoveryAction;
  operatorId: string;
  /** force-with-lease 时需要提供期望的远端 SHA */
  expectedRemoteSha?: string;
}

// ─── Sync 结果 ───────────────────────────────────────────────────────────────

export interface SubtreeSyncResult {
  prefix: string;
  synced: boolean;
  skippedReason?: 'no_changes';
  error?: string;
  durationMs?: number;
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 判断项目是否启用旧的 snapshot-sync 模式（仅限 subtreeMode === 'snapshot'）。
 * workspace-native 有独立的 Git 工作流，不走 snapshot-sync 路径。
 */
export function isSnapshotSyncEnabled(project: {
  configJson?: Record<string, unknown> | null;
}): boolean {
  const config = project.configJson;
  if (!config || typeof config !== 'object') return false;
  return config.subtreeMode === 'snapshot';
}

/**
 * 判断项目是否为 workspace-native 模式（ainative-workspace 管理）。
 * workspace-native 有完全独立的 Git 工作流（createTaskWorktree/deployToSubRepo），
 * 不走旧 snapshot-sync 的 phase 状态机和 subtree 部署链路。
 */
export function isWorkspaceNativeEnabled(project: {
  configJson?: Record<string, unknown> | null;
}): boolean {
  const config = project.configJson;
  if (!config || typeof config !== 'object') return false;
  return (
    config.subtreeMode === 'workspace-native' &&
    config.workspaceNativeDisabled !== true
  );
}

/**
 * 判断项目是否有子仓配置（任何模式：snapshot 或 workspace-native）。
 * 用于需要跳过旧 legacy sub-repo worktree 逻辑的场景。
 */
export function hasSubRepoMode(project: {
  configJson?: Record<string, unknown> | null;
}): boolean {
  const config = project.configJson;
  if (!config || typeof config !== 'object') return false;
  return (
    config.subtreeMode === 'snapshot' ||
    config.subtreeMode === 'workspace-native'
  );
}
