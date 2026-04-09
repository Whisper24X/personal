import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Project } from '../projects/domain/project';
import {
  ContainerExecutionConfigService,
  SandboxProfile,
} from './container-execution-config.service';
import {
  ProjectRunnerConfigFile,
  RunnerNamedVolumeConfig,
  RunnerOrchestrationConfig,
  RunnerPreviewConfig,
  RunnerRouteConfig,
  RunnerServiceConfig,
} from './runner-orchestration.types';

@Injectable()
export class RunnerOrchestrationService {
  readonly backupFileName = 'ainative.runner.json';

  constructor(
    private readonly containerConfig: ContainerExecutionConfigService,
  ) {}

  readConfiguredOrchestration(
    project?: Project | null,
  ): RunnerOrchestrationConfig | null {
    if (!project?.configJson || typeof project.configJson !== 'object') {
      return null;
    }

    const configJson = project.configJson as Record<string, unknown>;
    const containerRuntime = this.toObjectRecord(configJson.containerRuntime);
    const rawOrchestration = this.toObjectRecord(
      containerRuntime?.runnerOrchestration,
    );

    if (!rawOrchestration) {
      return null;
    }

    return this.normalizeOrchestration(rawOrchestration);
  }

  buildEffectiveOrchestration(
    project?: Project | null,
  ): RunnerOrchestrationConfig | null {
    return (
      this.readConfiguredOrchestration(project) ??
      this.buildDefaultOrchestration(
        this.containerConfig.getSandboxProfile(project),
      )
    );
  }

  resolvePreviewConfig(project?: Project | null): RunnerPreviewConfig | null {
    return this.buildEffectiveOrchestration(project)?.preview ?? null;
  }

  buildProjectRunnerConfigFile(
    project: Project,
  ): ProjectRunnerConfigFile | null {
    const orchestration = this.buildEffectiveOrchestration(project);
    if (!orchestration) {
      return null;
    }
    const runnerPlatform = this.containerConfig.getRunnerPlatform(project);

    const runtimeSharedVolumes = this.mergeSharedVolumes(
      this.buildDefaultSharedVolumes(
        this.containerConfig.getSandboxProfile(project),
      ),
      orchestration.sharedVolumes ?? [],
    );

    return {
      version: 1,
      project: {
        id: project.id,
        name: project.name,
        gitUrl: project.gitUrl,
        defaultBranch: project.defaultBranch,
      },
      runtime: {
        ...(runnerPlatform ? { platform: runnerPlatform } : {}),
        networkMode: this.containerConfig.getRunnerNetworkMode(project),
        listenPort: this.containerConfig.getRunnerExposeContainerPort(project),
        startTimeoutMs: this.containerConfig.getRunnerStartTimeoutMs(project),
        ...(this.containerConfig.getRunnerCpuLimit(project)
          ? { cpuLimit: this.containerConfig.getRunnerCpuLimit(project) }
          : {}),
        resourceLimits: this.containerConfig.resourceLimitsForProfile(project),
        env: this.containerConfig.getRunnerEnv(project),
        ...(runtimeSharedVolumes.length
          ? { sharedVolumes: runtimeSharedVolumes }
          : {}),
      },
      orchestration,
    };
  }

  serializeProjectRunnerConfigFile(project: Project): string | null {
    const configFile = this.buildProjectRunnerConfigFile(project);
    if (!configFile) {
      return null;
    }

    return `${JSON.stringify(configFile, null, 2)}\n`;
  }

  async writeProjectRunnerConfigFile(
    project: Project,
    repositoryRoot: string,
  ): Promise<string | null> {
    const content = this.serializeProjectRunnerConfigFile(project);
    if (!content) {
      return null;
    }

    const targetPath = path.join(repositoryRoot, this.backupFileName);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf-8');
    return targetPath;
  }

  buildAnonymousVolumeMounts(
    workspaceMount: string,
    project?: Project | null,
  ): string[] {
    const orchestration = this.buildEffectiveOrchestration(project);
    const mounts = new Set<string>([`${workspaceMount}/logs`]);

    for (const service of orchestration?.services ?? []) {
      if (!service.installCommand) {
        continue;
      }

      const target = path.posix.join(
        workspaceMount,
        service.workdir.replace(/^\/+/, ''),
        'node_modules',
      );
      mounts.add(target);
    }

    return Array.from(mounts);
  }

  private buildDefaultOrchestration(
    profile: SandboxProfile,
  ): RunnerOrchestrationConfig | null {
    if (profile === 'preview-web') {
      return {
        services: [
          {
            name: 'ainative-backend',
            workdir: 'ainative-backend',
            command: "GOFLAGS='-p=1' air -c .air.toml",
            port: 8000,
            env: {
              GO_ENV: 'development',
            },
            priority: 100,
            startsecs: 5,
            startretries: 3,
          },
          {
            name: 'ainative-shadow',
            workdir: 'ainative-shadow',
            command: 'pnpm dev',
            port: 5176,
            env: {
              CI: 'true',
              BROWSER: 'none',
              APP_PROJECT_NAME: 'shadow',
              BASE_API_URL: '/api/yanxue',
              VITE_BASE_URL: '/shadow/',
              VITE_API_URL: '/api',
              SANDBOX: 'true',
            },
            installCommand: 'pnpm install',
            installCheckPath: 'node_modules/.bin/rsbuild',
            priority: 110,
            startsecs: 10,
            startretries: 3,
          },
          {
            name: 'ainative-app',
            workdir: 'ainative-app',
            command: 'npm run dev:h5:local',
            port: 8200,
            env: {
              TARO_APP_API: '/api',
              BROWSER: 'none',
              CI: 'true',
            },
            installCommand: 'npm install',
            installCheckPath: 'node_modules/.bin/taro',
            priority: 120,
            startsecs: 10,
            startretries: 3,
          },
        ],
        routes: [
          {
            path: '/app',
            match: 'exact',
            action: 'redirect',
            redirectTo: '/app/',
            redirectCode: 302,
          },
          {
            path: '/shadow',
            match: 'exact',
            action: 'redirect',
            redirectTo: '/shadow/',
            redirectCode: 302,
          },
          {
            path: '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
            match: 'regex',
            service: 'ainative-app',
          },
          {
            path: '/api/',
            match: 'prefix',
            service: 'ainative-backend',
            upstreamPath: '/',
            websocket: true,
          },
          {
            path: '/shadow/',
            match: 'prefix',
            service: 'ainative-shadow',
            upstreamPath: '/',
            websocket: true,
          },
          {
            path: '/static/',
            match: 'prefix',
            service: 'ainative-shadow',
          },
          {
            path: '/rsbuild-hmr',
            match: 'prefix',
            service: 'ainative-shadow',
            websocket: true,
          },
          {
            path: '/app/',
            match: 'prefix',
            service: 'ainative-app',
            upstreamPath: '/',
            websocket: true,
          },
          {
            path: '/',
            match: 'prefix',
            service: 'ainative-app',
            websocket: true,
          },
        ],
        homepage: {
          title: 'AINative Workspace',
          description: '开发环境服务导航',
          links: [
            {
              label: 'App',
              path: '/app/',
            },
            {
              label: 'Shadow',
              path: '/shadow/',
            },
            {
              label: 'Backend',
              path: '/api/',
            },
          ],
        },
        preview: {
          service: 'ainative-app',
          path: '/',
        },
      };
    }

    if (profile === 'runner-only') {
      return {
        services: [],
        routes: [],
      };
    }

    return null;
  }

  private buildDefaultSharedVolumes(
    profile: SandboxProfile,
  ): RunnerNamedVolumeConfig[] {
    if (profile === 'preview-web' || profile === 'runner-only') {
      return [
        {
          name: 'ainative-go-mod-cache',
          target: '/go/pkg/mod',
        },
        {
          name: 'ainative-go-build-cache',
          target: '/root/.cache/go-build',
        },
      ];
    }

    return [];
  }

  private normalizeOrchestration(
    input: Record<string, unknown>,
  ): RunnerOrchestrationConfig | null {
    const services = Array.isArray(input.services)
      ? input.services
          .map((value) => this.normalizeService(this.toObjectRecord(value)))
          .filter((value): value is RunnerServiceConfig => value !== null)
      : [];

    if (!services.length) {
      return null;
    }

    const routes = Array.isArray(input.routes)
      ? input.routes
          .map((value) => this.normalizeRoute(this.toObjectRecord(value)))
          .filter((value): value is RunnerRouteConfig => value !== null)
      : [];
    const homepage = this.normalizeHomepage(
      this.toObjectRecord(input.homepage),
    );
    const sharedVolumes = Array.isArray(input.sharedVolumes)
      ? input.sharedVolumes
          .map((value) =>
            this.normalizeSharedVolume(this.toObjectRecord(value)),
          )
          .filter((value): value is RunnerNamedVolumeConfig => value !== null)
      : [];
    const preview = this.normalizePreview(
      this.toObjectRecord(input.preview),
      new Set(services.map((service) => service.name)),
    );

    return {
      services,
      ...(routes.length ? { routes } : {}),
      ...(homepage ? { homepage } : {}),
      ...(sharedVolumes.length ? { sharedVolumes } : {}),
      ...(preview ? { preview } : {}),
    };
  }

  private normalizeService(
    input: Record<string, unknown> | null,
  ): RunnerServiceConfig | null {
    if (!input) {
      return null;
    }

    const name = this.readNonEmptyString(input.name);
    const workdir = this.readNonEmptyString(input.workdir);
    const command = this.readNonEmptyString(input.command);

    if (!name || !workdir || !command) {
      return null;
    }

    const env = this.resolveStringRecord(this.toObjectRecord(input.env));
    const port = this.readPositiveNumber(input.port);
    const installCommand = this.readNonEmptyString(input.installCommand);
    const installCheckPath = this.readNonEmptyString(input.installCheckPath);
    const priority = this.readPositiveNumber(input.priority);
    const startsecs = this.readPositiveNumber(input.startsecs);
    const startretries = this.readPositiveNumber(input.startretries);

    return {
      name,
      workdir,
      command,
      ...(port ? { port } : {}),
      ...(Object.keys(env).length ? { env } : {}),
      ...(installCommand ? { installCommand } : {}),
      ...(installCheckPath ? { installCheckPath } : {}),
      ...(priority ? { priority } : {}),
      ...(startsecs ? { startsecs } : {}),
      ...(startretries ? { startretries } : {}),
    };
  }

  private normalizeRoute(
    input: Record<string, unknown> | null,
  ): RunnerRouteConfig | null {
    if (!input) {
      return null;
    }

    const pathValue = this.readNonEmptyString(input.path);
    if (!pathValue) {
      return null;
    }

    const action = input.action === 'redirect' ? 'redirect' : 'proxy';
    const match =
      input.match === 'exact' || input.match === 'regex'
        ? input.match
        : 'prefix';
    const service = this.readNonEmptyString(input.service);
    const targetPort = this.readPositiveNumber(input.targetPort);
    const upstreamPath = this.readNonEmptyString(input.upstreamPath);
    const redirectTo = this.readNonEmptyString(input.redirectTo);
    const redirectCode = this.readPositiveNumber(input.redirectCode);
    const websocket = input.websocket === true;

    if (action === 'redirect') {
      if (!redirectTo) {
        return null;
      }

      return {
        path: pathValue,
        action,
        match,
        redirectTo,
        ...(redirectCode ? { redirectCode } : {}),
      };
    }

    if (!service) {
      return null;
    }

    return {
      path: pathValue,
      action,
      match,
      service,
      ...(targetPort ? { targetPort } : {}),
      ...(upstreamPath ? { upstreamPath } : {}),
      ...(websocket ? { websocket } : {}),
    };
  }

  private normalizeHomepage(input: Record<string, unknown> | null) {
    if (!input) {
      return null;
    }

    const title = this.readNonEmptyString(input.title);
    const description = this.readNonEmptyString(input.description);
    const links = Array.isArray(input.links)
      ? input.links
          .map((value) => {
            const link = this.toObjectRecord(value);
            const label = this.readNonEmptyString(link?.label);
            const href = this.readNonEmptyString(link?.path);

            if (!label || !href) {
              return null;
            }

            return { label, path: href };
          })
          .filter(
            (
              value,
            ): value is {
              label: string;
              path: string;
            } => value !== null,
          )
      : [];

    if (!title && !description && !links.length) {
      return null;
    }

    return {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(links.length ? { links } : {}),
    };
  }

  private normalizeSharedVolume(
    input: Record<string, unknown> | null,
  ): RunnerNamedVolumeConfig | null {
    if (!input) {
      return null;
    }

    const name = this.readNonEmptyString(input.name);
    const target = this.readNonEmptyString(input.target);

    if (!name || !target) {
      return null;
    }

    return { name, target };
  }

  private normalizePreview(
    input: Record<string, unknown> | null,
    serviceNames: Set<string>,
  ): RunnerPreviewConfig | null {
    if (!input) {
      return null;
    }

    const service = this.readNonEmptyString(input.service);
    if (!service || !serviceNames.has(service)) {
      return null;
    }

    const pathValue = this.normalizePreviewPath(input.path);
    return {
      service,
      ...(pathValue ? { path: pathValue } : {}),
    };
  }

  private normalizePreviewPath(value: unknown): string | null {
    const pathValue = this.readNonEmptyString(value);
    if (!pathValue) {
      return null;
    }

    return pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
  }

  private mergeSharedVolumes(
    defaults: RunnerNamedVolumeConfig[],
    custom: RunnerNamedVolumeConfig[],
  ): RunnerNamedVolumeConfig[] {
    const volumes = new Map<string, RunnerNamedVolumeConfig>();

    for (const item of defaults) {
      volumes.set(`${item.name}:${item.target}`, item);
    }

    for (const item of custom) {
      volumes.set(`${item.name}:${item.target}`, item);
    }

    return Array.from(volumes.values());
  }

  private resolveStringRecord(
    input: Record<string, unknown> | null,
  ): Record<string, string> {
    if (!input) {
      return {};
    }

    return Object.entries(input).reduce<Record<string, string>>(
      (result, [key, value]) => {
        if (typeof value === 'string' && key.trim()) {
          result[key] = value;
        }
        return result;
      },
      {},
    );
  }

  private readNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private readPositiveNumber(value: unknown): number | null {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.floor(parsed);
  }

  private toObjectRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
