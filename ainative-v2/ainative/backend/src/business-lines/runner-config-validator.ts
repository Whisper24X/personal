import type {
  RunnerOrchestrationConfig,
  RunnerServiceConfig,
  RunnerRouteConfig,
  RunnerPreviewConfig,
} from '../containers/runner-orchestration.types';
import type { RunnerProtocol } from './repo-facts-collector';

export interface ValidationResult {
  valid: boolean;
  sanitized?: RunnerOrchestrationConfig;
  errors: string[];
}

export interface ValidationOptions {
  serviceProtocols?: Record<string, RunnerProtocol>;
  runnerListenPort?: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const SLUG_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /\bsudo\b/,
  /chmod\s+777/,
  /mkfs\b/,
  /dd\s+if=/,
  />\s*\/dev\/sd/,
];

// Characters that could inject nginx directives or break config parsing
const UNSAFE_ROUTE_STRING = /[\x00-\x1f\x7f{};\\"`$]/;

const TOP_LEVEL_KEYS = new Set(['services', 'routes', 'homepage', 'preview']);
const SERVICE_KEYS = new Set([
  'name',
  'workdir',
  'command',
  'port',
  'readinessPath',
  'env',
  'installCommand',
  'installCheckPath',
  'priority',
  'startsecs',
  'startretries',
]);
const ROUTE_KEYS = new Set([
  'path',
  'action',
  'match',
  'service',
  'targetPort',
  'upstreamPath',
  'websocket',
  'redirectTo',
  'redirectCode',
]);
const HOMEPAGE_KEYS = new Set(['title', 'description', 'links']);
const HOMEPAGE_LINK_KEYS = new Set(['label', 'path']);
const PREVIEW_KEYS = new Set(['service', 'path']);

export function validateRunnerConfigSchema(
  input: unknown,
): SchemaValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Runner config must be an object'] };
  }

  const raw = input as Record<string, unknown>;
  rejectUnknownKeys('root', raw, TOP_LEVEL_KEYS, errors);
  validateSchemaArray('services', raw.services, SERVICE_KEYS, errors, true);
  validateSchemaArray('routes', raw.routes, ROUTE_KEYS, errors, false);
  validateSchemaHomepage(raw.homepage, errors);
  validateSchemaObject('preview', raw.preview, PREVIEW_KEYS, errors, true);

  return { valid: errors.length === 0, errors };
}

export function validateRunnerConfig(
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const raw = input as Record<string, unknown>;
  const services = validateServices(raw.services, errors);

  if (services.length === 0) {
    errors.push('At least one valid service is required');
    return { valid: false, errors };
  }

  const serviceNames = new Set(services.map((s) => s.name));
  const routes = validateRoutes(raw.routes, serviceNames, errors);
  const preview = validatePreview(
    raw.preview,
    serviceNames,
    routes,
    raw.homepage,
    errors,
  );
  validatePreviewRuntimeRules(services, preview, options, errors);
  validateMultiServicePreviewLayout(services, routes, raw.homepage, errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const sanitized = normalizeOrchestration(services, routes, preview, raw);
  validatePreviewRuntimeRules(
    sanitized.services,
    sanitized.preview,
    options,
    errors,
  );
  validateMultiServicePreviewLayout(
    sanitized.services,
    sanitized.routes ?? [],
    raw.homepage,
    errors,
  );
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, sanitized, errors: [] };
}

function validateServices(
  raw: unknown,
  errors: string[],
): RunnerServiceConfig[] {
  if (!Array.isArray(raw)) {
    errors.push('services must be an array');
    return [];
  }

  const valid: RunnerServiceConfig[] = [];
  const names = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object') {
      errors.push(`services[${i}]: must be an object`);
      continue;
    }

    const s = entry as Record<string, unknown>;
    const name = typeof s.name === 'string' ? s.name.trim() : '';
    const workdir = typeof s.workdir === 'string' ? s.workdir.trim() : '';
    const command = typeof s.command === 'string' ? s.command.trim() : '';

    if (!name) {
      errors.push(`services[${i}]: name is required`);
      continue;
    }
    if (!SLUG_PATTERN.test(name)) {
      errors.push(`services[${i}]: name '${name}' must match [a-zA-Z0-9_.-]`);
      continue;
    }
    if (names.has(name)) {
      errors.push(`services[${i}]: duplicate name '${name}'`);
      continue;
    }

    if (!workdir) {
      errors.push(`services[${i}]: workdir is required`);
      continue;
    }
    if (workdir.startsWith('/') || workdir.includes('..')) {
      errors.push(
        `services[${i}]: workdir '${workdir}' must be relative without '..'`,
      );
      continue;
    }

    if (!command) {
      errors.push(`services[${i}]: command is required`);
      continue;
    }
    if (command.includes('\0') || command.includes('\n')) {
      errors.push(`services[${i}]: command contains invalid characters`);
      continue;
    }
    if (isDangerousCommand(command)) {
      errors.push(`services[${i}]: command contains dangerous pattern`);
      continue;
    }

    const port = parsePort(s.port);
    if (s.port !== undefined && s.port !== null && port === undefined) {
      errors.push(`services[${i}]: port must be 1-65535`);
      continue;
    }

    const readinessPath =
      typeof s.readinessPath === 'string' ? s.readinessPath.trim() : '';
    if (readinessPath) {
      if (!readinessPath.startsWith('/')) {
        errors.push(`services[${i}]: readinessPath must start with '/'`);
        continue;
      }
      if (/^[a-z]+:\/\//i.test(readinessPath)) {
        errors.push(`services[${i}]: readinessPath must not be a full URL`);
        continue;
      }
      if (UNSAFE_ROUTE_STRING.test(readinessPath)) {
        errors.push(`services[${i}]: readinessPath contains unsafe characters`);
        continue;
      }
    }

    const installCheckPath =
      typeof s.installCheckPath === 'string'
        ? s.installCheckPath.trim()
        : undefined;
    if (
      installCheckPath &&
      (installCheckPath.startsWith('/') || installCheckPath.includes('..'))
    ) {
      errors.push(
        `services[${i}]: installCheckPath must be relative without '..'`,
      );
      continue;
    }

    const installCommand =
      typeof s.installCommand === 'string' ? s.installCommand.trim() : '';
    if (installCommand) {
      if (installCommand.includes('\0') || installCommand.includes('\n')) {
        errors.push(
          `services[${i}]: installCommand contains invalid characters`,
        );
        continue;
      }
      if (isDangerousCommand(installCommand)) {
        errors.push(
          `services[${i}]: installCommand contains dangerous pattern`,
        );
        continue;
      }
    }

    names.add(name);

    const service: RunnerServiceConfig = { name, workdir, command };
    if (port !== undefined) service.port = port;
    if (readinessPath) service.readinessPath = readinessPath;
    if (installCommand) {
      service.installCommand = installCommand;
    }
    if (installCheckPath) service.installCheckPath = installCheckPath;
    if (typeof s.priority === 'number' && s.priority > 0)
      service.priority = s.priority;
    if (typeof s.startsecs === 'number' && s.startsecs > 0)
      service.startsecs = s.startsecs;
    if (typeof s.startretries === 'number' && s.startretries >= 0)
      service.startretries = s.startretries;

    if (s.env && typeof s.env === 'object' && !Array.isArray(s.env)) {
      const envEntries = Object.entries(s.env as Record<string, unknown>);
      if (envEntries.length > 10) {
        errors.push(`services[${i}]: env has too many entries (max 10)`);
        continue;
      }
      const envMap: Record<string, string> = {};
      let envValid = true;
      for (const [k, v] of envEntries) {
        if (typeof v !== 'string') continue;
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
          errors.push(
            `services[${i}]: env key '${k}' must be a valid env var name`,
          );
          envValid = false;
          break;
        }
        envMap[k] = v;
      }
      if (!envValid) continue;
      if (Object.keys(envMap).length > 0) service.env = envMap;
    }

    valid.push(service);
  }

  return valid;
}

function validateSchemaArray(
  name: string,
  value: unknown,
  allowedKeys: Set<string>,
  errors: string[],
  required: boolean,
): void {
  if (value === undefined || value === null) {
    if (required) errors.push(`${name} is required`);
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${name} must be an array`);
    return;
  }
  if (required && value.length === 0) {
    errors.push(`${name} must not be empty`);
  }
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${name}[${index}] must be an object`);
      return;
    }
    rejectUnknownKeys(
      `${name}[${index}]`,
      entry as Record<string, unknown>,
      allowedKeys,
      errors,
    );
  });
}

function validateSchemaObject(
  name: string,
  value: unknown,
  allowedKeys: Set<string>,
  errors: string[],
  required: boolean,
): void {
  if (value === undefined || value === null) {
    if (required) errors.push(`${name} is required`);
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${name} must be an object`);
    return;
  }
  rejectUnknownKeys(
    name,
    value as Record<string, unknown>,
    allowedKeys,
    errors,
  );
}

function validateSchemaHomepage(value: unknown, errors: string[]): void {
  if (value === undefined || value === null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('homepage must be an object');
    return;
  }
  const homepage = value as Record<string, unknown>;
  rejectUnknownKeys('homepage', homepage, HOMEPAGE_KEYS, errors);
  if (homepage.links === undefined || homepage.links === null) return;
  if (!Array.isArray(homepage.links)) {
    errors.push('homepage.links must be an array');
    return;
  }
  homepage.links.forEach((link, index) => {
    if (!link || typeof link !== 'object' || Array.isArray(link)) {
      errors.push(`homepage.links[${index}] must be an object`);
      return;
    }
    rejectUnknownKeys(
      `homepage.links[${index}]`,
      link as Record<string, unknown>,
      HOMEPAGE_LINK_KEYS,
      errors,
    );
  });
}

function rejectUnknownKeys(
  location: string,
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${location}: unknown field '${key}'`);
    }
  }
}

function validateRoutes(
  raw: unknown,
  serviceNames: Set<string>,
  errors: string[],
): RunnerRouteConfig[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    errors.push('routes must be an array');
    return [];
  }

  const valid: RunnerRouteConfig[] = [];
  const paths = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object') continue;

    const r = entry as Record<string, unknown>;
    const routePath = typeof r.path === 'string' ? r.path.trim() : '';
    if (!routePath) continue;

    if (!routePath.startsWith('/')) {
      errors.push(`routes[${i}]: path '${routePath}' must start with '/'`);
      continue;
    }

    if (UNSAFE_ROUTE_STRING.test(routePath)) {
      errors.push(
        `routes[${i}]: path contains unsafe characters (control/special)`,
      );
      continue;
    }

    if (paths.has(routePath)) {
      errors.push(`routes[${i}]: duplicate path '${routePath}'`);
      continue;
    }
    paths.add(routePath);

    const action = r.action === 'redirect' ? 'redirect' : 'proxy';

    if (action === 'proxy') {
      const service = typeof r.service === 'string' ? r.service.trim() : '';
      if (!service || !serviceNames.has(service)) {
        errors.push(`routes[${i}]: references unknown service '${service}'`);
        continue;
      }

      const targetPort = parsePort(r.targetPort);
      if (
        r.targetPort !== undefined &&
        r.targetPort !== null &&
        targetPort === undefined
      ) {
        errors.push(`routes[${i}]: targetPort must be 1-65535`);
        continue;
      }

      const upstreamPath =
        typeof r.upstreamPath === 'string' ? r.upstreamPath.trim() : '';
      if (upstreamPath && UNSAFE_ROUTE_STRING.test(upstreamPath)) {
        errors.push(`routes[${i}]: upstreamPath contains unsafe characters`);
        continue;
      }

      const route: RunnerRouteConfig = {
        path: routePath,
        action: 'proxy',
        service,
      };
      if (r.match === 'exact' || r.match === 'regex') route.match = r.match;
      else route.match = 'prefix';
      if (targetPort !== undefined) route.targetPort = targetPort;
      if (upstreamPath) route.upstreamPath = upstreamPath;
      if (r.websocket === true) route.websocket = true;
      valid.push(route);
    } else {
      const redirectTo =
        typeof r.redirectTo === 'string' ? r.redirectTo.trim() : '';
      if (!redirectTo) continue;

      if (UNSAFE_ROUTE_STRING.test(redirectTo)) {
        errors.push(`routes[${i}]: redirectTo contains unsafe characters`);
        continue;
      }

      valid.push({
        path: routePath,
        action: 'redirect',
        redirectTo,
        redirectCode: typeof r.redirectCode === 'number' ? r.redirectCode : 302,
      });
    }
  }

  return valid;
}

function validatePreview(
  raw: unknown,
  serviceNames: Set<string>,
  routes: RunnerRouteConfig[],
  rawHomepage: unknown,
  errors: string[],
): RunnerPreviewConfig | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object') return undefined;

  const p = raw as Record<string, unknown>;
  const service = typeof p.service === 'string' ? p.service.trim() : '';

  if (!service || !serviceNames.has(service)) {
    errors.push(
      `preview.service '${service}' must reference an existing service`,
    );
    return undefined;
  }

  const previewPath = typeof p.path === 'string' ? p.path.trim() : '/';
  const preview: RunnerPreviewConfig = { service, path: previewPath };
  if (isHomepageRootPreview(rawHomepage, preview)) {
    return preview;
  }
  const matchingRoute = routes.find(
    (r) =>
      r.action === 'proxy' &&
      r.service === service &&
      previewPath.startsWith(r.path),
  );
  if (!matchingRoute) {
    errors.push(
      `preview references service '${service}' at path '${previewPath}' but no matching route exists`,
    );
    return undefined;
  }

  return preview;
}

function validatePreviewRuntimeRules(
  services: RunnerServiceConfig[],
  preview: RunnerPreviewConfig | undefined,
  options: ValidationOptions,
  errors: string[],
): void {
  if (!preview) return;

  const service = services.find((item) => item.name === preview.service);
  if (!service) return;

  const protocol = options.serviceProtocols?.[service.name];
  if (protocol === 'grpc' || protocol === 'metrics' || protocol === 'tcp') {
    errors.push(
      `preview.service '${service.name}' resolves to non-HTTP protocol '${protocol}'`,
    );
  }

  if (
    service.port &&
    options.runnerListenPort &&
    service.port === options.runnerListenPort
  ) {
    errors.push(
      `preview.service '${service.name}' uses port ${service.port}, which conflicts with runner listen port ${options.runnerListenPort}`,
    );
  }
}

function validateMultiServicePreviewLayout(
  services: RunnerServiceConfig[],
  routes: RunnerRouteConfig[],
  rawHomepage: unknown,
  errors: string[],
): void {
  const previewServices = services.filter(
    (service) => typeof service.port === 'number',
  );
  if (previewServices.length <= 1) {
    return;
  }

  const proxyRoutes = routes.filter((route) => route.action !== 'redirect');
  const previewServiceNames = new Set(
    previewServices.map((service) => service.name),
  );
  const routePathsByService = new Map<string, string[]>();

  for (const route of proxyRoutes) {
    const serviceName = route.service?.trim();
    if (!serviceName || !previewServiceNames.has(serviceName)) {
      continue;
    }

    const existingPaths = routePathsByService.get(serviceName) ?? [];
    if (!existingPaths.includes(route.path)) {
      existingPaths.push(route.path);
    }
    routePathsByService.set(serviceName, existingPaths);
  }

  for (const service of previewServices) {
    const actualPaths = routePathsByService.get(service.name) ?? [];
    if (actualPaths.length === 0) {
      errors.push(
        `multi-service preview service '${service.name}' must have a dedicated proxy route`,
      );
      continue;
    }
    const hasDedicatedNonRootRoute = actualPaths.some((path) => path !== '/');
    if (!hasDedicatedNonRootRoute) {
      errors.push(
        `multi-service preview service '${service.name}' must not rely on '/' as its only proxy route`,
      );
    }
  }

  if (
    !rawHomepage ||
    typeof rawHomepage !== 'object' ||
    Array.isArray(rawHomepage)
  ) {
    return;
  }
  const homepage = rawHomepage as Record<string, unknown>;
  if (!Array.isArray(homepage.links)) {
    return;
  }

  const links = homepage.links.filter(
    (link): link is Record<string, unknown> =>
      Boolean(link) && typeof link === 'object' && !Array.isArray(link),
  );

  for (const service of previewServices) {
    const actualPaths = routePathsByService.get(service.name) ?? [];
    const hasMatchingLink = links.some(
      (link) =>
        typeof link.path === 'string' && actualPaths.includes(link.path.trim()),
    );
    if (!hasMatchingLink) {
      errors.push(
        `multi-service homepage must include a link for '${service.name}'`,
      );
    }
  }

  for (const link of links) {
    const path = typeof link.path === 'string' ? link.path.trim() : '';
    if (path === '/') {
      errors.push("multi-service homepage links must not point to '/'");
    }
  }
}

function normalizeOrchestration(
  services: RunnerServiceConfig[],
  routes: RunnerRouteConfig[],
  preview: RunnerPreviewConfig | undefined,
  raw: Record<string, unknown>,
): RunnerOrchestrationConfig {
  const servicesWithPort = services.filter((s) => s.port);
  let finalRoutes = routes;
  let finalPreview = preview;

  if (finalRoutes.length === 0 && servicesWithPort.length > 0) {
    if (servicesWithPort.length === 1) {
      const svc = servicesWithPort[0];
      finalRoutes = [
        { path: '/', action: 'proxy', match: 'prefix', service: svc.name },
      ];
    } else {
      finalRoutes = servicesWithPort.map((svc) => ({
        path: `/${svc.name}/`,
        action: 'proxy' as const,
        match: 'prefix' as const,
        service: svc.name,
      }));
    }
  }

  if (!finalPreview && servicesWithPort.length > 0) {
    if (servicesWithPort.length === 1) {
      finalPreview = { service: servicesWithPort[0].name, path: '/' };
    } else {
      const first = servicesWithPort[0];
      finalPreview = { service: first.name, path: `/${first.name}/` };
    }
  }

  // Ensure synthesized preview has a matching proxy route
  if (finalPreview && finalRoutes.length > 0) {
    const pService = finalPreview.service;
    const pPath = finalPreview.path ?? '/';
    const hasMatchingRoute =
      isHomepageRootPreview(raw.homepage, finalPreview) ||
      finalRoutes.some(
        (r) =>
          r.action === 'proxy' &&
          r.service === pService &&
          pPath.startsWith(r.path),
      );
    if (!hasMatchingRoute) {
      finalPreview = undefined;
    }
  }

  const result: RunnerOrchestrationConfig = { services };
  if (finalRoutes.length > 0) result.routes = finalRoutes;
  if (finalPreview) result.preview = finalPreview;

  if (raw.homepage && typeof raw.homepage === 'object') {
    const h = raw.homepage as Record<string, unknown>;
    if (typeof h.title === 'string' || typeof h.description === 'string') {
      result.homepage = {
        title: typeof h.title === 'string' ? h.title : undefined,
        description:
          typeof h.description === 'string' ? h.description : undefined,
        links: Array.isArray(h.links)
          ? h.links
              .filter(
                (l: unknown) =>
                  l &&
                  typeof l === 'object' &&
                  typeof (l as Record<string, unknown>).label === 'string' &&
                  typeof (l as Record<string, unknown>).path === 'string',
              )
              .map((l: unknown) => ({
                label: (l as Record<string, string>).label,
                path: (l as Record<string, string>).path,
              }))
          : undefined,
      };
    }
  }

  return result;
}

function isHomepageRootPreview(
  rawHomepage: unknown,
  preview: RunnerPreviewConfig | undefined,
): boolean {
  if (!preview || preview.path !== '/') return false;
  if (
    !rawHomepage ||
    typeof rawHomepage !== 'object' ||
    Array.isArray(rawHomepage)
  ) {
    return false;
  }
  const homepage = rawHomepage as Record<string, unknown>;
  return Array.isArray(homepage.links) && homepage.links.length > 0;
}

function parsePort(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(num) || num < 1 || num > 65535) return undefined;
  return Math.floor(num);
}

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}
