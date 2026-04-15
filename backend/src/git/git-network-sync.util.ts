/**
 * Helpers for resilient git clone/fetch over flaky networks (early EOF, RPC failures, etc.).
 */

const DEFAULT_GIT_SSH_COMMAND =
  'ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=6';

/** Substrings that suggest a transient transport error (case-insensitive). */
const RETRIABLE_GIT_NETWORK_FRAGMENTS: readonly string[] = [
  'early eof',
  'rpc failed',
  'connection reset',
  'connection aborted',
  'broken pipe',
  'the remote end hung up unexpectedly',
  'empty reply',
  'ssl error',
  'ssl: ',
  'errno 10054',
  'errno 10053',
  'timed out',
  'operation timed out',
  'could not resolve host',
  'network is unreachable',
  'temporary failure in name resolution',
  'no route to host',
];

/** Substrings that suggest auth/config issues — do not retry blindly. */
const NON_RETRIABLE_GIT_FRAGMENTS: readonly string[] = [
  'authentication failed',
  'access denied',
  'permission denied (publickey)',
  'repository not found',
  'invalid username or password',
  'http 401',
  'http 403',
  'could not read username',
  'could not read password',
];

export function mergeGitOutput(result: {
  stdout: string;
  stderr: string;
}): string {
  const parts = [result.stderr, result.stdout].filter(
    (line) => line.trim().length > 0,
  );

  return parts.join('\n').trim();
}

export function isGitNetworkErrorRetriable(combinedOutput: string): boolean {
  const lower = combinedOutput.toLowerCase();

  if (
    NON_RETRIABLE_GIT_FRAGMENTS.some((fragment) => lower.includes(fragment))
  ) {
    return false;
  }

  return RETRIABLE_GIT_NETWORK_FRAGMENTS.some((fragment) =>
    lower.includes(fragment),
  );
}

export function mergeGitNetworkSpawnEnv(
  baseEnv: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  if (baseEnv.GIT_SSH_COMMAND?.trim()) {
    return baseEnv;
  }

  return {
    ...baseEnv,
    GIT_SSH_COMMAND: DEFAULT_GIT_SSH_COMMAND,
  };
}

export function buildGitNetworkHttpConfigArgs(options: {
  useHttp11: boolean;
}): string[] {
  const args = ['-c', 'http.postBuffer=524288000'];

  if (options.useHttp11) {
    args.push('-c', 'http.version=HTTP/1.1');
  }

  return args;
}

export function computeGitRetryBackoffMs(attemptIndex: number): number {
  const base = 500;
  const cap = 8_000;

  return Math.min(cap, base * 2 ** attemptIndex);
}
