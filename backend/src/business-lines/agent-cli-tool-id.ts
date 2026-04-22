export const SUPPORTED_AGENT_CLI_TOOL_IDS = [
  'cursor-agent',
  'claude-code',
  'codex',
  'gemini-cli',
  'opencode',
] as const;

export type SupportedAgentCliToolId =
  (typeof SUPPORTED_AGENT_CLI_TOOL_IDS)[number];

const TOOL_ID_ALIASES: Record<string, SupportedAgentCliToolId> = {
  claude: 'claude-code',
  'claude-code': 'claude-code',
  codex: 'codex',
  'codex-cli': 'codex',
  cursor: 'cursor-agent',
  'cursor-agent': 'cursor-agent',
  gemini: 'gemini-cli',
  'gemini-cli': 'gemini-cli',
  opencode: 'opencode',
};

export const normalizeAgentCliToolId = (value: string): string => {
  const normalized = value.trim().toLowerCase();

  return TOOL_ID_ALIASES[normalized] ?? normalized;
};

export const normalizeSupportedAgentCliToolId = (
  value: string,
): SupportedAgentCliToolId | null => {
  const normalized = value.trim().toLowerCase();

  return TOOL_ID_ALIASES[normalized] ?? null;
};
