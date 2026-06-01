export type ConfigFieldType =
  | 'string'
  | 'stringArray'
  | 'stringMap'
  | 'boolean'
  | 'booleanNullable'

export type ConfigFieldOption = {
  value: string
  label: string
}

export type ConfigFieldSchema = {
  type: ConfigFieldType
  required?: boolean
  defaultValue?: unknown
  multiline?: boolean
  options?: ConfigFieldOption[]
  description?: string
}

const CODEX_SANDBOX_OPTIONS: ConfigFieldOption[] = [
  { value: 'read-only', label: 'Read Only' },
  { value: 'workspace-write', label: 'Workspace Write' },
  { value: 'danger-full-access', label: 'Danger Full Access' },
]

const CODEX_EXECUTION_MODE_OPTIONS: ConfigFieldOption[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'full-auto', label: 'Full Auto' },
  {
    value: 'dangerously-bypass-approvals-and-sandbox',
    label: 'Dangerously Bypass Approvals And Sandbox',
  },
]

const CLAUDE_AUTH_TYPE_OPTIONS: ConfigFieldOption[] = [
  { value: 'ANTHROPIC_API_KEY', label: 'API Key (ANTHROPIC_API_KEY)' },
  { value: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth Token (ANTHROPIC_AUTH_TOKEN)' },
]

const CLAUDE_EFFORT_OPTIONS: ConfigFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
]

const CLAUDE_PERMISSION_MODE_OPTIONS: ConfigFieldOption[] = [
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'bypassPermissions', label: 'Bypass Permissions' },
  { value: 'default', label: 'Default' },
  { value: 'dontAsk', label: 'Dont Ask' },
  { value: 'plan', label: 'Plan' },
  { value: 'auto', label: 'Auto' },
]

const CURSOR_SANDBOX_OPTIONS: ConfigFieldOption[] = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
]

const GEMINI_APPROVAL_MODE_OPTIONS: ConfigFieldOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'auto_edit', label: 'Auto Edit' },
  { value: 'yolo', label: 'Yolo' },
  { value: 'plan', label: 'Plan' },
]

const OPENCODE_PROVIDER_OPTIONS: ConfigFieldOption[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'xai', label: 'xAI' },
]

export const OPENCODE_PROVIDER_ENV_MAP: Record<
  string,
  { apiKeyEnv: string; baseUrlEnv?: string }
> = {
  openai: { apiKeyEnv: 'OPENAI_API_KEY', baseUrlEnv: 'OPENAI_BASE_URL' },
  anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY', baseUrlEnv: 'ANTHROPIC_BASE_URL' },
  google: { apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  openrouter: { apiKeyEnv: 'OPENROUTER_API_KEY', baseUrlEnv: 'OPENROUTER_BASE_URL' },
  mistral: { apiKeyEnv: 'MISTRAL_API_KEY', baseUrlEnv: 'MISTRAL_BASE_URL' },
  xai: { apiKeyEnv: 'XAI_API_KEY', baseUrlEnv: 'XAI_BASE_URL' },
}

export const OPENCODE_FALLBACK_MAPPING: { apiKeyEnv: string; baseUrlEnv?: string } = {
  apiKeyEnv: 'OPENAI_API_KEY',
  baseUrlEnv: 'OPENAI_BASE_URL',
}

export const ALL_OPENCODE_API_KEY_ENVS = new Set(
  Object.values(OPENCODE_PROVIDER_ENV_MAP).map((m) => m.apiKeyEnv),
)

export const ALL_OPENCODE_BASE_URL_ENVS = new Set(
  Object.values(OPENCODE_PROVIDER_ENV_MAP)
    .map((m) => m.baseUrlEnv)
    .filter(Boolean) as string[],
)

export const BOOLEAN_NULLABLE_FIELD_OPTIONS = [
  { label: 'Default', value: null },
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false },
] as const

export const AGENT_TOOL_CONFIG_SELECT_PANEL_Z_INDEX = 130

export const TOOL_CONFIG_SCHEMAS: Record<string, Record<string, ConfigFieldSchema>> = {
  'claude-code': {
    auth_type: {
      type: 'string',
      options: CLAUDE_AUTH_TYPE_OPTIONS,
      defaultValue: 'ANTHROPIC_AUTH_TOKEN',
      description: '选择认证环境变量名',
    },
    auth_token: { type: 'string', description: '认证密钥，修改后自动写入 env' },
    base_url: {
      type: 'string',
      description: '自定义 API 地址（ANTHROPIC_BASE_URL），修改后自动写入 env',
    },
    model: { type: 'string' },
    effort: { type: 'string', options: CLAUDE_EFFORT_OPTIONS },
    dangerously_skip_permissions: {
      type: 'boolean',
      defaultValue: true,
      description: '默认使用最高权限',
    },
    permission_mode: {
      type: 'string',
      options: CLAUDE_PERMISSION_MODE_OPTIONS,
      description: '仅在未开启危险权限时生效',
    },
    allowed_tools: {
      type: 'stringArray',
      description: '每行一个 tool 名称',
    },
    disallowed_tools: {
      type: 'stringArray',
      description: '每行一个 tool 名称',
    },
    settings: {
      type: 'string',
      multiline: true,
      description: 'Claude settings JSON 或 settings 文件路径',
    },
    mcp_config: {
      type: 'stringArray',
      description: '每行一个 MCP 配置文件路径或 JSON 字符串',
    },
    env: { type: 'stringMap' },
  },
  codex: {
    api_key: { type: 'string', description: 'OpenAI API Key，将注入为 OPENAI_API_KEY' },
    base_url: {
      type: 'string',
      description: '自定义 API 地址，通过 -c openai_base_url 或 -c model_providers.*.base_url 注入',
    },
    provider_name: {
      type: 'string',
      description:
        '自定义 Provider 名称（可选），设置后自动生成 -c model_provider 及 model_providers 配置',
    },
    model: { type: 'string', defaultValue: 'gpt-5.4', description: '默认模型' },
    oss: { type: 'booleanNullable' },
    local_provider: {
      type: 'string',
      description: '例如 ollama 或 lmstudio',
    },
    profile: { type: 'string', description: 'Codex profile 名称' },
    execution_mode: {
      type: 'string',
      options: CODEX_EXECUTION_MODE_OPTIONS,
      defaultValue: 'dangerously-bypass-approvals-and-sandbox',
      description: '默认使用最高权限模式',
    },
    sandbox: {
      type: 'string',
      options: CODEX_SANDBOX_OPTIONS,
      description: '仅在 Standard 模式下生效',
    },
    config_overrides: {
      type: 'stringArray',
      description: '每行一个 key=value，将转换为 -c key=value',
    },
    env: { type: 'stringMap' },
  },
  'cursor-agent': {
    api_key: { type: 'string' },
    model: { type: 'string' },
    sandbox: {
      type: 'string',
      options: CURSOR_SANDBOX_OPTIONS,
    },
    trust: {
      type: 'boolean',
      defaultValue: true,
      description: '默认信任当前工作区',
    },
    force: {
      type: 'boolean',
      defaultValue: true,
      description: '默认强制放行命令执行',
    },
    headers: {
      type: 'stringArray',
      description: '每行一个 Name: Value',
    },
    approve_mcps: {
      type: 'booleanNullable',
      description: '自动批准所有 MCP servers',
    },
    env: { type: 'stringMap' },
  },
  'gemini-cli': {
    api_key: { type: 'string', description: 'Gemini API Key，将注入为 GEMINI_API_KEY' },
    base_url: {
      type: 'string',
      description:
        '自定义网关地址（不带 /v1），注入为 GOOGLE_GEMINI_BASE_URL，同时自动启用 bearer 认证',
    },
    model: { type: 'string' },
    sandbox: {
      type: 'boolean',
      defaultValue: false,
      description: '为 Gemini CLI 开启 --sandbox（需要容器内有 Docker）',
    },
    yolo: {
      type: 'boolean',
      defaultValue: true,
      description: '默认使用最高权限模式',
    },
    approval_mode: {
      type: 'string',
      options: GEMINI_APPROVAL_MODE_OPTIONS,
      description: '仅在未开启 YOLO 时生效',
    },
    policy: {
      type: 'stringArray',
      description: '每行一个 policy 文件或目录',
    },
    allowed_mcp_server_names: {
      type: 'stringArray',
      description: '每行一个允许的 MCP server 名称',
    },
    extensions: {
      type: 'stringArray',
      description: '每行一个 extension 名称',
    },
    env: { type: 'stringMap' },
  },
  opencode: {
    provider: {
      type: 'string',
      options: OPENCODE_PROVIDER_OPTIONS,
      defaultValue: 'openai',
      description: '选择 AI 供应商，决定注入的环境变量名称',
    },
    api_key: { type: 'string', description: 'API Key，根据供应商自动注入对应环境变量' },
    base_url: {
      type: 'string',
      description: '自定义网关地址（含 /v1），根据供应商自动注入对应环境变量',
    },
    model: {
      type: 'string',
      description: '格式为 provider/model，如 openai/gpt-5.4、anthropic/claude-opus-4-6',
    },
    agent: { type: 'string' },
    fork: {
      type: 'boolean',
      description: '仅在节点已有 session id 时生效',
    },
    prompt: {
      type: 'string',
      multiline: true,
      description: '追加到 OpenCode CLI 的固定 prompt，不替代任务 prompt',
    },
    env: { type: 'stringMap' },
  },
}

export const ADVANCED_FIELDS_BY_TOOL: Record<string, Set<string>> = {
  'claude-code': new Set(['allowed_tools', 'disallowed_tools', 'settings', 'mcp_config', 'env']),
  codex: new Set(['config_overrides', 'env']),
  'cursor-agent': new Set(['headers', 'approve_mcps', 'env']),
  'gemini-cli': new Set(['policy', 'allowed_mcp_server_names', 'extensions', 'env']),
  opencode: new Set(['prompt', 'env']),
}
