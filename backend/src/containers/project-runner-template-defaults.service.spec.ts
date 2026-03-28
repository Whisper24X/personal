import { ConfigService } from '@nestjs/config';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { ProjectRunnerTemplateDefaultsService } from './project-runner-template-defaults.service';

describe('ProjectRunnerTemplateDefaultsService', () => {
  const createService = (
    values: Record<string, string | undefined> = {},
  ): ProjectRunnerTemplateDefaultsService => {
    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new ProjectRunnerTemplateDefaultsService(
      new ContainerExecutionConfigService(configService),
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

  it('should generate repo-oriented defaults for preview-web', () => {
    const service = createService();

    const defaults = service.build(
      createProject({
        containerRuntime: {
          sandboxProfile: 'preview-web',
        },
      }) as never,
    );

    expect(defaults.dockerfileRunner).toContain('profile: preview-web');
    expect(defaults.sandboxNginxConf).toContain(
      'proxy_pass http://127.0.0.1:9000/',
    );
    expect(defaults.sandboxSupervisordConf).toContain('[program:frontend]');
  });

  it('should generate full-dev-sandbox defaults for full-dev-sandbox', () => {
    const service = createService();

    const defaults = service.build(
      createProject({
        containerRuntime: {
          sandboxProfile: 'full-dev-sandbox',
        },
      }) as never,
    );

    expect(defaults.dockerfileRunner).toContain('profile: full-dev-sandbox');
    expect(defaults.sandboxNginxConf).toContain('location /shadow/');
    expect(defaults.sandboxSupervisordConf).toContain('[program:shadow]');
  });
});
