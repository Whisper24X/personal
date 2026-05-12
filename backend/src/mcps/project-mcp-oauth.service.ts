import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChildProcess, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { Repository } from 'typeorm';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { IsolatedRunnerContainerService } from '../containers/isolated-runner-container.service';
import { ProjectExecutionSlotRepository } from '../containers/infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  DisconnectProjectMcpOAuthProviderDto,
  ProjectMcpOAuthCliStateDto,
  ProjectMcpOAuthLoginSessionDto,
  ProjectMcpOAuthProviderDto,
  ProjectMcpOAuthRelayResultDto,
  RelayProjectMcpOAuthCallbackDto,
  StartProjectMcpOAuthLoginDto,
} from './dto/project-mcp-oauth.dto';
import {
  ProjectMcpOAuthConnectionEntity,
  ProjectMcpOAuthConnectionStatus,
} from './infrastructure/persistence/relational/entities/project-mcp-oauth-connection.entity';
import {
  ProjectMcpOAuthSessionEntity,
  ProjectMcpOAuthSessionStatus,
} from './infrastructure/persistence/relational/entities/project-mcp-oauth-session.entity';
import { OAuthMcpCli } from './oauth-providers/oauth-mcp-provider.types';
import { OAuthMcpProviderRegistry } from './oauth-providers/oauth-mcp-provider.registry';

const execFileAsync = promisify(execFile);
const SESSION_TTL_MS = 5 * 60 * 1000;
const LOGIN_URL_TIMEOUT_MS = 30_000;
const RELAY_WAIT_MS = 15_000;

type ActiveLoginProcess = {
  child: ChildProcess;
  stdout: string;
  stderr: string;
};

type CliRegistry = Record<
  OAuthMcpCli,
  {
    status: ProjectMcpOAuthConnectionStatus;
    lastLoginAt?: string | null;
  }
>;

@Injectable()
export class ProjectMcpOAuthService {
  private readonly logger = new Logger(ProjectMcpOAuthService.name);
  private readonly activeLogins = new Map<string, ActiveLoginProcess>();

  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly providerRegistry: OAuthMcpProviderRegistry,
    private readonly slotRepository: ProjectExecutionSlotRepository,
    private readonly isolatedRunner: IsolatedRunnerContainerService,
    private readonly containerConfig: ContainerExecutionConfigService,
    @InjectRepository(ProjectMcpOAuthConnectionEntity)
    private readonly connectionRepo: Repository<ProjectMcpOAuthConnectionEntity>,
    @InjectRepository(ProjectMcpOAuthSessionEntity)
    private readonly sessionRepo: Repository<ProjectMcpOAuthSessionEntity>,
  ) {}

  async listProviders(
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<ProjectMcpOAuthProviderDto[]> {
    const project = await this.projectAccessService.assertCanAccessProject(
      projectId,
      currentUser,
    );
    const connections = await this.connectionRepo.find({
      where: { projectId: project.id },
    });
    const byProvider = new Map(
      connections.map((item) => [item.provider, item]),
    );

    return this.providerRegistry.list().map((definition) => {
      const connection = byProvider.get(definition.provider);
      const cliStates = Object.keys(definition.cliLogin).map((cli) =>
        this.toCliState(
          cli as OAuthMcpCli,
          connection?.cliRegistry as Partial<CliRegistry> | null | undefined,
        ),
      );

      return {
        provider: definition.provider,
        displayName: definition.displayName,
        upstreamMcpUrl: definition.upstreamMcpUrl,
        status: connection?.status ?? 'disconnected',
        hint:
          connection?.status === 'error'
            ? connection.lastError
            : (definition.statusHints?.disconnected ?? null),
        lastError: connection?.lastError ?? null,
        cliStates,
      };
    });
  }

  async startLogin(
    provider: string,
    dto: StartProjectMcpOAuthLoginDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectMcpOAuthLoginSessionDto> {
    const project = await this.projectAccessService.assertCanManageProject(
      dto.projectId,
      currentUser,
    );
    const definition = this.providerRegistry.get(provider);
    const command = this.providerRegistry.getLoginCommand(provider, dto.cli);
    const slot = await this.slotRepository.findActiveWithContainerByProjectId(
      project.id,
    );
    if (!slot?.containerId) {
      throw new BadRequestException(
        '当前项目没有可复用的运行中 Runner 容器，请先启动一次任务后再授权 OAuth MCP。',
      );
    }

    const inspection = await this.isolatedRunner.inspect(slot.containerId);
    if (!inspection?.running) {
      throw new BadRequestException(
        '当前项目 Runner 容器未运行，请先启动一次任务后再授权 OAuth MCP。',
      );
    }

    const connection = await this.upsertConnection(
      project.id,
      definition.provider,
      {
        status: 'pending',
        credentialVolumeRef: this.buildCredentialVolumeName(project.id),
        authorizedByUserId: currentUser.sub,
        lastError: null,
        cli: dto.cli,
        cliStatus: 'pending',
      },
    );

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        projectId: project.id,
        provider: definition.provider,
        cli: dto.cli,
        containerExecRef: slot.containerId,
        status: 'pending',
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      }),
    );

    try {
      await this.prepareLoginConfig({
        containerRef: slot.containerId,
        cli: dto.cli,
        provider: definition.provider,
        upstreamMcpUrl: definition.upstreamMcpUrl,
      });
      const active = this.spawnLoginProcess({
        containerRef: slot.containerId,
        command,
      });
      this.activeLogins.set(session.id, active);
      const authorizationUrl = await this.waitForAuthorizationUrl(
        session.id,
        active,
      );
      if (!authorizationUrl) {
        this.activeLogins.delete(session.id);
        const updated = await this.sessionRepo.save({
          ...session,
          status: 'succeeded',
          errorMessage: null,
        });
        await this.upsertConnection(project.id, definition.provider, {
          status: 'connected',
          credentialVolumeRef: this.buildCredentialVolumeName(project.id),
          lastError: null,
          cli: dto.cli,
          cliStatus: 'connected',
          cliLastLoginAt: new Date().toISOString(),
        });
        return this.toSessionDto(updated);
      }

      const parsed = this.parseAuthorizationUrl(authorizationUrl);
      const updated = await this.sessionRepo.save({
        ...session,
        authorizationUrl,
        state: parsed.state,
        cliLoginPort: parsed.callbackPort,
      });

      this.attachLoginExitHandler({
        sessionId: updated.id,
        provider: definition.provider,
        projectId: project.id,
        cli: dto.cli,
      });

      return this.toSessionDto(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.sessionRepo.update(
        { id: session.id },
        { status: 'failed', errorMessage: message },
      );
      await this.markConnectionError(connection, dto.cli, message);
      this.killActiveLogin(session.id);
      throw error;
    }
  }

  async relayCallback(
    provider: string,
    dto: RelayProjectMcpOAuthCallbackDto,
    currentUser: JwtPayloadType,
  ): Promise<ProjectMcpOAuthRelayResultDto> {
    const project = await this.projectAccessService.assertCanManageProject(
      dto.projectId,
      currentUser,
    );
    this.providerRegistry.get(provider);
    const session = await this.sessionRepo.findOne({
      where: {
        id: dto.sessionId,
        projectId: project.id,
        provider: provider.trim().toLowerCase(),
      },
    });
    if (!session) {
      throw new NotFoundException('OAuth MCP login session not found');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.sessionRepo.update(
        { id: session.id },
        { status: 'timed_out', errorMessage: 'OAuth login session expired' },
      );
      this.killActiveLogin(session.id);
      throw new BadRequestException('OAuth login session expired');
    }

    const callback = this.parseCallbackUrl(dto.callbackUrl);
    if (session.state && callback.state !== session.state) {
      throw new BadRequestException('OAuth callback state does not match');
    }
    if (session.cliLoginPort && callback.port !== session.cliLoginPort) {
      throw new BadRequestException('OAuth callback port does not match');
    }

    await this.sessionRepo.update({ id: session.id }, { status: 'relayed' });

    const relayedUrl = this.buildContainerCallbackUrl(dto.callbackUrl);
    await execFileAsync(
      'docker',
      ['exec', session.containerExecRef, 'curl', '-fsS', relayedUrl],
      { timeout: 20_000 },
    );

    const finalStatus = await this.waitForLoginCompletion(session.id);
    const latest = await this.sessionRepo.findOne({
      where: { id: session.id },
    });
    return {
      ok: finalStatus === 'succeeded' || finalStatus === 'relayed',
      status: finalStatus,
      message: latest?.errorMessage ?? null,
    };
  }

  async disconnect(
    provider: string,
    dto: DisconnectProjectMcpOAuthProviderDto,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const project = await this.projectAccessService.assertCanManageProject(
      dto.projectId,
      currentUser,
    );
    const definition = this.providerRegistry.get(provider);
    const connection = await this.connectionRepo.findOne({
      where: { projectId: project.id, provider: definition.provider },
    });
    if (!connection) {
      return;
    }

    const cliRegistry = this.normalizeCliRegistry(connection.cliRegistry);
    const clis = dto.cli
      ? [dto.cli]
      : (Object.keys(cliRegistry) as OAuthMcpCli[]);
    for (const cli of clis) {
      cliRegistry[cli] = { status: 'disconnected', lastLoginAt: null };
    }

    const hasConnected = Object.values(cliRegistry).some(
      (item) => item.status === 'connected',
    );
    await this.connectionRepo.update(
      { id: connection.id },
      {
        status: hasConnected ? 'connected' : 'disconnected',
        cliRegistry,
        lastError: null,
      },
    );
  }

  private spawnLoginProcess(input: {
    containerRef: string;
    command: string[];
  }): ActiveLoginProcess {
    const [command, ...args] = input.command;
    const workspace = this.containerConfig.getRunnerWorkspace();
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        '-w',
        workspace,
        '-e',
        'HOME=/root',
        input.containerRef,
        command,
        ...args,
      ],
      { stdio: 'pipe' },
    );
    const active: ActiveLoginProcess = {
      child,
      stdout: '',
      stderr: '',
    };
    child.stdout?.on('data', (chunk: Buffer) => {
      active.stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      active.stderr += chunk.toString('utf8');
    });
    return active;
  }

  private waitForAuthorizationUrl(
    sessionId: string,
    active: ActiveLoginProcess,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('OAuth authorization URL was not emitted in time'));
      }, LOGIN_URL_TIMEOUT_MS);

      const check = () => {
        const url = this.extractAuthorizationUrl(
          `${active.stdout}\n${active.stderr}`,
        );
        if (url) {
          cleanup();
          resolve(url);
        }
      };
      const onExit = (code: number | null) => {
        cleanup();
        if (code === 0) {
          resolve(null);
          return;
        }
        reject(
          new Error(
            `OAuth login process exited before authorization URL (code=${code ?? 'unknown'}): ${this.buildProcessDiagnostic(active)}`,
          ),
        );
      };
      const cleanup = () => {
        clearTimeout(timer);
        active.child.stdout?.off('data', check);
        active.child.stderr?.off('data', check);
        active.child.off('exit', onExit);
      };

      active.child.stdout?.on('data', check);
      active.child.stderr?.on('data', check);
      active.child.once('exit', onExit);
      check();
      timer.unref?.();
    });
  }

  private async prepareLoginConfig(input: {
    containerRef: string;
    cli: OAuthMcpCli;
    provider: string;
    upstreamMcpUrl: string;
  }): Promise<void> {
    switch (input.cli) {
      case 'codex':
        await this.prepareCodexLoginConfig(input);
        return;
      case 'cursor':
        await this.prepareCursorLoginConfig(input);
        return;
    }
  }

  private async prepareCodexLoginConfig(input: {
    containerRef: string;
    provider: string;
    upstreamMcpUrl: string;
  }): Promise<void> {
    const serverKey = this.toTomlBareKey(input.provider);
    const script = [
      'set -e',
      'export HOME=/root',
      'mkdir -p "$HOME/.codex"',
      'touch "$HOME/.codex/config.toml"',
      `if ! grep -Eq '^\\s*\\[mcp_servers\\.${this.escapeGrepRegex(serverKey)}\\]\\s*$' "$HOME/.codex/config.toml"; then`,
      `  printf '\\n[mcp_servers.${serverKey}]\\nurl = ${this.toTomlString(input.upstreamMcpUrl)}\\n' >> "$HOME/.codex/config.toml"`,
      'fi',
    ].join('\n');

    try {
      await execFileAsync(
        'docker',
        [
          'exec',
          '-w',
          this.containerConfig.getRunnerWorkspace(),
          '-e',
          'HOME=/root',
          input.containerRef,
          'bash',
          '-lc',
          script,
        ],
        { timeout: 10_000 },
      );
    } catch (error) {
      throw new Error(
        `Failed to prepare Codex MCP config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async prepareCursorLoginConfig(input: {
    containerRef: string;
    provider: string;
    upstreamMcpUrl: string;
  }): Promise<void> {
    const script = [
      'set -e',
      'export HOME=/root',
      'export PATH="/root/.local/bin:$PATH"',
      'mkdir -p "$HOME/.cursor"',
      `node <<'NODE'`,
      `const fs = require('node:fs');`,
      `const path = require('node:path');`,
      `const configPath = path.join(process.env.HOME, '.cursor', 'mcp.json');`,
      `const provider = process.env.AINATIVE_OAUTH_MCP_PROVIDER;`,
      `const url = process.env.AINATIVE_OAUTH_MCP_URL;`,
      `let config = {};`,
      `try {`,
      `  config = JSON.parse(fs.readFileSync(configPath, 'utf8') || '{}');`,
      `} catch {`,
      `  config = {};`,
      `}`,
      `if (!config || typeof config !== 'object' || Array.isArray(config)) {`,
      `  config = {};`,
      `}`,
      `if (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)) {`,
      `  config.mcpServers = {};`,
      `}`,
      `const existing = config.mcpServers[provider];`,
      `config.mcpServers[provider] = {`,
      `  ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),`,
      `  url,`,
      `};`,
      `fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\\n');`,
      `NODE`,
      '/root/.local/bin/agent mcp enable "$AINATIVE_OAUTH_MCP_PROVIDER"',
    ].join('\n');

    try {
      await execFileAsync(
        'docker',
        [
          'exec',
          '-w',
          this.containerConfig.getRunnerWorkspace(),
          '-e',
          'HOME=/root',
          '-e',
          `AINATIVE_OAUTH_MCP_PROVIDER=${input.provider}`,
          '-e',
          `AINATIVE_OAUTH_MCP_URL=${input.upstreamMcpUrl}`,
          input.containerRef,
          'bash',
          '-lc',
          script,
        ],
        { timeout: 10_000 },
      );
    } catch (error) {
      throw new Error(
        `Failed to prepare Cursor MCP config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private attachLoginExitHandler(input: {
    sessionId: string;
    provider: string;
    projectId: string;
    cli: OAuthMcpCli;
  }): void {
    const active = this.activeLogins.get(input.sessionId);
    if (!active) {
      return;
    }

    active.child.once('exit', (code) => {
      this.activeLogins.delete(input.sessionId);
      void this.handleLoginExit(input, code, active).catch((error) => {
        this.logger.warn(
          `oauth_mcp_login_exit_update_failed ${JSON.stringify({
            sessionId: input.sessionId,
            message: error instanceof Error ? error.message : String(error),
          })}`,
        );
      });
    });
  }

  private async handleLoginExit(
    input: {
      sessionId: string;
      provider: string;
      projectId: string;
      cli: OAuthMcpCli;
    },
    code: number | null,
    activeOutput: ActiveLoginProcess,
  ): Promise<void> {
    const status: ProjectMcpOAuthSessionStatus =
      code === 0 ? 'succeeded' : 'failed';
    const errorMessage =
      code === 0
        ? null
        : this.truncate(
            activeOutput.stderr || activeOutput.stdout || 'OAuth login failed',
            1000,
          );
    await this.sessionRepo.update(
      { id: input.sessionId },
      {
        status,
        errorMessage,
      },
    );
    await this.upsertConnection(input.projectId, input.provider, {
      status: status === 'succeeded' ? 'connected' : 'error',
      credentialVolumeRef: this.buildCredentialVolumeName(input.projectId),
      lastError: errorMessage,
      cli: input.cli,
      cliStatus: status === 'succeeded' ? 'connected' : 'error',
      cliLastLoginAt: status === 'succeeded' ? new Date().toISOString() : null,
    });
  }

  private async waitForLoginCompletion(
    sessionId: string,
  ): Promise<'relayed' | 'succeeded' | 'failed'> {
    const deadline = Date.now() + RELAY_WAIT_MS;
    while (Date.now() < deadline) {
      const session = await this.sessionRepo.findOne({
        where: { id: sessionId },
      });
      if (session?.status === 'succeeded' || session?.status === 'failed') {
        return session.status;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return 'relayed';
  }

  private async upsertConnection(
    projectId: string,
    provider: string,
    patch: {
      status: ProjectMcpOAuthConnectionStatus;
      credentialVolumeRef?: string | null;
      authorizedByUserId?: string | null;
      lastError?: string | null;
      cli: OAuthMcpCli;
      cliStatus: ProjectMcpOAuthConnectionStatus;
      cliLastLoginAt?: string | null;
    },
  ): Promise<ProjectMcpOAuthConnectionEntity> {
    const existing = await this.connectionRepo.findOne({
      where: { projectId, provider },
    });
    const cliRegistry = this.normalizeCliRegistry(existing?.cliRegistry);
    cliRegistry[patch.cli] = {
      status: patch.cliStatus,
      lastLoginAt:
        patch.cliLastLoginAt ?? cliRegistry[patch.cli]?.lastLoginAt ?? null,
    };

    return this.connectionRepo.save(
      this.connectionRepo.create({
        ...(existing ?? {}),
        projectId,
        provider,
        status: patch.status,
        credentialVolumeRef:
          patch.credentialVolumeRef ?? existing?.credentialVolumeRef ?? null,
        authorizedByUserId:
          patch.authorizedByUserId ?? existing?.authorizedByUserId ?? null,
        lastError: patch.lastError ?? null,
        cliRegistry,
      }),
    );
  }

  private async markConnectionError(
    connection: ProjectMcpOAuthConnectionEntity,
    cli: OAuthMcpCli,
    message: string,
  ): Promise<void> {
    const cliRegistry = this.normalizeCliRegistry(connection.cliRegistry);
    cliRegistry[cli] = {
      status: 'error',
      lastLoginAt: cliRegistry[cli]?.lastLoginAt ?? null,
    };
    await this.connectionRepo.update(
      { id: connection.id },
      { status: 'error', lastError: message, cliRegistry },
    );
  }

  private extractAuthorizationUrl(output: string): string | null {
    const match = output.match(/https:\/\/[^\s)]+/);
    return match?.[0] ?? null;
  }

  private buildProcessDiagnostic(active: ActiveLoginProcess): string {
    const output = [active.stderr.trim(), active.stdout.trim()]
      .filter(Boolean)
      .join('\n');
    return this.truncate(output || 'no stdout/stderr captured', 1500);
  }

  private parseAuthorizationUrl(url: string): {
    state: string | null;
    callbackPort: number | null;
  } {
    const parsed = new URL(url);
    const redirectUri = parsed.searchParams.get('redirect_uri');
    const state = parsed.searchParams.get('state');
    if (!redirectUri) {
      return { state, callbackPort: null };
    }
    const redirectUrl = new URL(redirectUri);
    return {
      state,
      callbackPort: Number.parseInt(redirectUrl.port, 10) || null,
    };
  }

  private parseCallbackUrl(url: string): {
    state: string | null;
    port: number | null;
  } {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid OAuth callback URL');
    }
    if (parsed.protocol !== 'http:') {
      throw new BadRequestException('OAuth callback URL must use http');
    }
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      throw new BadRequestException('OAuth callback URL must target 127.0.0.1');
    }
    return {
      state: parsed.searchParams.get('state'),
      port: Number.parseInt(parsed.port, 10) || null,
    };
  }

  private buildContainerCallbackUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hostname = '127.0.0.1';
    return parsed.toString();
  }

  private normalizeCliRegistry(
    value?: Record<string, unknown> | null,
  ): Partial<CliRegistry> {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as Partial<CliRegistry>;
  }

  private toCliState(
    cli: OAuthMcpCli,
    registry?: Partial<CliRegistry> | null,
  ): ProjectMcpOAuthCliStateDto {
    const state = registry?.[cli];
    return {
      cli,
      status: state?.status ?? 'disconnected',
      lastLoginAt: state?.lastLoginAt ?? null,
    };
  }

  private toSessionDto(
    session: ProjectMcpOAuthSessionEntity,
  ): ProjectMcpOAuthLoginSessionDto {
    return {
      sessionId: session.id,
      provider: session.provider,
      cli: session.cli,
      status: session.status,
      authorizationUrl: session.authorizationUrl ?? null,
      errorMessage: session.errorMessage ?? null,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private killActiveLogin(sessionId: string): void {
    const active = this.activeLogins.get(sessionId);
    if (!active) {
      return;
    }
    this.activeLogins.delete(sessionId);
    try {
      active.child.kill('SIGTERM');
    } catch {
      return;
    }
  }

  private buildCredentialVolumeName(projectId: string): string {
    return `ainative-project-${projectId}-oauth-mcp-credentials`;
  }

  private toTomlBareKey(value: string): string {
    if (/^[A-Za-z0-9_-]+$/.test(value)) {
      return value;
    }
    return this.toTomlString(value);
  }

  private toTomlString(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  private escapeGrepRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
  }
}
