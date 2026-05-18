import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';

@Injectable()
export class RunnerFigmaMcpCredentialSyncService {
  private readonly logger = new Logger(
    RunnerFigmaMcpCredentialSyncService.name,
  );

  async syncCodexFigmaCredentialToCursor(input: {
    containerRef: string;
    cwdInContainer: string;
  }): Promise<{ synced: boolean; reason?: string }> {
    const script = `
const fs = require('node:fs');
const path = require('node:path');
const codexCredPath = '/root/.codex/.credentials.json';
const workspace = process.env.AINATIVE_RUNNER_CWD || '/workspace';
const cursorPath = path.join(workspace, '.cursor', 'mcp.json');
if (!fs.existsSync(codexCredPath)) {
  console.log(JSON.stringify({ synced: false, reason: 'codex_credentials_missing' }));
  process.exit(0);
}
let creds;
try {
  creds = JSON.parse(fs.readFileSync(codexCredPath, 'utf8'));
} catch {
  console.log(JSON.stringify({ synced: false, reason: 'codex_credentials_invalid' }));
  process.exit(0);
}
const figmaCred = Object.values(creds).find((entry) => {
  return entry &&
    entry.server_name === 'figma' &&
    entry.server_url === 'https://mcp.figma.com/mcp' &&
    typeof entry.access_token === 'string' &&
    entry.access_token.length > 0;
});
if (!figmaCred) {
  console.log(JSON.stringify({ synced: false, reason: 'figma_credential_missing' }));
  process.exit(0);
}
if (typeof figmaCred.expires_at === 'number' && figmaCred.expires_at <= Date.now()) {
  console.log(JSON.stringify({ synced: false, reason: 'figma_access_token_expired' }));
  process.exit(0);
}
let config = {};
try {
  config = JSON.parse(fs.readFileSync(cursorPath, 'utf8'));
} catch {
  config = {};
}
if (!config || typeof config !== 'object' || Array.isArray(config)) {
  config = {};
}
if (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)) {
  config.mcpServers = {};
}
const existing = config.mcpServers.figma && typeof config.mcpServers.figma === 'object' && !Array.isArray(config.mcpServers.figma)
  ? config.mcpServers.figma
  : {};
config.mcpServers.figma = {
  ...existing,
  url: 'https://mcp.figma.com/mcp',
  headers: {
    ...(existing.headers && typeof existing.headers === 'object' && !Array.isArray(existing.headers) ? existing.headers : {}),
    Authorization: 'Bearer ' + figmaCred.access_token,
  },
};
fs.mkdirSync(path.dirname(cursorPath), { recursive: true });
fs.writeFileSync(cursorPath, JSON.stringify(config, null, 2) + '\\n');
console.log(JSON.stringify({ synced: true }));
`;

    try {
      const stdout = await this.runDockerExec([
        'exec',
        '-e',
        `AINATIVE_RUNNER_CWD=${input.cwdInContainer}`,
        input.containerRef,
        'node',
        '-e',
        script,
      ]);
      const parsed = this.parseSyncResult(stdout);
      if (parsed.synced) {
        this.logger.log(
          `figma_mcp_credential_sync ${JSON.stringify({
            event: 'synced',
            containerRef: input.containerRef,
            cwdInContainer: input.cwdInContainer,
          })}`,
        );
      }
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `figma_mcp_credential_sync ${JSON.stringify({
          event: 'failed',
          containerRef: input.containerRef,
          cwdInContainer: input.cwdInContainer,
          message,
        })}`,
      );
      return { synced: false, reason: 'sync_failed' };
    }
  }

  private runDockerExec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';
      const timeoutRef = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Figma MCP credential sync timed out'));
      }, 10_000);
      timeoutRef.unref?.();

      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });
      child.once('error', (error) => {
        clearTimeout(timeoutRef);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timeoutRef);
        if (code === 0) {
          resolve(stdout);
          return;
        }
        reject(
          new Error(stderr.trim() || `docker exec failed with code ${code}`),
        );
      });
    });
  }

  private parseSyncResult(stdout: string): {
    synced: boolean;
    reason?: string;
  } {
    const line = stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1);
    if (!line) {
      return { synced: false, reason: 'empty_output' };
    }
    try {
      const parsed = JSON.parse(line) as { synced?: unknown; reason?: unknown };
      return {
        synced: parsed.synced === true,
        ...(typeof parsed.reason === 'string' ? { reason: parsed.reason } : {}),
      };
    } catch {
      return { synced: false, reason: 'invalid_output' };
    }
  }
}
