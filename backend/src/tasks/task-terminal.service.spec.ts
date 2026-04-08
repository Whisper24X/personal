import { ConflictException } from '@nestjs/common';
import * as pty from 'node-pty';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { ContainerOrchestrationService } from '../containers/container-orchestration.service';
import { TaskTerminalService } from './task-terminal.service';

jest.mock('node-pty', () => ({
  spawn: jest.fn(),
}));

describe('TaskTerminalService', () => {
  const createService = ({
    inspectTaskContainer = jest.fn(),
    getRunnerWorkspace = jest.fn().mockReturnValue('/workspace'),
    assertCanAccessTaskProject = jest.fn(),
  }: {
    inspectTaskContainer?: jest.Mock;
    getRunnerWorkspace?: jest.Mock;
    assertCanAccessTaskProject?: jest.Mock;
  } = {}) => {
    const tasksService = {
      assertCanAccessTaskProject,
      assertCanAccessTask: jest.fn(),
    } as never;
    const containerOrchestration = {
      inspectTaskContainer,
    } as unknown as ContainerOrchestrationService;
    const containerExecutionConfig = {
      getRunnerWorkspace,
    } as unknown as ContainerExecutionConfigService;

    const service = new TaskTerminalService(
      tasksService,
      containerOrchestration,
      containerExecutionConfig,
    );

    return {
      service,
      tasksService,
      inspectTaskContainer,
      getRunnerWorkspace,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should remove npm-injected variables from terminal env', () => {
    const { service } = createService();
    const buildTerminalEnv = (service as any).buildTerminalEnv.bind(
      service,
    ) as (env: NodeJS.ProcessEnv) => Record<string, string>;

    const terminalEnv = buildTerminalEnv({
      PATH: '/usr/bin:/bin',
      HOME: '/Users/fuzhifei',
      LANG: 'en_US.UTF-8',
      CUSTOM_FLAG: 'enabled',
      npm_config_prefix:
        '/Users/fuzhifei/code/go/src/gitlab.yc345.tv/frontend/ainative/backend',
      npm_package_json:
        '/Users/fuzhifei/code/go/src/gitlab.yc345.tv/frontend/ainative/backend/package.json',
      npm_execpath: '/opt/homebrew/bin/npm',
      INIT_CWD:
        '/Users/fuzhifei/code/go/src/gitlab.yc345.tv/frontend/ainative/backend',
      NPM_CONFIG_USERCONFIG: '/Users/fuzhifei/.npmrc',
      EMPTY_VALUE: undefined,
    });

    expect(terminalEnv).toEqual({
      PATH: '/usr/bin:/bin',
      HOME: '/Users/fuzhifei',
      LANG: 'en_US.UTF-8',
      CUSTOM_FLAG: 'enabled',
    });
  });

  it('should spawn docker exec into the running task container', async () => {
    const fakePtyProcess = {
      onData: jest.fn(),
      onExit: jest.fn(),
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn(),
    };
    const spawnMock = jest
      .mocked(pty.spawn)
      .mockReturnValue(fakePtyProcess as any);
    const assertCanAccessTaskProject = jest.fn().mockResolvedValue({
      task: {
        id: 'task-1',
        projectId: 'project-1',
      },
      project: {
        id: 'project-1',
      },
    });
    const { service, inspectTaskContainer } = createService({
      assertCanAccessTaskProject,
      inspectTaskContainer: jest.fn().mockResolvedValue({
        containerId: 'container-1',
        running: true,
        accessMetadata: null,
      }),
    });

    const session = await service.createSession(
      'task-1',
      {
        shell: '/bin/bash',
        cols: 120,
        rows: 40,
      },
      { id: 'user-1' } as any,
    );

    expect(assertCanAccessTaskProject).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ id: 'user-1' }),
    );
    expect(inspectTaskContainer).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: 'task-1' }),
      project: expect.objectContaining({ id: 'project-1' }),
    });
    expect(spawnMock).toHaveBeenCalledWith(
      'docker',
      [
        'exec',
        '-it',
        '-w',
        '/workspace',
        '-e',
        'TERM=xterm-256color',
        'container-1',
        '/bin/bash',
      ],
      expect.objectContaining({
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: process.cwd(),
      }),
    );
    expect(session.cwd).toBe('/workspace');
    expect(session.shell).toBe('/bin/bash');
    expect(session.status).toBe('running');
  });

  it('should reject terminal sessions when the task container is not running', async () => {
    const spawnMock = jest.mocked(pty.spawn);
    const { service } = createService({
      assertCanAccessTaskProject: jest.fn().mockResolvedValue({
        task: {
          id: 'task-1',
          projectId: 'project-1',
        },
        project: {
          id: 'project-1',
        },
      }),
      inspectTaskContainer: jest.fn().mockResolvedValue({
        containerId: 'container-1',
        running: false,
        accessMetadata: null,
      }),
    });

    await expect(
      service.createSession(
        'task-1',
        {
          shell: '/bin/bash',
        },
        { id: 'user-1' } as any,
      ),
    ).rejects.toThrow(new ConflictException('执行环境未就绪，请先启动环境'));
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
