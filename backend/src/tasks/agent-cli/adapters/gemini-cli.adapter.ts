import { BaseAgentCliAdapter } from '../agent-cli-adapter.base';
import {
  AgentCliContinuationOptions,
  AgentCliRunnerConfigInput,
} from '../agent-cli-adapter.interface';

export class GeminiCliAdapter extends BaseAgentCliAdapter {
  readonly id = 'gemini' as const;
  readonly toolIdAliases = ['gemini', 'gemini-cli'];
  readonly toolConfigAllowedKeys = new Set([
    'model',
    'sandbox',
    'yolo',
    'approval_mode',
    'policy',
    'allowed_mcp_server_names',
    'extensions',
    'env',
  ]);
  readonly defaultCommand = 'gemini';
  readonly runnerCommandEnvKey = 'AINATIVE_GEMINI_RUNNER_COMMAND';

  buildToolRunnerConfig(
    raw: Record<string, unknown>,
  ): AgentCliRunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    return {
      args: this.buildGeminiExecArgs(raw),
      env,
    };
  }

  defaultArgs(): string[] {
    return ['--output-format', 'stream-json'];
  }

  applyContinuation(
    args: string[],
    options: AgentCliContinuationOptions,
  ): string[] {
    return [...args, '--resume', options.sessionId];
  }

  private buildGeminiExecArgs(raw: Record<string, unknown>): string[] {
    const args = ['--output-format', 'stream-json'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const approvalMode = this.resolveGeminiApprovalMode(raw.approval_mode);
    const policy = this.resolveStringArray(raw.policy) ?? [];
    const allowedMcpServerNames =
      this.resolveStringArray(raw.allowed_mcp_server_names) ?? [];
    const extensions = this.resolveStringArray(raw.extensions) ?? [];

    if (model) {
      args.push('--model', model);
    }

    if (raw.sandbox === true) {
      args.push('--sandbox');
    }

    if (raw.yolo === true) {
      args.push('--yolo');
    } else if (approvalMode) {
      args.push('--approval-mode', approvalMode);
    }

    for (const item of policy) {
      args.push('--policy', item);
    }

    for (const item of allowedMcpServerNames) {
      args.push('--allowed-mcp-server-names', item);
    }

    for (const item of extensions) {
      args.push('--extensions', item);
    }

    return args;
  }

  private resolveGeminiApprovalMode(
    value: unknown,
  ): 'default' | 'auto_edit' | 'yolo' | 'plan' | null {
    if (
      value === 'default' ||
      value === 'auto_edit' ||
      value === 'yolo' ||
      value === 'plan'
    ) {
      return value;
    }

    return null;
  }
}
