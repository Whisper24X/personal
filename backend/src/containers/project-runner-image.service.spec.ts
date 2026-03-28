import { ConfigService } from '@nestjs/config';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ProjectRunnerImageService } from './project-runner-image.service';
import { ProjectRunnerTemplateDefaultsService } from './project-runner-template-defaults.service';

describe('ProjectRunnerImageService', () => {
  const originalRunnerAssetDir = process.env.AINATIVE_RUNNER_ASSET_DIR;
  const originalCwd = process.cwd();

  const createService = () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'AINATIVE_RUNNER_IMAGE') {
          return 'ainative/runner:latest';
        }
        return undefined;
      }),
    } as unknown as ConfigService;
    const containerConfig = new ContainerExecutionConfigService(configService);
    const runnerTemplateDefaults = new ProjectRunnerTemplateDefaultsService(
      containerConfig,
    );

    return new ProjectRunnerImageService(
      containerConfig,
      runnerTemplateDefaults,
    );
  };

  const createProject = (configJson?: Record<string, unknown>) => ({
    id: 'project-1',
    businessLineId: 'business-line-1',
    name: 'AINative Web',
    description: null,
    gitUrl: 'git@example.com:ainative/web.git',
    defaultBranch: 'main',
    configJson: configJson ?? null,
    createdAt: new Date('2026-03-27T10:00:00.000Z'),
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    deletedAt: null,
  });

  afterEach(() => {
    if (originalRunnerAssetDir === undefined) {
      delete process.env.AINATIVE_RUNNER_ASSET_DIR;
    } else {
      process.env.AINATIVE_RUNNER_ASSET_DIR = originalRunnerAssetDir;
    }
    process.chdir(originalCwd);
  });

  it('should fall back to the global runner image when template config is absent', async () => {
    const service = createService();

    await expect(service.resolveRunnerImage()).resolves.toBe(
      'ainative/runner:latest',
    );
  });

  it('should read project runner template overrides when any template field is present', () => {
    const service = createService();

    expect(
      service.readProjectRunnerTemplateConfig(
        createProject({
          runnerTemplate: {
            dockerfileRunner: 'FROM node:20',
            sandboxNginxConf: 'events {}',
          },
        }) as never,
      ),
    ).toEqual({
      dockerfileRunner: 'FROM node:20',
      sandboxNginxConf: 'events {}',
    });
  });

  it('should build and cache a project runner image tag from runner templates', async () => {
    const service = createService();
    jest.spyOn(service as any, 'readRunnerAssetBundle').mockResolvedValue({
      dockerfileRunner: 'FROM node:20',
      sandboxNginxConf: 'events {}',
      sandboxSupervisordConf: '[supervisord]',
      entrypointSh: '#!/bin/sh\nexit 0\n',
      sshIdEd25519: null,
      sshKnownHosts: null,
    });
    const ensureProjectRunnerImage = jest
      .spyOn(service as any, 'ensureProjectRunnerImage')
      .mockImplementation((imageTag: string) => Promise.resolve(imageTag));

    const project = createProject({
      runnerTemplate: {
        sandboxNginxConf: 'events { worker_connections 1024; }',
      },
    });

    const firstImage = await service.resolveRunnerImage(project as never);
    const secondImage = await service.resolveRunnerImage(project as never);

    expect(firstImage).toMatch(/^ainative\/runner-project-project-1:/);
    expect(secondImage).toBe(firstImage);
    expect(ensureProjectRunnerImage).toHaveBeenCalledTimes(2);
  });

  it('should include bundled runner assets in the image tag fingerprint', async () => {
    const service = createService();
    const ensureProjectRunnerImage = jest
      .spyOn(service as any, 'ensureProjectRunnerImage')
      .mockImplementation((imageTag: string) => Promise.resolve(imageTag));
    const readRunnerAssetBundle = jest
      .spyOn(service as any, 'readRunnerAssetBundle')
      .mockResolvedValueOnce({
        dockerfileRunner: 'FROM node:20',
        sandboxNginxConf: 'events {}',
        sandboxSupervisordConf: '[supervisord]',
        entrypointSh: '#!/bin/sh\necho first\n',
        sshIdEd25519: null,
        sshKnownHosts: null,
      })
      .mockResolvedValueOnce({
        dockerfileRunner: 'FROM node:20',
        sandboxNginxConf: 'events {}',
        sandboxSupervisordConf: '[supervisord]',
        entrypointSh: '#!/bin/sh\necho second\n',
        sshIdEd25519: null,
        sshKnownHosts: null,
      });

    const project = createProject({
      runnerTemplate: {
        sandboxNginxConf: 'events { worker_connections 1024; }',
      },
    });

    const firstImage = await service.resolveRunnerImage(project as never);
    const secondImage = await service.resolveRunnerImage(project as never);

    expect(firstImage).not.toBe(secondImage);
    expect(readRunnerAssetBundle).toHaveBeenCalledTimes(2);
    expect(ensureProjectRunnerImage).toHaveBeenCalledTimes(2);
  });

  it('should build a project image when sandboxProfile changes generated defaults', async () => {
    const service = createService();
    jest.spyOn(service as any, 'readRunnerAssetBundle').mockResolvedValue({
      dockerfileRunner: 'FROM node:20 # preview-web',
      sandboxNginxConf: '# preview-web nginx',
      sandboxSupervisordConf: '# preview-web supervisord',
      entrypointSh: '#!/bin/sh\nexit 0\n',
      sshIdEd25519: null,
      sshKnownHosts: null,
    });
    const ensureProjectRunnerImage = jest
      .spyOn(service as any, 'ensureProjectRunnerImage')
      .mockImplementation((imageTag: string) => Promise.resolve(imageTag));

    const project = createProject({
      containerRuntime: {
        sandboxProfile: 'preview-web',
      },
    });

    const image = await service.resolveRunnerImage(project as never);

    expect(image).toMatch(/^ainative\/runner-project-project-1:/);
    expect(ensureProjectRunnerImage).toHaveBeenCalledTimes(1);
  });

  it('should fall back to the global image when generated defaults match the global profile', async () => {
    const service = createService();
    const readRunnerAssetBundle = jest.spyOn(
      service as any,
      'readRunnerAssetBundle',
    );

    const project = createProject({
      containerRuntime: {
        sandboxProfile: 'runner-only',
      },
    });

    await expect(service.resolveRunnerImage(project as never)).resolves.toBe(
      'ainative/runner:latest',
    );
    expect(readRunnerAssetBundle).not.toHaveBeenCalled();
  });

  it('should build project images without requiring buildx-only progress flags', async () => {
    const service = createService();
    const execDocker = jest
      .spyOn(service as any, 'execDocker')
      .mockResolvedValue(undefined);

    await (service as any).execDockerBuild(
      '/tmp/project-runner-build',
      'ainative/test:tag',
    );

    expect(execDocker).toHaveBeenCalledWith([
      'build',
      '-f',
      '/tmp/project-runner-build/backend/runner/Dockerfile.runner',
      '-t',
      'ainative/test:tag',
      '/tmp/project-runner-build',
    ]);
  });

  it('should prefer the configured runner asset directory when provided', async () => {
    const service = createService();
    const configuredRoot = await mkdtemp(
      path.join(tmpdir(), 'runner-assets-configured-'),
    );
    const cwdRoot = await mkdtemp(path.join(tmpdir(), 'runner-assets-cwd-'));

    try {
      const configuredRunnerDir = path.join(configuredRoot, 'runner-assets');
      const cwdRunnerDir = path.join(cwdRoot, 'backend', 'runner');

      await mkdir(configuredRunnerDir, { recursive: true });
      await mkdir(cwdRunnerDir, { recursive: true });
      await writeFile(
        path.join(configuredRunnerDir, 'entrypoint.sh'),
        '#!/bin/sh\necho configured\n',
        'utf-8',
      );
      await writeFile(
        path.join(cwdRunnerDir, 'entrypoint.sh'),
        '#!/bin/sh\necho cwd\n',
        'utf-8',
      );

      process.env.AINATIVE_RUNNER_ASSET_DIR = configuredRunnerDir;
      process.chdir(cwdRoot);

      const runnerAssets = await (service as any).readRunnerAssetBundle({
        dockerfileRunner: 'FROM node:20',
        sandboxNginxConf: 'events {}',
        sandboxSupervisordConf: '[supervisord]',
      });

      expect(runnerAssets.entrypointSh).toContain('configured');
    } finally {
      await rm(configuredRoot, { recursive: true, force: true });
      await rm(cwdRoot, { recursive: true, force: true });
    }
  });

  it('should fall back to repo-style runner assets from the current working directory', async () => {
    const service = createService();
    const cwdRoot = await mkdtemp(
      path.join(tmpdir(), 'runner-assets-fallback-'),
    );

    try {
      const cwdRunnerDir = path.join(cwdRoot, 'backend', 'runner');
      await mkdir(path.join(cwdRunnerDir, 'ssh'), { recursive: true });
      await writeFile(
        path.join(cwdRunnerDir, 'entrypoint.sh'),
        '#!/bin/sh\necho cwd-fallback\n',
        'utf-8',
      );
      await writeFile(
        path.join(cwdRunnerDir, 'ssh', 'known_hosts'),
        'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA\n',
        'utf-8',
      );

      delete process.env.AINATIVE_RUNNER_ASSET_DIR;
      process.chdir(cwdRoot);

      const runnerAssets = await (service as any).readRunnerAssetBundle({
        dockerfileRunner: 'FROM node:20',
        sandboxNginxConf: 'events {}',
        sandboxSupervisordConf: '[supervisord]',
      });

      expect(runnerAssets.entrypointSh).toContain('cwd-fallback');
      expect(runnerAssets.sshKnownHosts).toContain('github.com');
      expect(runnerAssets.sshIdEd25519).toBeNull();
    } finally {
      await rm(cwdRoot, { recursive: true, force: true });
    }
  });
});
