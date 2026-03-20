import { BaseAgentCliAdapter } from '../agent-cli-adapter.base';
import {
  AgentCliContinuationOptions,
  AgentCliRunnerConfigInput,
} from '../agent-cli-adapter.interface';

export class OpencodeCliAdapter extends BaseAgentCliAdapter {
  readonly id = 'opencode' as const;
  readonly toolIdAliases = ['opencode'];
  readonly toolConfigAllowedKeys = new Set([
    'api_key',
    'model',
    'agent',
    'prompt',
    'fork',
    'env',
  ]);
  readonly defaultCommand = 'opencode';
  readonly runnerCommandEnvKey = 'AINATIVE_OPENCODE_RUNNER_COMMAND';

  buildToolRunnerConfig(
    raw: Record<string, unknown>,
  ): AgentCliRunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;
    // api_key 仅适用于 OpenAI 供应商；其他供应商请在高级 env 中填写对应的变量名
    const apiKey =
      typeof raw.api_key === 'string' && raw.api_key.trim()
        ? raw.api_key.trim()
        : undefined;

    return {
      args: this.buildOpenCodeRunArgs(raw),
      env: apiKey ? { ...(env ?? {}), OPENAI_API_KEY: apiKey } : env,
    };
  }

  defaultArgs(): string[] {
    return ['run', '--format', 'json'];
  }

  applyContinuation(
    args: string[],
    options: AgentCliContinuationOptions,
  ): string[] {
    return options.continuationConfig.fork === true
      ? [...args, '--continue', '--session', options.sessionId, '--fork']
      : [...args, '--continue', '--session', options.sessionId];
  }

  private buildOpenCodeRunArgs(raw: Record<string, unknown>): string[] {
    const args = ['run', '--format', 'json'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const agent = this.normalizeOptionalString(
      typeof raw.agent === 'string' ? raw.agent : null,
    );
    const prompt = this.normalizeOptionalString(
      typeof raw.prompt === 'string' ? raw.prompt : null,
    );

    if (model) {
      args.push('--model', model);
    }

    if (agent) {
      args.push('--agent', agent);
    }

    if (prompt) {
      args.push('--prompt', prompt);
    }

    return args;
  }
}
