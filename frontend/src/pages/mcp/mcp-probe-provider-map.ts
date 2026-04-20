import type { AgentToolConfig } from '@/api/business-lines'

/** Project MCP `metadata.sourceProvider` → 探测时允许的 `AgentToolConfig.toolId`（与后端 adapter 别名对齐） */
export const MCP_SOURCE_PROVIDER_TO_PROBE_TOOL_IDS: Record<string, readonly string[]> = {
  cursor: ['cursor-agent', 'cursor'],
  gemini: ['gemini-cli', 'gemini'],
  opencode: ['opencode'],
  'claude-code': ['claude-code', 'claude'],
  codex: ['codex', 'codex-cli'],
}

export function hasMcpProbeMappingForProvider(providerId: string): boolean {
  const ids = MCP_SOURCE_PROVIDER_TO_PROBE_TOOL_IDS[providerId]
  return Boolean(ids?.length)
}

export function filterAgentToolConfigsForMcpProvider(
  providerId: string,
  configs: AgentToolConfig[],
): AgentToolConfig[] {
  const allowed = MCP_SOURCE_PROVIDER_TO_PROBE_TOOL_IDS[providerId]
  if (!allowed?.length) {
    return []
  }
  const set = new Set(allowed)
  return configs.filter((c) => set.has(c.toolId))
}

export function pickDefaultProbeAgentToolConfigId(configs: AgentToolConfig[]): string {
  if (configs.length === 0) {
    return ''
  }
  const preferred = configs.find((c) => c.isDefault) ?? configs[0]
  return preferred?.id ?? ''
}
