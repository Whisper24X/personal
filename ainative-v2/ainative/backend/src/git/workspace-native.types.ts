import { SubRepoConfig } from './sub-repo.types';
import type { RunnerOrchestrationConfig } from '../containers/runner-orchestration.types';

/**
 * workspace-native 模式类型定义
 *
 * 架构：master → 项目长期分支 {businessLine.slug}-{project.slug} → 每任务 feature/<task>
 * ainative-workspace 上项目分支从 master 迁出；任务从项目分支 checkout 临时分支并嵌入子仓代码。
 */

// ─── BusinessLine Runner Generation ─────────────────────────────────────────

export type RunnerConfigStatus =
  | 'pending'
  | 'ready'
  | 'generated'
  | 'verifying'
  | 'needsManualReview'
  | 'failed'
  | 'partial';

export interface RunnerConfigCacheMeta {
  source:
    | 'ai'
    | 'fallback'
    | 'ai-full-scan'
    | 'runner-generation'
    | 'runner-generation-project';
  generatedAt: string;
  subRepoFingerprint?: string;
  coverageStatus?: 'valid' | 'incomplete' | 'stale';
  discoveredRepoPrefixes?: string[];
  selectedRepoPrefixes?: string[];
  notAutoStartedRepoPrefixes?: string[];
  omittedRepoPrefixes?: string[];
  needsConfigRepoPrefixes?: string[];
  omissionReasonsByRepo?: Record<string, string[]>;
  autoStartLimited?: boolean;
  factsTruncated?: boolean;
  truncatedPrefixes?: string[];
  analysisWarnings?: string[];
  generatorToolId?: string;
  generatorConfigId?: string;
  inputFingerprint?: string;
  partial?: boolean;
  probeStatus?: 'passed' | 'failed' | 'skipped';
  probeMode?: 'off' | 'warn' | 'required';
  probeError?: string;
  probeDurationMs?: number;
  routeProbeResults?: {
    path: string;
    service?: string;
    port?: number;
    status: 'passed' | 'failed' | 'skipped';
    statusCode?: number;
    failureKind?: string;
    error?: string;
  }[];
  probeRepaired?: boolean;
  probeRepairSummary?: string;
  fullScanAttempted?: boolean;
  fullScanError?: string;
  fullScanReasoning?: string;
  fullScanEvidenceBytes?: number;
  verificationId?: string;
  verificationStatus?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  verificationStartedAt?: string;
  verificationFinishedAt?: string;
  verificationDurationMs?: number;
  verificationError?: string;
  verificationLogsPreview?: string;
  runnerFingerprint?: string;
}

// ─── BusinessLine 级别 ──────────────────────────────────────────────────────

export interface BusinessLineRunnerConfig {
  runnerFingerprint?: string;
  runnerConfigStatus: RunnerConfigStatus;
  runnerConfigError?: string;
  runnerConfigUpdatedAt?: string;
  runnerGeneratedAt?: string;
  runnerConfigCache?: RunnerOrchestrationConfig;
  runnerConfigCacheMeta?: RunnerConfigCacheMeta;
  runnerLastAttemptedFingerprint?: string;
  runnerLastAttemptedAt?: string;
  runnerGenerationAgentCliConfigId?: string;
}

export interface BusinessLineWorkspaceConfig extends BusinessLineRunnerConfig {
  subRepos: SubRepoConfig[];
}

// ─── Task 级别 ──────────────────────────────────────────────────────────────

export interface TaskWorkspaceSnapshot {
  snapshotCommitSha: string;
  subRepoHeads: Record<string, string>;
  taskBranch: string;
}

export type TaskWorkspaceStatus = 'provisioning' | 'ready' | 'failed';

export type TaskWorkspaceSnapshotStatus =
  | 'pending'
  | 'pushing'
  | 'pushed'
  | 'failed';

export type TaskWorkspaceStage =
  | 'initializing'
  | 'syncing_base'
  | 'creating_worktree'
  | 'fetching_sub_repos'
  | 'embedding_sub_repos'
  | 'writing_runner_config'
  | 'committing_snapshot'
  | 'ready'
  | 'pushing_snapshot'
  | 'failed';

export type TaskRunnerSource =
  | 'projectConfig'
  | 'businessLineCache'
  | 'generatedOnCreate'
  | 'unavailableStaleCache'
  | 'unavailableGenerationFailed';

export interface TaskRunnerSnapshot {
  fingerprint: string;
  status: 'ready' | 'unavailable' | 'failed';
  configSnapshot?: Record<string, unknown>;
  source: TaskRunnerSource;
  generatedAt?: string;
  error?: string;
}

export type SubRepoDeployPushStatus = 'success' | 'failed' | 'skipped';

export interface SubRepoDeployPushResult {
  prefix: string;
  status: SubRepoDeployPushStatus;
  error?: string;
  remoteBranch?: string;
}

export interface TaskDeployStatus {
  status: 'pending' | 'pushing' | 'done' | 'failed' | 'cancelled';
  deployCommitSha?: string;
  subRepoPushResults: SubRepoDeployPushResult[];
  updatedAt: string;
}

export interface SubRepoDeployBranch {
  prefix: string;
  url: string;
  remoteBranch: string;
  lastPushedCommitSha?: string;
  mrUrl?: string;
  createdAt: string;
}

export type TaskDeleteStatusValue = 'pending' | 'deleting' | 'done' | 'failed';

export interface TaskDeleteStatus {
  status: TaskDeleteStatusValue;
  openMrs?: { prefix: string; url: string; mrUrl: string }[];
  warnings?: string[];
}

export interface TaskWorkspaceNativeConfig {
  subReposSnapshot: SubRepoConfig[];
  workspaceSnapshot: TaskWorkspaceSnapshot;
  workspaceStatus?: TaskWorkspaceStatus;
  workspaceStage?: TaskWorkspaceStage;
  workspaceMessage?: string;
  workspaceError?: string;
  workspaceSnapshotStatus?: TaskWorkspaceSnapshotStatus;
  workspaceSnapshotError?: string;
  workspaceSnapshotPushedAt?: string;
  runner: TaskRunnerSnapshot;
  deployStatus?: TaskDeployStatus;
  subRepoDeployBranches?: SubRepoDeployBranch[];
  deleteStatus?: TaskDeleteStatus;
}

// ─── 模式判断 ────────────────────────────────────────────────────────────────

export function isWorkspaceNativeMode(project: {
  configJson?: Record<string, unknown> | null;
}): boolean {
  const config = project.configJson;
  if (!config || typeof config !== 'object') return false;
  return (
    config.subtreeMode === 'workspace-native' &&
    config.workspaceNativeDisabled !== true
  );
}

export function isWorkspaceManaged(project: {
  configJson?: Record<string, unknown> | null;
}): boolean {
  const config = project.configJson;
  if (!config || typeof config !== 'object') return false;
  return config.workspaceManaged === true;
}
