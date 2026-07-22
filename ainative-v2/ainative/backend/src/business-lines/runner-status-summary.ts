import type {
  RunnerConfigCacheMeta,
  RunnerConfigStatus,
} from '../git/workspace-native.types';

export interface RunnerStatusSummary {
  status: RunnerConfigStatus | 'unknown';
  statusLabel: string;
  source?: RunnerConfigCacheMeta['source'];
  error?: string;
  updatedAt?: string;
  generatedAt?: string;
  fingerprint?: string;
  verificationStatus?: RunnerConfigCacheMeta['verificationStatus'];
  verificationDurationMs?: number;
  verificationError?: string;
  verificationLogsPreview?: string;
  probeStatus?: RunnerConfigCacheMeta['probeStatus'];
  probeMode?: RunnerConfigCacheMeta['probeMode'];
  probeError?: string;
  probeDurationMs?: number;
  routeProbeResults?: RunnerConfigCacheMeta['routeProbeResults'];
  probeRepaired?: boolean;
  probeRepairSummary?: string;
  fullScanAttempted?: boolean;
  fullScanError?: string;
  fullScanReasoning?: string;
  fullScanEvidenceBytes?: number;
  warningCount: number;
  latestWarning?: string;
  verifiedReady: boolean;
}

export function buildRunnerStatusSummary(
  configJson: Record<string, unknown> | null | undefined,
): RunnerStatusSummary {
  const config = configJson ?? {};
  const status = normalizeRunnerStatus(config.runnerConfigStatus);
  const meta = normalizeMeta(config.runnerConfigCacheMeta);
  const warnings = Array.isArray(meta?.analysisWarnings)
    ? meta.analysisWarnings.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];

  return {
    status,
    statusLabel: statusLabel(status, meta?.verificationStatus),
    source: meta?.source,
    error:
      typeof config.runnerConfigError === 'string'
        ? config.runnerConfigError
        : undefined,
    updatedAt:
      typeof config.runnerConfigUpdatedAt === 'string'
        ? config.runnerConfigUpdatedAt
        : undefined,
    generatedAt:
      typeof config.runnerGeneratedAt === 'string'
        ? config.runnerGeneratedAt
        : meta?.generatedAt,
    fingerprint:
      typeof config.runnerFingerprint === 'string'
        ? config.runnerFingerprint
        : undefined,
    verificationStatus: meta?.verificationStatus,
    verificationDurationMs: meta?.verificationDurationMs,
    verificationError: meta?.verificationError,
    verificationLogsPreview: meta?.verificationLogsPreview,
    probeStatus: meta?.probeStatus,
    probeMode: meta?.probeMode,
    probeError: meta?.probeError,
    probeDurationMs: meta?.probeDurationMs,
    routeProbeResults: meta?.routeProbeResults,
    probeRepaired: meta?.probeRepaired,
    probeRepairSummary: meta?.probeRepairSummary,
    fullScanAttempted: meta?.fullScanAttempted,
    fullScanError: meta?.fullScanError,
    fullScanReasoning: meta?.fullScanReasoning,
    fullScanEvidenceBytes: meta?.fullScanEvidenceBytes,
    warningCount: warnings.length,
    latestWarning: warnings.at(-1),
    verifiedReady:
      status === 'ready' &&
      meta?.verificationStatus === 'passed' &&
      meta?.coverageStatus === 'valid',
  };
}

function normalizeRunnerStatus(value: unknown): RunnerStatusSummary['status'] {
  if (
    value === 'pending' ||
    value === 'ready' ||
    value === 'generated' ||
    value === 'verifying' ||
    value === 'needsManualReview' ||
    value === 'failed' ||
    value === 'partial'
  ) {
    return value;
  }
  return 'unknown';
}

function normalizeMeta(value: unknown): RunnerConfigCacheMeta | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as RunnerConfigCacheMeta;
}

function statusLabel(
  status: RunnerStatusSummary['status'],
  verificationStatus?: RunnerConfigCacheMeta['verificationStatus'],
): string {
  switch (status) {
    case 'ready':
      return verificationStatus === 'passed'
        ? 'verified ready'
        : 'ready, unverified - reset config required';
    case 'verifying':
      return 'verifying';
    case 'needsManualReview':
      return 'needs manual review';
    case 'generated':
      return 'generated';
    case 'pending':
      return 'pending';
    case 'partial':
      return 'partial';
    case 'failed':
      return 'failed';
    default:
      return 'unknown';
  }
}
