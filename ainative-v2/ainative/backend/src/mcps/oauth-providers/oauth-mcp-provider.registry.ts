import { Injectable, NotFoundException } from '@nestjs/common';
import {
  OAuthMcpCli,
  OAuthMcpProviderDefinition,
} from './oauth-mcp-provider.types';

const FIGMA_PROVIDER: OAuthMcpProviderDefinition = {
  provider: 'figma',
  displayName: 'Figma',
  upstreamMcpUrl: 'https://mcp.figma.com/mcp',
  enabledByDefault: true,
  cliLogin: {
    codex: {
      command: ['codex', 'mcp', 'login', 'figma'],
    },
    cursor: {
      command: ['/root/.local/bin/agent', 'mcp', 'login', 'figma'],
    },
  },
  cliLogout: {
    codex: ['codex', 'mcp', 'logout', 'figma'],
    cursor: ['/root/.local/bin/agent', 'mcp', 'logout', 'figma'],
  },
  statusHints: {
    disconnected:
      '授权后浏览器跳到 127.0.0.1 失败页是预期行为，请复制地址栏 URL 回到本页面完成登录。',
  },
};

@Injectable()
export class OAuthMcpProviderRegistry {
  private readonly providers = new Map<string, OAuthMcpProviderDefinition>(
    [FIGMA_PROVIDER].map((provider) => [provider.provider, provider]),
  );

  list(): OAuthMcpProviderDefinition[] {
    return Array.from(this.providers.values());
  }

  get(provider: string): OAuthMcpProviderDefinition {
    const key = provider.trim().toLowerCase();
    const definition = this.providers.get(key);
    if (!definition) {
      throw new NotFoundException('OAuth MCP provider not found');
    }
    return definition;
  }

  getLoginCommand(provider: string, cli: OAuthMcpCli): string[] {
    const definition = this.get(provider);
    const login = definition.cliLogin[cli];
    if (!login?.command?.length) {
      throw new NotFoundException('OAuth MCP CLI login is not supported');
    }
    return login.command;
  }

  getLogoutCommand(provider: string, cli: OAuthMcpCli): string[] | null {
    const definition = this.get(provider);
    const command = definition.cliLogout?.[cli] ?? null;
    return command?.length ? command : null;
  }
}
