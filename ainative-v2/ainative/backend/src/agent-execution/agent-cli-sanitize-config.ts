import { AgentCliAdapterId } from './agent-cli/agent-cli-adapter.interface';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';

/**
 * Strips unknown keys from persisted business-line tool config so it matches
 * {@link AgentExecutionConfigResolverService} behavior.
 */
export function sanitizeAgentToolConfigJson(
  registry: AgentCliAdapterRegistry,
  adapter: AgentCliAdapterId,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const allowedKeys = registry.getById(adapter).toolConfigAllowedKeys;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (allowedKeys.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
