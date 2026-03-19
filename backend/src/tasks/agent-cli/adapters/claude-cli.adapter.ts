import { BaseAgentCliAdapter } from '../agent-cli-adapter.base';
import {
  AgentCliContinuationOptions,
  AgentCliRunnerConfigInput,
} from '../agent-cli-adapter.interface';

export class ClaudeCliAdapter extends BaseAgentCliAdapter {
  readonly id = 'claude' as const;
  readonly toolIdAliases = ['claude', 'claude-code'];
  readonly toolConfigAllowedKeys = new Set([
    'model',
    'effort',
    'permission_mode',
    'dangerously_skip_permissions',
    'allowed_tools',
    'disallowed_tools',
    'settings',
    'mcp_config',
    'env',
  ]);
  readonly defaultCommand = 'claude';
  readonly runnerCommandEnvKey = 'AINATIVE_CLAUDE_RUNNER_COMMAND';

  buildToolRunnerConfig(
    raw: Record<string, unknown>,
  ): AgentCliRunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    return {
      args: this.buildClaudePrintArgs(raw),
      env,
    };
  }

  defaultArgs(): string[] {
    return ['-p', '--output-format', 'stream-json', '--verbose'];
  }

  applyContinuation(
    args: string[],
    options: AgentCliContinuationOptions,
  ): string[] {
    return [...args, '--resume', options.sessionId];
  }

  private buildClaudePrintArgs(raw: Record<string, unknown>): string[] {
    const args = ['-p', '--output-format', 'stream-json', '--verbose'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const effort = this.resolveClaudeEffort(raw.effort);
    const permissionMode = this.resolveClaudePermissionMode(
      raw.permission_mode,
    );
    const allowedTools = this.resolveStringArray(raw.allowed_tools) ?? [];
    const disallowedTools = this.resolveStringArray(raw.disallowed_tools) ?? [];
    const mcpConfig = this.resolveStringArray(raw.mcp_config) ?? [];
    const settings = this.normalizeOptionalString(
      typeof raw.settings === 'string' ? raw.settings : null,
    );
    const dangerouslySkipPermissions =
      raw.dangerously_skip_permissions === true;

    if (model) {
      args.push('--model', model);
    }

    if (effort) {
      args.push('--effort', effort);
    }

    if (dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    } else if (permissionMode) {
      args.push('--permission-mode', permissionMode);
    }

    if (allowedTools.length > 0) {
      args.push('--allowed-tools', ...allowedTools);
    }

    if (disallowedTools.length > 0) {
      args.push('--disallowed-tools', ...disallowedTools);
    }

    if (settings) {
      args.push('--settings', settings);
    }

    if (mcpConfig.length > 0) {
      args.push('--mcp-config', ...mcpConfig);
    }

    return args;
  }

  private resolveClaudeEffort(
    value: unknown,
  ): 'low' | 'medium' | 'high' | 'max' | null {
    if (
      value === 'low' ||
      value === 'medium' ||
      value === 'high' ||
      value === 'max'
    ) {
      return value;
    }

    return null;
  }

  private resolveClaudePermissionMode(
    value: unknown,
  ):
    | 'acceptEdits'
    | 'bypassPermissions'
    | 'default'
    | 'dontAsk'
    | 'plan'
    | 'auto'
    | null {
    if (
      value === 'acceptEdits' ||
      value === 'bypassPermissions' ||
      value === 'default' ||
      value === 'dontAsk' ||
      value === 'plan' ||
      value === 'auto'
    ) {
      return value;
    }

    return null;
  }
}
