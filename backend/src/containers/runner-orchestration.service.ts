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

  buildProjectRunnerConfigFile(
    project: Project,
  ): ProjectRunnerConfigFile | null {
    const orchestration = this.buildEffectiveOrchestration(project);
    if (!orchestration) {
      return null;
    }

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
        networkMode: this.containerConfig.getRunnerNetworkMode(project),
        hostIp: this.containerConfig.getRunnerExposeHostIp(project),
        hostPort: this.containerConfig.getRunnerExposeContainerPort(project),
        containerPort:
          this.containerConfig.getRunnerExposeContainerPort(project),
        startTimeoutMs: this.containerConfig.getRunnerStartTimeoutMs(project),
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
            name: 'backend',
            workdir: 'backend',
            command: 'npm run start:dev',
            port: 9000,
            env: {
              NODE_ENV: 'development',
              APP_PORT: '9000',
            },
            installCommand:
              'npm ci --no-audit --no-fund || npm install --no-audit --no-fund',
            installCheckPath: 'node_modules/.bin/nest',
            priority: 100,
            startsecs: 10,
            startretries: 3,
          },
          {
            name: 'frontend',
            workdir: 'frontend',
            command: 'npm run dev -- --host 0.0.0.0 --port 8000',
            port: 8000,
            env: {
              NODE_ENV: 'development',
              CI: 'true',
              BROWSER: 'none',
            },
            installCommand:
              'npm ci --no-audit --no-fund --include=optional || npm install --no-audit --no-fund --include=optional',
            installCheckPath: 'node_modules/.bin/vite',
            priority: 110,
            startsecs: 10,
            startretries: 3,
          },
        ],
        routes: [
          {
            path: '/api/',
            match: 'prefix',
            service: 'backend',
            upstreamPath: '/',
            websocket: true,
          },
          {
            path: '/ws',
            match: 'exact',
            service: 'backend',
            upstreamPath: '/ws',
            websocket: true,
          },
          {
            path: '/',
            match: 'prefix',
            service: 'frontend',
            websocket: true,
          },
        ],
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
    void profile;
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

    return {
      services,
      ...(routes.length ? { routes } : {}),
      ...(homepage ? { homepage } : {}),
      ...(sharedVolumes.length ? { sharedVolumes } : {}),
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
