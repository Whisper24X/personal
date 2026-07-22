import type {
  RunnerOrchestrationConfig,
  RunnerPreviewConfig,
  RunnerRouteConfig,
  RunnerServiceConfig,
} from '../containers/runner-orchestration.types';
import type { RunnerProtocol } from './repo-facts-collector';
import type {
  AiCandidateSelection,
  RunnerCandidateManifest,
  ServiceCandidate,
} from './service-candidate-builder';
import { isPreviewCapableCandidate } from './service-candidate-builder';

export interface AssembledRunnerConfig {
  orchestration: RunnerOrchestrationConfig;
  serviceProtocols: Record<string, RunnerProtocol>;
  selectedCandidates: ServiceCandidate[];
  warnings: string[];
}

export function assembleRunnerConfigFromSelection(
  manifest: RunnerCandidateManifest,
  selection: AiCandidateSelection,
): AssembledRunnerConfig | null {
  const warnings: string[] = [];
  const candidateById = new Map(
    manifest.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const selectedCandidates = selection.selectedServiceCandidateIds
    .map((id) => candidateById.get(id))
    .filter((candidate): candidate is ServiceCandidate => Boolean(candidate));

  if (selectedCandidates.length === 0) {
    warnings.push('No selected service candidates found in manifest');
    return null;
  }

  const services: RunnerServiceConfig[] = [];
  const serviceProtocols: Record<string, RunnerProtocol> = {};

  for (const candidate of dedupeByRepo(selectedCandidates, warnings)) {
    const service = candidateToService(candidate, warnings);
    if (!service) continue;
    services.push(service);
    serviceProtocols[service.name] = candidate.protocol;
  }

  if (services.length === 0) {
    warnings.push('No runnable services assembled from selected candidates');
    return null;
  }

  dedupeServiceNames(services, serviceProtocols);

  const previewCandidate = selection.previewServiceCandidateId
    ? candidateById.get(selection.previewServiceCandidateId)
    : undefined;
  const previewServiceName =
    previewCandidate && isPreviewCapableCandidate(previewCandidate)
      ? previewCandidate.name
      : undefined;
  const previewServices = services.filter((service) => Boolean(service.port));
  const routes = buildRoutes(
    previewServices,
    selection.routePreference ?? 'single-root',
    previewServiceName,
  );
  const preview = buildPreview(previewServices, routes, previewServiceName);

  const orchestration: RunnerOrchestrationConfig = { services };
  if (routes.length > 0) orchestration.routes = routes;
  if (preview) orchestration.preview = preview;

  if (previewServices.length > 1) {
    orchestration.homepage = {
      title: 'AINative Runner',
      links: routes
        .filter((route) => route.action === 'proxy')
        .map((route) => ({
          label: route.service ?? route.path,
          path: route.path,
        })),
    };
  }

  return {
    orchestration,
    serviceProtocols,
    selectedCandidates,
    warnings,
  };
}

function candidateToService(
  candidate: ServiceCandidate,
  warnings: string[],
): RunnerServiceConfig | null {
  if (!candidate.workdir || !candidate.command) {
    warnings.push(`${candidate.id}: missing workdir or command evidence`);
    return null;
  }

  const service: RunnerServiceConfig = {
    name: candidate.name,
    workdir: candidate.workdir.value,
    command: candidate.command.value,
  };

  applyInstallDefaults(service);

  if (candidate.port && isPreviewCapableCandidate(candidate)) {
    service.port = candidate.port.value;
  } else if (candidate.port) {
    warnings.push(
      `${candidate.id}: not exposing ${candidate.port.value} for preview because protocol is ${candidate.port.protocol}`,
    );
  }

  return service;
}

function dedupeByRepo(
  candidates: ServiceCandidate[],
  warnings: string[],
): ServiceCandidate[] {
  const seen = new Set<string>();
  const result: ServiceCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.repoPrefix)) {
      warnings.push(
        `${candidate.repoPrefix}: multiple candidates selected; keeping the first one`,
      );
      continue;
    }
    seen.add(candidate.repoPrefix);
    result.push(candidate);
  }
  return result;
}

function dedupeServiceNames(
  services: RunnerServiceConfig[],
  serviceProtocols: Record<string, RunnerProtocol>,
): void {
  const nameCount = new Map<string, number>();
  for (const service of services) {
    const count = (nameCount.get(service.name) ?? 0) + 1;
    nameCount.set(service.name, count);
    if (count > 1) {
      const protocol = serviceProtocols[service.name];
      service.name = `${service.name}-${count}`;
      if (protocol) serviceProtocols[service.name] = protocol;
    }
  }
}

function buildRoutes(
  services: RunnerServiceConfig[],
  routePreference: 'single-root' | 'per-service',
  previewServiceName: string | undefined,
): RunnerRouteConfig[] {
  if (services.length === 0) return [];

  if (services.length > 1) {
    return services.map((service) => ({
      path: `/${service.name}/`,
      action: 'proxy' as const,
      match: 'prefix' as const,
      service: service.name,
      upstreamPath: '/',
    }));
  }

  if (routePreference === 'single-root' && previewServiceName) {
    const previewService = services.find(
      (service) => service.name === previewServiceName,
    );
    if (previewService) {
      return [
        {
          path: '/',
          action: 'proxy',
          match: 'prefix',
          service: previewService.name,
        },
      ];
    }
  }

  if (services.length === 1) {
    return [
      {
        path: '/',
        action: 'proxy',
        match: 'prefix',
        service: services[0].name,
      },
    ];
  }

  return [];
}

function buildPreview(
  services: RunnerServiceConfig[],
  routes: RunnerRouteConfig[],
  previewServiceName: string | undefined,
): RunnerPreviewConfig | undefined {
  if (services.length === 0 || routes.length === 0) return undefined;
  const previewService =
    services.find((service) => service.name === previewServiceName) ??
    services[0];
  if (services.length > 1) {
    return { service: previewService.name, path: '/' };
  }
  const route = routes.find(
    (candidateRoute) =>
      candidateRoute.action === 'proxy' &&
      candidateRoute.service === previewService.name,
  );
  if (!route) return undefined;
  return { service: previewService.name, path: route.path };
}

function applyInstallDefaults(service: RunnerServiceConfig): void {
  const command = service.command;
  if (command.startsWith('pnpm ')) {
    service.installCommand = 'pnpm install --frozen-lockfile';
    service.installCheckPath = 'node_modules/.modules.yaml';
  } else if (command.startsWith('yarn ')) {
    service.installCommand = 'yarn install --frozen-lockfile';
    service.installCheckPath = 'node_modules/.yarn-integrity';
  } else if (command.startsWith('npm ')) {
    service.installCommand = 'npm ci';
    service.installCheckPath = 'node_modules/.package-lock.json';
  } else if (command.startsWith('go run')) {
    service.installCommand = 'go mod download';
  } else if (command.startsWith('uvicorn') || command.startsWith('python ')) {
    service.installCommand = 'pip install -r requirements.txt';
  }
}
