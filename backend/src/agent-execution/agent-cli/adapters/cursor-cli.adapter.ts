import { BaseAgentCliAdapter } from '../agent-cli-adapter.base';
import {
  AgentCliContinuationOptions,
  AgentCliPreExecutionOutputInput,
  AgentCliRunnerConfigInput,
} from '../agent-cli-adapter.interface';

export class CursorCliAdapter extends BaseAgentCliAdapter {
  readonly id = 'cursor' as const;
  readonly toolIdAliases = ['cursor', 'cursor-agent'];
  readonly toolConfigAllowedKeys = new Set([
    'api_key',
    'model',
    'headers',
    'trust',
    'force',
    'sandbox',
    'approve_mcps',
    'env',
  ]);
  readonly defaultCommand = 'agent';
  readonly runnerCommandEnvKey = 'AINATIVE_CURSOR_RUNNER_COMMAND';

  buildToolRunnerConfig(
    raw: Record<string, unknown>,
  ): AgentCliRunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;
    const apiKey =
      typeof raw.api_key === 'string' && raw.api_key.trim()
        ? raw.api_key.trim()
        : undefined;

    return {
      args: this.buildCursorPrintArgs(raw),
      env: apiKey ? { ...(env ?? {}), CURSOR_API_KEY: apiKey } : env,
    };
  }

  defaultArgs(): string[] {
    return [
      '-p',
      '--output-format',
      'stream-json',
      '--trust',
      '--force',
      '--sandbox',
      'enabled',
      '--approve-mcps',
    ];
  }

  applyContinuation(
    args: string[],
    options: AgentCliContinuationOptions,
  ): string[] {
    return [...args, '--resume', options.sessionId];
  }

  buildPreExecutionOutputRecords(
    input: AgentCliPreExecutionOutputInput,
  ): Record<string, unknown>[] {
    const prompt = this.normalizeOptionalString(input.prompt);

    if (!prompt) {
      return [];
    }

    return [
      {
        type: 'user_message',
        message: prompt,
        created_at: input.createdAt.toISOString(),
        source: 'ainative_injected_prompt',
      },
    ];
  }

  private buildCursorPrintArgs(raw: Record<string, unknown>): string[] {
    const args = ['-p', '--output-format', 'stream-json'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const headers = this.resolveStringArray(raw.headers) ?? [];

    if (model) {
      args.push('--model', model);
    }

    for (const header of headers) {
      args.push('--header', header);
    }

    if (raw.trust === true) {
      args.push('--trust');
    }

    if (raw.force === true) {
      args.push('--force');
    }

    const isRoot = process.getuid?.() === 0;
    const sandbox =
      this.resolveCursorSandbox(raw.sandbox) ??
      (isRoot ? 'disabled' : 'enabled');
    args.push('--sandbox', sandbox);

    if (raw.approve_mcps !== false) {
      args.push('--approve-mcps');
    }

    return args;
  }

  private resolveCursorSandbox(value: unknown): 'enabled' | 'disabled' | null {
    if (value === 'enabled' || value === 'disabled') {
      return value;
    }

    return null;
  }
}
