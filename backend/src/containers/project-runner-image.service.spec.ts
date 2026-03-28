import { ConfigService } from '@nestjs/config';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ProjectRunnerImageService } from './project-runner-image.service';
import { ProjectRunnerTemplateDefaultsService } from './project-runner-template-defaults.service';

describe('ProjectRunnerImageService', () => {
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
});
