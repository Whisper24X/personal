import { BaseAgentCliAdapter } from '../agent-cli-adapter.base';
import {
  AgentCliContinuationOptions,
  AgentCliPreExecutionOutputInput,
  AgentCliRunnerConfigInput,
} from '../agent-cli-adapter.interface';

export class CodexCliAdapter extends BaseAgentCliAdapter {
  readonly id = 'codex' as const;
  readonly toolIdAliases = ['codex', 'codex-cli'];
  readonly toolConfigAllowedKeys = new Set([
    'api_key',
    'base_url',
    'provider_name',
    'model',
    'oss',
    'local_provider',
    'sandbox',
    'profile',
    'execution_mode',
    'config_overrides',
    'env',
  ]);
  readonly defaultCommand = 'codex';
  readonly runnerCommandEnvKey = 'AINATIVE_CODEX_RUNNER_COMMAND';

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

    const resolvedEnv: Record<string, string> = { ...(env ?? {}) };
    if (apiKey) {
      resolvedEnv['OPENAI_API_KEY'] = apiKey;
    }
    delete resolvedEnv['OPENAI_BASE_URL'];

    return {
      args: this.buildCodexExecArgs(raw),
      env: Object.keys(resolvedEnv).length > 0 ? resolvedEnv : undefined,
    };
  }

  defaultArgs(): string[] {
    return ['exec', '--json', '--skip-git-repo-check', '--full-auto', '-'];
  }

  applyContinuation(
    args: string[],
    options: AgentCliContinuationOptions,
  ): string[] {
    const normalizedArgs = [...args];
    const execIndex = normalizedArgs.indexOf('exec');

    if (execIndex === -1) {
      return ['exec', 'resume', ...normalizedArgs, options.sessionId];
    }

    const promptIndex = normalizedArgs.lastIndexOf('-');
    const nextArgs = [...normalizedArgs];
    nextArgs.splice(execIndex + 1, 0, 'resume');

    const sessionInsertIndex =
      promptIndex >= 0 && promptIndex > execIndex
        ? promptIndex + 1
        : nextArgs.length;

    nextArgs.splice(sessionInsertIndex, 0, options.sessionId);
    return nextArgs;
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

  normalizeArgs(args: string[]): string[] {
    const normalizedArgs = [...args];
    if (normalizedArgs.includes('--json')) {
      return normalizedArgs;
    }

    const execIndex = normalizedArgs.indexOf('exec');
    if (execIndex >= 0) {
      normalizedArgs.splice(execIndex + 1, 0, '--json');
      return normalizedArgs;
    }

    return ['exec', '--json', ...normalizedArgs];
  }

  private buildCodexExecArgs(raw: Record<string, unknown>): string[] {
    const args = ['exec', '--json', '--skip-git-repo-check'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const localProvider = this.normalizeOptionalString(
      typeof raw.local_provider === 'string' ? raw.local_provider : null,
    );
    const profile = this.normalizeOptionalString(
      typeof raw.profile === 'string' ? raw.profile : null,
    );
    const providerName = this.normalizeOptionalString(
      typeof raw.provider_name === 'string' ? raw.provider_name : null,
    );
    const baseUrl = this.normalizeCodexBaseUrl(
      this.normalizeOptionalString(
        typeof raw.base_url === 'string' ? raw.base_url : null,
      ),
    );
    const sandbox = this.resolveCodexSandbox(raw.sandbox);
    const executionMode = this.resolveCodexExecutionMode(raw.execution_mode);
    const configOverrides = this.resolveStringArray(raw.config_overrides) ?? [];

    if (model) {
      args.push('--model', model);
    }

    if (raw.oss === true) {
      args.push('--oss');
    }

    if (localProvider) {
      args.push('--local-provider', localProvider);
    }

    if (profile) {
      args.push('--profile', profile);
    }

    if (executionMode === 'full-auto') {
      args.push('--full-auto');
    } else if (executionMode === 'dangerously-bypass-approvals-and-sandbox') {
      args.push('--dangerously-bypass-approvals-and-sandbox');
    } else {
      args.push('--sandbox', sandbox ?? 'workspace-write');
    }

    if (providerName) {
      args.push('-c', `model_provider="${providerName}"`);
      args.push('-c', `model_providers.${providerName}.name="${providerName}"`);
      args.push('-c', `model_providers.${providerName}.wire_api="responses"`);
      args.push(
        '-c',
        `model_providers.${providerName}.requires_openai_auth=true`,
      );
      args.push(
        '-c',
        `model_providers.${providerName}.env_key="OPENAI_API_KEY"`,
      );
      if (baseUrl) {
        args.push(
          '-c',
          `model_providers.${providerName}.base_url="${baseUrl}"`,
        );
      }
    } else if (baseUrl) {
      const defaultProvider = 'ainative';
      args.push('-c', `model_provider="${defaultProvider}"`);
      args.push(
        '-c',
        `model_providers.${defaultProvider}.name="${defaultProvider}"`,
      );
      args.push(
        '-c',
        `model_providers.${defaultProvider}.wire_api="responses"`,
      );
      args.push(
        '-c',
        `model_providers.${defaultProvider}.requires_openai_auth=true`,
      );
      args.push(
        '-c',
        `model_providers.${defaultProvider}.env_key="OPENAI_API_KEY"`,
      );
      args.push(
        '-c',
        `model_providers.${defaultProvider}.base_url="${baseUrl}"`,
      );
    }

    for (const override of configOverrides) {
      args.push('-c', override);
    }

    args.push('-');

    return args;
  }

  private normalizeCodexBaseUrl(url: string | null): string | null {
    if (!url) return null;
    const trimmed = url.replace(/\/+$/, '');
    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  }

  private resolveCodexExecutionMode(
    value: unknown,
  ): 'standard' | 'full-auto' | 'dangerously-bypass-approvals-and-sandbox' {
    if (value === 'full-auto') {
      return 'full-auto';
    }

    if (value === 'dangerously-bypass-approvals-and-sandbox') {
      return 'dangerously-bypass-approvals-and-sandbox';
    }

    return 'standard';
  }

  private resolveCodexSandbox(
    value: unknown,
  ): 'read-only' | 'workspace-write' | 'danger-full-access' | null {
    if (
      value === 'read-only' ||
      value === 'workspace-write' ||
      value === 'danger-full-access'
    ) {
      return value;
    }

    return null;
  }
}
