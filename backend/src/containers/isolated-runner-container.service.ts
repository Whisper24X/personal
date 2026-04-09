import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import {
  RunnerNetworkMode,
  RunnerPlatform,
} from './container-execution-config.service';
import { RunnerNamedVolumeConfig } from './runner-orchestration.types';

export type ContainerInspectResult = {
  id: string;
  status: string;
  running: boolean;
  image: string | null;
  platform: string | null;
  publishedPorts: PublishedPortMapping[];
};

export type ContainerListItem = { name: string; id: string };
type ReadinessProbeResult = { ready: boolean; reason?: string };
export type PublishedPortMapping = {
  hostIp: string;
  hostPort: number;
  containerPort: number;
};

@Injectable()
export class IsolatedRunnerContainerService {
  private readonly logger = new Logger(IsolatedRunnerContainerService.name);

  async run(params: {
    containerName: string;
    image: string;
    worktreePath: string;
    workspaceMount: string;
    command?: string[];
    env?: Record<string, string>;
    cpuLimit?: number;
    resourceLimits?: { memoryMb?: number; pidsLimit?: number };
    namedVolumeMounts?: RunnerNamedVolumeConfig[];
    anonymousVolumeMounts?: string[];
    readinessProbeUrl?: string | null;
    startTimeoutMs?: number;
    platform?: RunnerPlatform | null;
    networkMode?: RunnerNetworkMode;
    publishedPorts?: PublishedPortMapping[];
  }): Promise<{ containerId: string; publishedPorts: PublishedPortMapping[] }> {
    const startTimeoutMs = params.startTimeoutMs ?? 30_000;
    const networkMode = params.networkMode ?? 'host';
    const publishedPorts =
      networkMode === 'bridge' ? (params.publishedPorts ?? []) : [];
    this.logger.log(
      `runner_container_start ${JSON.stringify({
        containerName: params.containerName,
        image: params.image,
        worktreePath: params.worktreePath,
        workspaceMount: params.workspaceMount,
        command: params.command ?? ['sleep', 'infinity'],
        namedVolumeMounts: params.namedVolumeMounts ?? [],
        anonymousVolumeMounts: params.anonymousVolumeMounts ?? [],
        cpuLimit: params.cpuLimit ?? null,
        resourceLimits: params.resourceLimits ?? {},
        readinessProbeUrl: params.readinessProbeUrl ?? null,
        startTimeoutMs,
        platform: params.platform ?? null,
        networkMode,
        publishedPorts,
      })}`,
    );
    const args = [
      'run',
      '-d',
      '--name',
      params.containerName,
      ...(params.platform ? ['--platform', params.platform] : []),
      '--network',
      networkMode,
      '-v',
      `${params.worktreePath}:${params.workspaceMount}`,
    ];
    for (const mapping of publishedPorts) {
      args.push(
        '-p',
        `${mapping.hostIp}:${mapping.hostPort}:${mapping.containerPort}`,
      );
    }

    if (params.cpuLimit) {
      args.push('--cpus', String(params.cpuLimit));
    }
    if (params.resourceLimits?.memoryMb) {
      args.push('--memory', `${params.resourceLimits.memoryMb}m`);
    }
    if (params.resourceLimits?.pidsLimit) {
      args.push('--pids-limit', String(params.resourceLimits.pidsLimit));
    }

    for (const volume of params.namedVolumeMounts ?? []) {
      args.push('-v', `${volume.name}:${volume.target}`);
    }

    for (const mountPath of params.anonymousVolumeMounts ?? []) {
      args.push('-v', mountPath);
    }

    if (params.env) {
      for (const [key, value] of Object.entries(params.env)) {
        if (value === undefined) {
          continue;
        }
        args.push('-e', `${key}=${value}`);
      }
    }

    args.push(params.image, ...(params.command ?? ['sleep', 'infinity']));

    const containerId = (await this.execDockerCapture(args)).trim();
    if (!containerId) {
      throw new Error('docker run did not return container id');
    }
    this.logger.log(
      `runner_container_started ${JSON.stringify({
        containerName: params.containerName,
        containerId,
      })}`,
    );

    const deadline = Date.now() + startTimeoutMs;
    let runningObserved = false;
    let lastStatus = 'unknown';
    let lastReadinessFailure: string | null = null;
    while (Date.now() < deadline) {
      const inspection = await this.inspectById(containerId);
      lastStatus = inspection?.status ?? 'missing';
      if (inspection?.running) {
        runningObserved = true;
        if (params.readinessProbeUrl) {
          const readiness = await this.probeReadiness(
            containerId,
            params.readinessProbeUrl,
          );
          if (!readiness.ready) {
            lastReadinessFailure =
              readiness.reason ?? 'unknown readiness failure';
            await this.delay(1000);
            continue;
          }
        }
        return { containerId, publishedPorts };
      }
      await this.delay(300);
    }

    if (runningObserved && params.readinessProbeUrl) {
      throw new Error(
        `Container ${params.containerName} reached running state but readiness probe ${params.readinessProbeUrl} did not pass within ${startTimeoutMs}ms (lastReadinessFailure=${lastReadinessFailure ?? 'unknown'})`,
      );
    }

    throw new Error(
      `Container ${params.containerName} did not reach running state within ${startTimeoutMs}ms (lastStatus=${lastStatus})`,
    );
  }

  async remove(containerName: string): Promise<void> {
    try {
      await this.execDocker(['rm', '-f', '-v', containerName]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isNoSuchContainerMessage(message)) {
        return;
      }
      this.logger.warn(`docker rm failed for ${containerName}: ${message}`);
    }
  }

  async inspect(containerName: string): Promise<ContainerInspectResult | null> {
    try {
      const json = await this.execDockerCapture([
        'inspect',
        containerName,
        '--format',
        '{{json .}}',
      ]);
      const parsed = JSON.parse(json) as {
        Id?: string;
        Image?: string;
        State?: { Status?: string; Running?: boolean };
        Config?: { Image?: string };
        NetworkSettings?: {
          Ports?: Record<
            string,
            Array<{ HostIp?: string; HostPort?: string }> | null
          >;
        };
      };
      const id = parsed.Id ?? '';
      const running = parsed.State?.Running === true;
      const status = parsed.State?.Status ?? 'unknown';
      const imageId = parsed.Image?.trim() ?? '';
      if (!id) {
        return null;
      }
      return {
        id,
        status,
        running,
        image: parsed.Config?.Image?.trim() || null,
        platform: await this.resolveImagePlatform(imageId),
        publishedPorts: this.parsePublishedPorts(parsed.NetworkSettings?.Ports),
      };
    } catch {
      return null;
    }
  }

  async listAinativeContainers(): Promise<ContainerListItem[]> {
    try {
      const out = await this.execDockerCapture([
        'ps',
        '-a',
        '--filter',
        'name=ainative-',
        '--format',
        '{{.ID}} {{.Names}}',
      ]);
      const lines = out
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const items: ContainerListItem[] = [];
      for (const line of lines) {
        const space = line.indexOf(' ');
        if (space <= 0) {
          continue;
        }
        const id = line.slice(0, space).trim();
        const name = line.slice(space + 1).trim();
        if (id && name) {
          items.push({ id, name });
        }
      }
      return items;
    } catch (error) {
      this.logger.warn(
        `listAinativeContainers failed: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  private async inspectById(
    containerId: string,
  ): Promise<ContainerInspectResult | null> {
    return this.inspect(containerId);
  }

  private parsePublishedPorts(
    ports?: Record<
      string,
      Array<{ HostIp?: string; HostPort?: string }> | null
    >,
  ): PublishedPortMapping[] {
    if (!ports) {
      return [];
    }

    const mappings: PublishedPortMapping[] = [];
    for (const [containerPortWithProto, hostBindings] of Object.entries(
      ports,
    )) {
      const containerPort = this.parseContainerPort(containerPortWithProto);
      if (!containerPort || !hostBindings?.length) {
        continue;
      }
      for (const binding of hostBindings) {
        const hostPort = Number.parseInt(binding.HostPort ?? '', 10);
        if (!Number.isFinite(hostPort) || hostPort <= 0) {
          continue;
        }
        mappings.push({
          hostIp: binding.HostIp?.trim() || '0.0.0.0',
          hostPort,
          containerPort,
        });
      }
    }

    return mappings;
  }

  private parseContainerPort(value: string): number | null {
    const raw = value.split('/')[0]?.trim() ?? '';
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  private async probeReadiness(
    containerId: string,
    readinessProbeUrl: string,
  ): Promise<ReadinessProbeResult> {
    try {
      await this.execDocker([
        'exec',
        containerId,
        'sh',
        '-lc',
        `curl -fsS --max-time 2 ${this.shellEscape(readinessProbeUrl)} >/dev/null`,
      ]);
      await this.execDocker([
        'exec',
        containerId,
        'sh',
        '-lc',
        'if command -v supervisorctl >/dev/null 2>&1; then supervisorctl status >/dev/null; fi',
      ]);
      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private isNoSuchContainerMessage(message: string): boolean {
    return (
      message.includes('No such container') ||
      message.includes('no such container')
    );
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private async resolveImagePlatform(imageId: string): Promise<string | null> {
    if (!imageId) {
      return null;
    }

    try {
      const out = await this.execDockerCapture([
        'image',
        'inspect',
        imageId,
        '--format',
        '{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}',
      ]);
      const platform = out.trim().toLowerCase();
      return platform || null;
    } catch {
      return null;
    }
  }

  private async execDocker(args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('docker', args, { stdio: 'pipe' });
      let stderr = '';
      child.stderr?.on('data', (c: Buffer) => {
        stderr += c.toString();
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr.trim() || `docker exited ${code}`));
        }
      });
    });
  }

  private async execDockerCapture(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (c: Buffer) => {
        stdout += c.toString();
      });
      child.stderr?.on('data', (c: Buffer) => {
        stderr += c.toString();
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr.trim() || `docker exited ${code}`));
        }
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
