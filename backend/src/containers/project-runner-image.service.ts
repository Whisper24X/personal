import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  mkdir,
  rm,
  writeFile,
  readFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Project } from '../projects/domain/project';
import { ContainerExecutionConfigService } from './container-execution-config.service';

export type ProjectRunnerTemplateConfig = {
  dockerfileRunner?: string;
  sandboxNginxConf?: string;
  sandboxSupervisordConf?: string;
};

type RunnerAssetBundle = {
  dockerfileRunner: string;
  sandboxNginxConf: string;
  sandboxSupervisordConf: string;
  entrypointSh: string;
  sshIdEd25519: string | null;
  sshKnownHosts: string | null;
};

@Injectable()
export class ProjectRunnerImageService {
  private readonly logger = new Logger(ProjectRunnerImageService.name);
  private readonly buildLocks = new Map<string, Promise<string>>();

  constructor(
    private readonly containerConfig: ContainerExecutionConfigService,
  ) {}

  async resolveRunnerImage(project?: Project | null): Promise<string> {
    const runnerAssets = await this.readRunnerAssetBundle();
    const runnerTemplate = this.resolveEffectiveRunnerTemplateConfig(
      project,
      runnerAssets,
    );
    if (!project?.id || !runnerTemplate) {
      return this.containerConfig.getRunnerImage();
    }

    const imageTag = this.buildProjectImageTag(
      project.id,
      runnerTemplate,
      runnerAssets,
    );
    const existingBuild = this.buildLocks.get(imageTag);
    if (existingBuild) {
      return existingBuild;
    }

    const buildPromise = this.ensureProjectRunnerImage(
      imageTag,
      runnerTemplate,
      runnerAssets,
    );
    this.buildLocks.set(imageTag, buildPromise);

    try {
      return await buildPromise;
    } finally {
      if (this.buildLocks.get(imageTag) === buildPromise) {
        this.buildLocks.delete(imageTag);
      }
    }
  }

  readProjectRunnerTemplateConfig(
    project?: Project | null,
  ): ProjectRunnerTemplateConfig | null {
    if (!project?.configJson || typeof project.configJson !== 'object') {
      return null;
    }

    const configJson = project.configJson as Record<string, unknown>;
    const rawTemplate = this.toObjectRecord(configJson.runnerTemplate);
    if (!rawTemplate) {
      return null;
    }

    const dockerfileRunner = this.readNonEmptyString(
      rawTemplate.dockerfileRunner,
    );
    const sandboxNginxConf = this.readNonEmptyString(
      rawTemplate.sandboxNginxConf,
    );
    const sandboxSupervisordConf = this.readNonEmptyString(
      rawTemplate.sandboxSupervisordConf,
    );

    if (!dockerfileRunner && !sandboxNginxConf && !sandboxSupervisordConf) {
      return null;
    }

    return {
      ...(dockerfileRunner ? { dockerfileRunner } : {}),
      ...(sandboxNginxConf ? { sandboxNginxConf } : {}),
      ...(sandboxSupervisordConf ? { sandboxSupervisordConf } : {}),
    };
  }

  private resolveEffectiveRunnerTemplateConfig(
    project?: Project | null,
    runnerAssets?: RunnerAssetBundle,
  ): ProjectRunnerTemplateConfig | null {
    const projectTemplate = this.readProjectRunnerTemplateConfig(project);
    if (!projectTemplate) {
      return null;
    }

    if (!runnerAssets) {
      throw new Error('Runner assets are required to resolve template config');
    }

    const defaultTemplate = runnerAssets;
    return {
      dockerfileRunner:
        projectTemplate.dockerfileRunner ?? defaultTemplate.dockerfileRunner,
      sandboxNginxConf:
        projectTemplate.sandboxNginxConf ?? defaultTemplate.sandboxNginxConf,
      sandboxSupervisordConf:
        projectTemplate.sandboxSupervisordConf ??
        defaultTemplate.sandboxSupervisordConf,
    };
  }

  private async ensureProjectRunnerImage(
    imageTag: string,
    runnerTemplate: ProjectRunnerTemplateConfig,
    runnerAssets: RunnerAssetBundle,
  ): Promise<string> {
    if (await this.dockerImageExists(imageTag)) {
      return imageTag;
    }

    const buildContext = await mkdtemp(
      path.join(tmpdir(), 'ainative-project-runner-'),
    );

    try {
      await this.populateBuildContext(
        buildContext,
        runnerTemplate,
        runnerAssets,
      );
      await this.execDockerBuild(buildContext, imageTag);
      return imageTag;
    } finally {
      await rm(buildContext, { recursive: true, force: true });
    }
  }

  private async populateBuildContext(
    buildContext: string,
    runnerTemplate: ProjectRunnerTemplateConfig,
    runnerAssets: RunnerAssetBundle,
  ): Promise<void> {
    const runnerDir = path.join(buildContext, 'backend', 'runner');
    await mkdir(path.join(runnerDir, 'ssh'), { recursive: true });

    await writeFile(
      path.join(runnerDir, 'Dockerfile.runner'),
      runnerTemplate.dockerfileRunner ?? '',
      'utf-8',
    );
    await writeFile(
      path.join(runnerDir, 'sandbox.nginx.conf'),
      runnerTemplate.sandboxNginxConf ?? '',
      'utf-8',
    );
    await writeFile(
      path.join(runnerDir, 'sandbox.supervisord.conf'),
      runnerTemplate.sandboxSupervisordConf ?? '',
      'utf-8',
    );
    await writeFile(
      path.join(runnerDir, 'entrypoint.sh'),
      runnerAssets.entrypointSh,
      'utf-8',
    );
    await chmod(path.join(runnerDir, 'entrypoint.sh'), 0o755);

    await this.writeOptionalFile(
      path.join(runnerDir, 'ssh', 'id_ed25519'),
      runnerAssets.sshIdEd25519,
    );
    await this.writeOptionalFile(
      path.join(runnerDir, 'ssh', 'known_hosts'),
      runnerAssets.sshKnownHosts,
    );
  }

  private resolveRunnerAssetSourceDir(): string {
    const candidateDirs = [
      path.resolve(process.cwd(), 'backend', 'runner'),
      path.resolve(process.cwd(), 'runner'),
      path.resolve(process.cwd(), '..', 'backend', 'runner'),
      path.resolve(__dirname, '..', '..', '..', 'backend', 'runner'),
      path.resolve(__dirname, '..', '..', '..', '..', 'backend', 'runner'),
    ];

    for (const candidate of candidateDirs) {
      if (existsSync(path.join(candidate, 'entrypoint.sh'))) {
        return candidate;
      }
    }

    throw new Error('Runner asset directory not found for project image build');
  }

  private async readRunnerAssetBundle(): Promise<RunnerAssetBundle> {
    const sourceRunnerDir = this.resolveRunnerAssetSourceDir();
    const [
      dockerfileRunner,
      sandboxNginxConf,
      sandboxSupervisordConf,
      entrypointSh,
      sshIdEd25519,
      sshKnownHosts,
    ] = await Promise.all([
      readFile(path.join(sourceRunnerDir, 'Dockerfile.runner'), 'utf-8'),
      readFile(path.join(sourceRunnerDir, 'sandbox.nginx.conf'), 'utf-8'),
      readFile(path.join(sourceRunnerDir, 'sandbox.supervisord.conf'), 'utf-8'),
      readFile(path.join(sourceRunnerDir, 'entrypoint.sh'), 'utf-8'),
      this.readOptionalFile(path.join(sourceRunnerDir, 'ssh', 'id_ed25519')),
      this.readOptionalFile(path.join(sourceRunnerDir, 'ssh', 'known_hosts')),
    ]);

    return {
      dockerfileRunner,
      sandboxNginxConf,
      sandboxSupervisordConf,
      entrypointSh,
      sshIdEd25519,
      sshKnownHosts,
    };
  }

  private async readOptionalFile(sourcePath: string): Promise<string | null> {
    try {
      return await readFile(sourcePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async writeOptionalFile(
    targetPath: string,
    content: string | null,
  ): Promise<void> {
    if (content === null) {
      return;
    }

    await writeFile(targetPath, content, 'utf-8');
  }

  private buildProjectImageTag(
    projectId: string,
    runnerTemplate: ProjectRunnerTemplateConfig,
    runnerAssets: RunnerAssetBundle,
  ): string {
    const hash = createHash('sha256')
      .update(runnerTemplate.dockerfileRunner ?? '')
      .update('\n--nginx--\n')
      .update(runnerTemplate.sandboxNginxConf ?? '')
      .update('\n--supervisord--\n')
      .update(runnerTemplate.sandboxSupervisordConf ?? '')
      .update('\n--entrypoint--\n')
      .update(runnerAssets.entrypointSh)
      .update('\n--ssh-id-ed25519--\n')
      .update(runnerAssets.sshIdEd25519 ?? '<missing>')
      .update('\n--ssh-known-hosts--\n')
      .update(runnerAssets.sshKnownHosts ?? '<missing>')
      .digest('hex')
      .slice(0, 20);

    const normalizedProjectId = projectId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-');

    return `ainative/runner-project-${normalizedProjectId}:${hash}`;
  }

  private async dockerImageExists(imageTag: string): Promise<boolean> {
    try {
      await this.execDocker(['image', 'inspect', imageTag]);
      return true;
    } catch {
      return false;
    }
  }

  private async execDockerBuild(
    buildContext: string,
    imageTag: string,
  ): Promise<void> {
    const args = [
      'build',
      '--progress=plain',
      '-f',
      path.join(buildContext, 'backend', 'runner', 'Dockerfile.runner'),
      '-t',
      imageTag,
      buildContext,
    ];
    this.logger.log(
      `build_project_runner_image ${JSON.stringify({
        imageTag,
        buildContext,
      })}`,
    );
    await this.execDocker(args);
  }

  private async execDocker(args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('docker', args, {
        stdio: 'pipe',
      });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        const detail = [stdout.trim(), stderr.trim()]
          .filter(Boolean)
          .join('\n');
        reject(
          new Error(
            detail || `docker ${args[0] ?? 'command'} exited with code ${code}`,
          ),
        );
      });
    });
  }

  private toObjectRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private readNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    return value.trim() ? value : null;
  }
}
