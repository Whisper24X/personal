import { BaseAgentCliAdapter } from '../agent-cli-adapter.base';
import {
  AgentCliContinuationOptions,
  AgentCliRunnerConfigInput,
} from '../agent-cli-adapter.interface';

export class OpencodeCliAdapter extends BaseAgentCliAdapter {
  private static readonly PROVIDER_ENV_MAP: Record<
    string,
    { apiKeyEnv: string; baseUrlEnv?: string }
  > = {
    openai: { apiKeyEnv: 'OPENAI_API_KEY', baseUrlEnv: 'OPENAI_BASE_URL' },
    anthropic: {
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      baseUrlEnv: 'ANTHROPIC_BASE_URL',
    },
    google: { apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY' },
    openrouter: {
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrlEnv: 'OPENROUTER_BASE_URL',
    },
    mistral: { apiKeyEnv: 'MISTRAL_API_KEY', baseUrlEnv: 'MISTRAL_BASE_URL' },
    xai: { apiKeyEnv: 'XAI_API_KEY', baseUrlEnv: 'XAI_BASE_URL' },
  };

  readonly id = 'opencode' as const;
  readonly toolIdAliases = ['opencode'];
  readonly toolConfigAllowedKeys = new Set([
    'provider',
    'api_key',
    'base_url',
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
    const apiKey =
      typeof raw.api_key === 'string' && raw.api_key.trim()
        ? raw.api_key.trim()
        : undefined;
    const baseUrl =
      typeof raw.base_url === 'string' && raw.base_url.trim()
        ? raw.base_url.trim()
        : undefined;
    const provider =
      typeof raw.provider === 'string' && raw.provider.trim()
        ? raw.provider.trim()
        : 'openai';

    const mapping =
      OpencodeCliAdapter.PROVIDER_ENV_MAP[provider] ??
      OpencodeCliAdapter.PROVIDER_ENV_MAP['openai'];

    const resolvedEnv: Record<string, string> = { ...(env ?? {}) };
    if (apiKey) {
      resolvedEnv[mapping.apiKeyEnv] = apiKey;
    }
    if (baseUrl && mapping.baseUrlEnv) {
      resolvedEnv[mapping.baseUrlEnv] = baseUrl;
    }

    return {
      args: this.buildOpenCodeRunArgs(raw),
      env: Object.keys(resolvedEnv).length > 0 ? resolvedEnv : undefined,
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
