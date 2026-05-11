import { BadRequestException } from '@nestjs/common';
import { ProjectMcpOAuthService } from './project-mcp-oauth.service';
import { OAuthMcpProviderRegistry } from './oauth-providers/oauth-mcp-provider.registry';

describe('ProjectMcpOAuthService', () => {
  const currentUser = {
    sub: 'user-1',
    iat: 1,
    exp: 2,
  };

  const createService = (overrides?: {
    connectionRepo?: Record<string, jest.Mock>;
    sessionRepo?: Record<string, jest.Mock>;
    slotRepository?: Record<string, jest.Mock>;
    isolatedRunner?: Record<string, jest.Mock>;
  }) => {
    const projectAccessService = {
      assertCanAccessProject: jest.fn().mockResolvedValue({ id: 'project-1' }),
      assertCanManageProject: jest.fn().mockResolvedValue({ id: 'project-1' }),
    };
    const connectionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      create: jest.fn((value) => value),
      update: jest.fn().mockResolvedValue(undefined),
      ...(overrides?.connectionRepo ?? {}),
    };
    const sessionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      create: jest.fn((value) => value),
      update: jest.fn().mockResolvedValue(undefined),
      ...(overrides?.sessionRepo ?? {}),
    };
    const slotRepository = {
      findActiveWithContainerByProjectId: jest.fn().mockResolvedValue(null),
      ...(overrides?.slotRepository ?? {}),
    };
    const isolatedRunner = {
      inspect: jest.fn(),
      ...(overrides?.isolatedRunner ?? {}),
    };
    const containerConfig = {
      getRunnerWorkspace: jest.fn().mockReturnValue('/workspace'),
    };

    const service = new ProjectMcpOAuthService(
      projectAccessService as never,
      new OAuthMcpProviderRegistry(),
      slotRepository as never,
      isolatedRunner as never,
      containerConfig as never,
      connectionRepo as never,
      sessionRepo as never,
    );

    return {
      service,
      connectionRepo,
      sessionRepo,
      slotRepository,
      isolatedRunner,
    };
  };

  it('should list configured OAuth MCP providers with disconnected CLI states', async () => {
    const { service } = createService();

    const providers = await service.listProviders('project-1', currentUser);

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      provider: 'figma',
      displayName: 'Figma',
      status: 'disconnected',
    });
    expect(providers[0]?.cliStates.map((item) => item.cli).sort()).toEqual([
      'claude',
      'codex',
      'cursor',
    ]);
  });

  it('should reject login when no active runner container exists for the project', async () => {
    const { service } = createService();

    await expect(
      service.startLogin(
        'figma',
        {
          projectId: 'project-1',
          cli: 'codex',
        },
        currentUser,
      ),
    ).rejects.toThrow('当前项目没有可复用的运行中 Runner 容器');
  });

  it('should reject callback relay when OAuth state does not match the session', async () => {
    const { service } = createService({
      sessionRepo: {
        findOne: jest.fn().mockResolvedValue({
          id: 'session-1',
          projectId: 'project-1',
          provider: 'figma',
          cli: 'codex',
          state: 'expected-state',
          cliLoginPort: 37123,
          containerExecRef: 'container-1',
          status: 'pending',
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    });

    await expect(
      service.relayCallback(
        'figma',
        {
          projectId: 'project-1',
          sessionId: 'session-1',
          callbackUrl:
            'http://127.0.0.1:37123/callback?code=abc&state=other-state',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
