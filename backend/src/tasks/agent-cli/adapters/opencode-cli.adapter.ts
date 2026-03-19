import { BaseAgentCliAdapter } from '../agent-cli-adapter.base';
import {
  AgentCliContinuationOptions,
  AgentCliRunnerConfigInput,
} from '../agent-cli-adapter.interface';

export class OpencodeCliAdapter extends BaseAgentCliAdapter {
  readonly id = 'opencode' as const;
  readonly toolIdAliases = ['opencode'];
  readonly toolConfigAllowedKeys = new Set([
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

    return {
      args: this.buildOpenCodeRunArgs(raw),
      env,
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
