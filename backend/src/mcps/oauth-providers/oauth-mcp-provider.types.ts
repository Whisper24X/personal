export type OAuthMcpCli = 'codex' | 'claude' | 'cursor';

export type OAuthMcpCliLoginDefinition = {
  command: string[];
};

export type OAuthMcpProviderDefinition = {
  provider: string;
  displayName: string;
  upstreamMcpUrl: string;
  cliLogin: Partial<Record<OAuthMcpCli, OAuthMcpCliLoginDefinition>>;
  cliLogout?: Partial<Record<OAuthMcpCli, string[]>>;
  enabledByDefault?: boolean;
  statusHints?: {
    disconnected?: string;
    expired?: string;
  };
};

export const OAUTH_MCP_CLI_LABELS: Record<OAuthMcpCli, string> = {
  codex: 'Codex',
  claude: 'Claude Code',
  cursor: 'Cursor',
};
