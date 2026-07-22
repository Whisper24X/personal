import {
  computeSubRepoFingerprint,
  type SubRepoConfig,
} from '../git/sub-repo.types';

export const RUNNER_SNAPSHOT_GENERATOR_VERSION = 'runner-snapshot-freshness-v1';
export const RUNNER_SNAPSHOT_AUTO_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

export type RunnerSnapshotFreshnessReason =
  | 'missing-orchestration'
  | 'missing-services'
  | 'missing-generated-meta'
  | 'manual-lock-bypass'
  | 'missing-subrepo-fingerprint'
  | 'subrepo-fingerprint-mismatch'
  | 'verification-not-passed'
  | 'coverage-not-valid'
  | 'missing-preview-route'
  | 'preview-route-collapses-to-root'
  | 'missing-homepage-link'
  | 'homepage-link-points-to-root'
  | 'homepage-link-missing-route'
  | 'multi-service-root-collision';

export type RunnerSnapshotFreshnessState = 'usable' | 'stale';

export interface RunnerSnapshotFreshnessResult {
  state: RunnerSnapshotFreshnessState;
  reasons: RunnerSnapshotFreshnessReason[];
  currentSubRepoFingerprint: string;
  previewServiceNames: string[];
  coveredPreviewServiceNames: string[];
  linkedPreviewServiceNames: string[];
  manuallyLocked: boolean;
}

export interface RunnerSnapshotRefreshState {
  fingerprint?: string;
  generatorVersion?: string;
  attemptedAt?: string;
  forceRequestedAt?: string;
  lastOutcome?: 'written' | 'failed' | 'skipped';
  lastError?: string | null;
}

type RouteShape = {
  path?: unknown;
  action?: unknown;
  service?: unknown;
};

type LinkShape = {
  path?: unknown;
  label?: unknown;
};

export function assessRunnerSnapshotFreshness(params: {
  runnerOrchestration: Record<string, unknown> | null | undefined;
  subRepos: SubRepoConfig[];
}): RunnerSnapshotFreshnessResult {
  const currentSubRepoFingerprint = computeSubRepoFingerprint(params.subRepos);
  const reasons: RunnerSnapshotFreshnessReason[] = [];
  const rawOrchestration = params.runnerOrchestration;

  if (!rawOrchestration || typeof rawOrchestration !== 'object') {
    return {
      state: 'stale',
      reasons: ['missing-orchestration'],
      currentSubRepoFingerprint,
      previewServiceNames: [],
      coveredPreviewServiceNames: [],
      linkedPreviewServiceNames: [],
      manuallyLocked: false,
    };
  }

  const orchestration = rawOrchestration as Record<string, unknown>;
  const manuallyLocked = orchestration.manuallyLocked === true;
  const services = Array.isArray(orchestration.services)
    ? orchestration.services.filter(
        (service): service is Record<string, unknown> =>
          Boolean(service) &&
          typeof service === 'object' &&
          !Array.isArray(service),
      )
    : [];

  if (services.length === 0) {
    reasons.push('missing-services');
  }

  if (manuallyLocked) {
    return {
      state: reasons.length > 0 ? 'stale' : 'usable',
      reasons: reasons.length > 0 ? reasons : ['manual-lock-bypass'],
      currentSubRepoFingerprint,
      previewServiceNames: readPreviewServiceNames(services),
      coveredPreviewServiceNames: [],
      linkedPreviewServiceNames: [],
      manuallyLocked,
    };
  }

  const generatedMeta = toObjectRecord(orchestration.generatedMeta);
  if (!generatedMeta) {
    reasons.push('missing-generated-meta');
  }
  const generatedFingerprint =
    typeof generatedMeta?.subRepoFingerprint === 'string'
      ? generatedMeta.subRepoFingerprint.trim()
      : '';
  if (!generatedFingerprint) {
    reasons.push('missing-subrepo-fingerprint');
  } else if (generatedFingerprint !== currentSubRepoFingerprint) {
    reasons.push('subrepo-fingerprint-mismatch');
  }
  if (generatedMeta?.coverageStatus !== 'valid') {
    reasons.push('coverage-not-valid');
  }
  if (generatedMeta?.verificationStatus !== 'passed') {
    reasons.push('verification-not-passed');
  }

  const previewServices = readPreviewServiceNames(services);
  const homepage = toObjectRecord(orchestration.homepage);
  const homepageExists = Boolean(homepage);
  const routes = Array.isArray(orchestration.routes)
    ? orchestration.routes.filter(
        (route): route is RouteShape =>
          Boolean(route) && typeof route === 'object' && !Array.isArray(route),
      )
    : [];
  const proxyRoutes = routes.filter(
    (route) => (route.action ?? 'proxy') === 'proxy',
  );

  const coveredPreviewServiceNames = new Set<string>();
  const routePathByPreviewService = new Map<string, string>();

  for (const route of proxyRoutes) {
    const routeService =
      typeof route.service === 'string' ? route.service.trim() : '';
    const routePath = typeof route.path === 'string' ? route.path.trim() : '';
    if (
      !routeService ||
      !routePath ||
      !previewServices.includes(routeService)
    ) {
      continue;
    }

    if (homepageExists && routePath === '/') {
      reasons.push('preview-route-collapses-to-root');
      continue;
    }

    coveredPreviewServiceNames.add(routeService);
    routePathByPreviewService.set(routeService, routePath);
  }

  for (const serviceName of previewServices) {
    if (!coveredPreviewServiceNames.has(serviceName)) {
      reasons.push('missing-preview-route');
    }
  }

  const homepageLinks = Array.isArray(homepage?.links)
    ? homepage.links.filter(
        (link): link is LinkShape =>
          Boolean(link) && typeof link === 'object' && !Array.isArray(link),
      )
    : [];
  const linkedPreviewServiceNames = new Set<string>();

  if (homepageExists) {
    for (const serviceName of previewServices) {
      const expectedPath = routePathByPreviewService.get(serviceName);
      if (!expectedPath) {
        continue;
      }

      const matchingLink = homepageLinks.find((link) => {
        const linkPath = typeof link.path === 'string' ? link.path.trim() : '';
        return linkPath === expectedPath;
      });

      if (!matchingLink) {
        reasons.push('missing-homepage-link');
        continue;
      }

      const linkPath =
        typeof matchingLink.path === 'string' ? matchingLink.path.trim() : '';
      if (linkPath === '/') {
        reasons.push('homepage-link-points-to-root');
        continue;
      }

      linkedPreviewServiceNames.add(serviceName);
    }

    for (const link of homepageLinks) {
      const linkPath = typeof link.path === 'string' ? link.path.trim() : '';
      if (!linkPath) {
        continue;
      }
      if (linkPath === '/' && previewServices.length > 1) {
        reasons.push('multi-service-root-collision');
      }
      if (
        linkPath !== '/' &&
        !Array.from(routePathByPreviewService.values()).includes(linkPath)
      ) {
        reasons.push('homepage-link-missing-route');
      }
    }
  }

  return {
    state: reasons.length === 0 ? 'usable' : 'stale',
    reasons: [...new Set(reasons)],
    currentSubRepoFingerprint,
    previewServiceNames: previewServices,
    coveredPreviewServiceNames: Array.from(coveredPreviewServiceNames),
    linkedPreviewServiceNames: Array.from(linkedPreviewServiceNames),
    manuallyLocked,
  };
}

export function shouldAllowAutomaticRunnerSnapshotRetry(params: {
  freshness: RunnerSnapshotFreshnessResult;
  refreshState: RunnerSnapshotRefreshState | null | undefined;
  force?: boolean;
  generatorVersion?: string;
  now?: Date;
}): boolean {
  if (params.force) {
    return true;
  }

  if (params.freshness.manuallyLocked) {
    return false;
  }

  const refreshState = params.refreshState ?? {};
  const generatorVersion =
    params.generatorVersion ?? RUNNER_SNAPSHOT_GENERATOR_VERSION;
  const now = params.now ?? new Date();

  if (!refreshState.fingerprint || !refreshState.attemptedAt) {
    return true;
  }

  if (refreshState.fingerprint !== params.freshness.currentSubRepoFingerprint) {
    return true;
  }

  if (refreshState.generatorVersion !== generatorVersion) {
    return true;
  }

  const attemptedAt = Date.parse(refreshState.attemptedAt);
  if (!Number.isFinite(attemptedAt)) {
    return true;
  }

  return now.getTime() - attemptedAt >= RUNNER_SNAPSHOT_AUTO_RETRY_COOLDOWN_MS;
}

function readPreviewServiceNames(
  services: Record<string, unknown>[],
): string[] {
  return services
    .filter((service) => typeof service.port === 'number')
    .map((service) =>
      typeof service.name === 'string' ? service.name.trim() : '',
    )
    .filter(Boolean);
}

function toObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
