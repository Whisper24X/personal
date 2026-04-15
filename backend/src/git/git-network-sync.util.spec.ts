import {
  buildGitNetworkHttpConfigArgs,
  computeGitRetryBackoffMs,
  isGitNetworkErrorRetriable,
  mergeGitNetworkSpawnEnv,
  mergeGitOutput,
} from './git-network-sync.util';

describe('mergeGitOutput', () => {
  it('should join stderr and stdout', () => {
    expect(mergeGitOutput({ stderr: 'fatal: a', stdout: 'hint: b' })).toBe(
      'fatal: a\nhint: b',
    );
  });

  it('should omit empty parts', () => {
    expect(mergeGitOutput({ stderr: '', stdout: 'only' })).toBe('only');
  });
});

describe('isGitNetworkErrorRetriable', () => {
  it('should return true for early EOF', () => {
    expect(
      isGitNetworkErrorRetriable('fatal: early EOF\nfatal: fetch-pack failed'),
    ).toBe(true);
  });

  it('should return true for RPC failed', () => {
    expect(isGitNetworkErrorRetriable('error: RPC failed; HTTP 502')).toBe(
      true,
    );
  });

  it('should return false for authentication failures', () => {
    expect(
      isGitNetworkErrorRetriable(
        'remote: HTTP Basic: Access denied\nfatal: Authentication failed',
      ),
    ).toBe(false);
  });

  it('should return false for publickey permission denied', () => {
    expect(
      isGitNetworkErrorRetriable(
        'git@host: Permission denied (publickey).\r\nfatal: Could not read from remote repository.',
      ),
    ).toBe(false);
  });
});

describe('mergeGitNetworkSpawnEnv', () => {
  it('should set GIT_SSH_COMMAND when unset', () => {
    const { GIT_SSH_COMMAND, ...rest } = mergeGitNetworkSpawnEnv({
      ...process.env,
      GIT_SSH_COMMAND: '',
    });

    expect(GIT_SSH_COMMAND).toContain('ServerAliveInterval');
    expect(rest).toBeDefined();
  });

  it('should not override existing GIT_SSH_COMMAND', () => {
    const env = mergeGitNetworkSpawnEnv({
      ...process.env,
      GIT_SSH_COMMAND: 'ssh -F /tmp/cfg',
    });

    expect(env.GIT_SSH_COMMAND).toBe('ssh -F /tmp/cfg');
  });
});

describe('buildGitNetworkHttpConfigArgs', () => {
  it('should include postBuffer and optional HTTP/1.1', () => {
    expect(buildGitNetworkHttpConfigArgs({ useHttp11: false })).toEqual([
      '-c',
      'http.postBuffer=524288000',
    ]);

    expect(buildGitNetworkHttpConfigArgs({ useHttp11: true })).toEqual([
      '-c',
      'http.postBuffer=524288000',
      '-c',
      'http.version=HTTP/1.1',
    ]);
  });
});

describe('computeGitRetryBackoffMs', () => {
  it('should cap exponential backoff', () => {
    expect(computeGitRetryBackoffMs(0)).toBe(500);
    expect(computeGitRetryBackoffMs(1)).toBe(1000);
    expect(computeGitRetryBackoffMs(10)).toBe(8000);
  });
});
