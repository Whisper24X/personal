import { TaskTerminalService } from './task-terminal.service';

describe('TaskTerminalService', () => {
  it('should remove npm-injected variables from terminal env', () => {
    const service = new TaskTerminalService({} as never, {} as never);
    const buildTerminalEnv = (service as any).buildTerminalEnv.bind(service) as (
      env: NodeJS.ProcessEnv,
    ) => Record<string, string>;

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
});
