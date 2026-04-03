import { resolveGitRemoteUrlWithHttpAuth } from './git-remote-auth.util';

describe('resolveGitRemoteUrlWithHttpAuth', () => {
  const targetHost = 'gitlab.yc345.tv';

  it('should convert scp-like gitlab ssh remote to https with oauth token auth', () => {
    expect(
      resolveGitRemoteUrlWithHttpAuth(
        'git@gitlab.yc345.tv:frontend/yanxue-main.git',
        {
          targetHost,
          username: 'oauth2',
          token: 'token-value',
        },
      ),
    ).toBe(
      'https://oauth2:token-value@gitlab.yc345.tv/frontend/yanxue-main.git',
    );
  });

  it('should convert ssh url format for the configured host', () => {
    expect(
      resolveGitRemoteUrlWithHttpAuth(
        'ssh://git@gitlab.yc345.tv/frontend/yanxue-main.git',
        {
          targetHost,
          username: 'oauth2',
          token: 'token-value',
        },
      ),
    ).toBe(
      'https://oauth2:token-value@gitlab.yc345.tv/frontend/yanxue-main.git',
    );
  });

  it('should keep the original remote when token is missing', () => {
    expect(
      resolveGitRemoteUrlWithHttpAuth(
        'git@gitlab.yc345.tv:frontend/yanxue-main.git',
        {
          targetHost,
          username: 'oauth2',
        },
      ),
    ).toBe('git@gitlab.yc345.tv:frontend/yanxue-main.git');
  });

  it('should keep other hosts unchanged', () => {
    expect(
      resolveGitRemoteUrlWithHttpAuth('git@example.com:group/repo.git', {
        targetHost,
        username: 'oauth2',
        token: 'token-value',
      }),
    ).toBe('git@example.com:group/repo.git');
  });
});
