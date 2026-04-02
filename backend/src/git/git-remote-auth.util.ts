type GitRemoteHttpAuthOptions = {
  targetHost: string;
  username?: string | null;
  token?: string | null;
};

type ParsedGitSshRemote = {
  host: string;
  repositoryPath: string;
};

const SCP_LIKE_SSH_REMOTE_PATTERN =
  /^(?<user>[^@]+)@(?<host>[^:/]+):(?<repositoryPath>.+)$/;
const SSH_REMOTE_URL_PATTERN =
  /^ssh:\/\/(?:(?<user>[^@/]+)@)?(?<host>[^/]+)\/(?<repositoryPath>.+)$/i;

export function resolveGitRemoteUrlWithHttpAuth(
  remoteUrl: string,
  options: GitRemoteHttpAuthOptions,
): string {
  const trimmedRemoteUrl = remoteUrl.trim();
  if (!trimmedRemoteUrl) {
    return trimmedRemoteUrl;
  }

  const token = options.token?.trim();
  if (!token) {
    return trimmedRemoteUrl;
  }

  const targetHost = options.targetHost.trim().toLowerCase();
  if (!targetHost) {
    return trimmedRemoteUrl;
  }

  const parsedRemote = parseGitSshRemote(trimmedRemoteUrl);
  if (!parsedRemote || parsedRemote.host.toLowerCase() !== targetHost) {
    return trimmedRemoteUrl;
  }

  const username = options.username?.trim() || 'oauth2';
  const encodedUsername = encodeURIComponent(username);
  const encodedToken = encodeURIComponent(token);

  return `https://${encodedUsername}:${encodedToken}@${parsedRemote.host}/${parsedRemote.repositoryPath}`;
}

function parseGitSshRemote(remoteUrl: string): ParsedGitSshRemote | null {
  const scpLikeMatch = remoteUrl.match(SCP_LIKE_SSH_REMOTE_PATTERN);
  if (scpLikeMatch?.groups) {
    return normalizeParsedRemote(
      scpLikeMatch.groups.host,
      scpLikeMatch.groups.repositoryPath,
    );
  }

  const sshUrlMatch = remoteUrl.match(SSH_REMOTE_URL_PATTERN);
  if (sshUrlMatch?.groups) {
    return normalizeParsedRemote(
      sshUrlMatch.groups.host,
      sshUrlMatch.groups.repositoryPath,
    );
  }

  return null;
}

function normalizeParsedRemote(
  host: string,
  repositoryPath: string,
): ParsedGitSshRemote | null {
  const normalizedHost = host.trim();
  const normalizedRepositoryPath = repositoryPath.trim().replace(/^\/+/, '');

  if (!normalizedHost || !normalizedRepositoryPath) {
    return null;
  }

  return {
    host: normalizedHost,
    repositoryPath: normalizedRepositoryPath,
  };
}
