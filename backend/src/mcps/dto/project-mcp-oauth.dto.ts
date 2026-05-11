import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { OAuthMcpCli } from '../oauth-providers/oauth-mcp-provider.types';

export const OAUTH_MCP_CLI_VALUES: OAuthMcpCli[] = [
  'codex',
  'claude',
  'cursor',
];

export class ListProjectMcpOAuthProvidersDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;
}

export class StartProjectMcpOAuthLoginDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiProperty({ enum: OAUTH_MCP_CLI_VALUES })
  @IsIn(OAUTH_MCP_CLI_VALUES)
  cli: OAuthMcpCli;
}

export class RelayProjectMcpOAuthCallbackDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiProperty({ type: String })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ type: String })
  @IsString()
  callbackUrl: string;
}

export class ProjectMcpOAuthCliStateDto {
  @ApiProperty({ enum: OAUTH_MCP_CLI_VALUES })
  cli: OAuthMcpCli;

  @ApiProperty({ type: String })
  status: 'connected' | 'disconnected' | 'pending' | 'error';

  @ApiProperty({ type: String, required: false, nullable: true })
  lastLoginAt?: string | null;
}

export class ProjectMcpOAuthProviderDto {
  @ApiProperty({ type: String })
  provider: string;

  @ApiProperty({ type: String })
  displayName: string;

  @ApiProperty({ type: String })
  upstreamMcpUrl: string;

  @ApiProperty({ type: String })
  status: 'connected' | 'disconnected' | 'pending' | 'error';

  @ApiProperty({ type: String, required: false, nullable: true })
  hint?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  lastError?: string | null;

  @ApiProperty({ type: [ProjectMcpOAuthCliStateDto] })
  cliStates: ProjectMcpOAuthCliStateDto[];
}

export class ProjectMcpOAuthLoginSessionDto {
  @ApiProperty({ type: String })
  sessionId: string;

  @ApiProperty({ type: String })
  provider: string;

  @ApiProperty({ enum: OAUTH_MCP_CLI_VALUES })
  cli: OAuthMcpCli;

  @ApiProperty({ type: String })
  status: 'pending' | 'relayed' | 'succeeded' | 'failed' | 'timed_out';

  @ApiProperty({ type: String, required: false, nullable: true })
  authorizationUrl?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  errorMessage?: string | null;

  @ApiProperty({ type: String })
  expiresAt: string;
}

export class ProjectMcpOAuthRelayResultDto {
  @ApiProperty({ type: Boolean })
  ok: boolean;

  @ApiProperty({ type: String })
  status: 'relayed' | 'succeeded' | 'failed';

  @ApiProperty({ type: String, required: false, nullable: true })
  message?: string | null;
}

export class DisconnectProjectMcpOAuthProviderDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiProperty({ enum: OAUTH_MCP_CLI_VALUES, required: false })
  @IsOptional()
  @IsIn(OAUTH_MCP_CLI_VALUES)
  cli?: OAuthMcpCli;
}
