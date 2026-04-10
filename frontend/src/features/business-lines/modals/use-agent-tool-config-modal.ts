import { computed, reactive, ref, watch } from 'vue'
import type { ConfigFieldSchema } from './agent-tool-config-modal.schema'
import {
  ADVANCED_FIELDS_BY_TOOL,
  ALL_OPENCODE_API_KEY_ENVS,
  ALL_OPENCODE_BASE_URL_ENVS,
  OPENCODE_FALLBACK_MAPPING,
  OPENCODE_PROVIDER_ENV_MAP,
  TOOL_CONFIG_SCHEMAS,
} from './agent-tool-config-modal.schema'
import {
  createConfigTemplate,
  isSecretFieldKey,
  sanitizeConfigBySchema,
  sanitizeStringArray,
  sanitizeStringMap,
} from './agent-tool-config-modal.parsing'

export type AgentToolConfigFormPayload = {
  name: string
  description: string
  isDefault: boolean
  config: Record<string, unknown>
}

export type AgentToolConfigModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  submitting: boolean
  cliToolId: string
  cliToolLabel: string
  initialName: string
  initialDescription: string
  initialIsDefault: boolean
  initialConfig: Record<string, unknown>
  errorMessage?: string
  size?: 'default' | 'large'
}

export type AgentToolConfigModalEmit = {
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: AgentToolConfigFormPayload): void
}

export type AgentToolConfigModalContext = ReturnType<typeof useAgentToolConfigModal>

export function useAgentToolConfigModal(
  props: AgentToolConfigModalProps,
  emit: AgentToolConfigModalEmit,
) {
const name = ref('')
const description = ref('')
const isDefault = ref(false)
const draftConfig = ref<Record<string, unknown>>({})
const validationMessage = ref('')
const isApiKeyVisible = ref(false)

const modalTitle = computed(() => {
  return props.mode === 'create' ? '新建 Agent CLI 配置' : '编辑 Agent CLI 配置'
})

const sectionClass = computed(() => {
  return props.size === 'large'
    ? 'relative z-10 my-3 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:my-0'
    : 'relative z-10 my-3 flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:my-0 sm:max-h-[calc(100vh-3rem)]'
})

const activeConfigSchema = computed<Record<string, ConfigFieldSchema>>(() => {
  return TOOL_CONFIG_SCHEMAS[props.cliToolId] ?? {}
})

const configFieldEntries = computed(() => {
  return Object.entries(activeConfigSchema.value)
})

const advancedFieldKeys = computed(() => {
  return ADVANCED_FIELDS_BY_TOOL[props.cliToolId] ?? new Set<string>()
})

const geminiYoloEnabled = computed(() => {
  return props.cliToolId === 'gemini-cli' && draftConfig.value.yolo === true
})

const hiddenFieldKeys = computed(() => {
  const hidden = new Set<string>()

  if (props.cliToolId === 'claude-code' && claudeDangerouslySkipPermissions.value) {
    hidden.add('permission_mode')
  }

  if (props.cliToolId === 'gemini-cli') {
    if (geminiYoloEnabled.value) {
      hidden.add('approval_mode')
    }
    hidden.add('sandbox')
  }

  return hidden
})

const basicFieldEntries = computed(() => {
  return configFieldEntries.value.filter(([fieldKey]) => {
    if (advancedFieldKeys.value.has(fieldKey)) {
      return false
    }

    if (hiddenFieldKeys.value.has(fieldKey)) {
      return false
    }

    return true
  })
})

const advancedFieldEntries = computed(() => {
  return configFieldEntries.value.filter(([fieldKey]) => {
    return advancedFieldKeys.value.has(fieldKey) && !hiddenFieldKeys.value.has(fieldKey)
  })
})

const codexExecutionMode = computed(() => {
  if (props.cliToolId !== 'codex') {
    return ''
  }

  const value = draftConfig.value.execution_mode
  return typeof value === 'string' ? value : ''
})

const isCodexSandboxDisabled = computed(() => {
  return props.cliToolId === 'codex' && codexExecutionMode.value !== 'standard'
})

const codexExecutionWarning = computed(() => {
  if (props.cliToolId !== 'codex') {
    return ''
  }

  if (codexExecutionMode.value === 'dangerously-bypass-approvals-and-sandbox') {
    return '当前模式会跳过审批并关闭沙箱，仅适用于已由外部环境隔离的执行场景。'
  }

  if (codexExecutionMode.value === 'full-auto') {
    return 'Full Auto 会自动执行命令，并忽略单独的 sandbox 选择。'
  }

  return ''
})

const claudeDangerouslySkipPermissions = computed(() => {
  if (props.cliToolId !== 'claude-code') {
    return false
  }

  return draftConfig.value.dangerously_skip_permissions === true
})

const isClaudePermissionModeDisabled = computed(() => {
  return props.cliToolId === 'claude-code' && claudeDangerouslySkipPermissions.value
})

const claudeExecutionWarning = computed(() => {
  if (!isClaudePermissionModeDisabled.value) {
    return ''
  }

  return '当前模式会跳过 Claude Code 的权限检查，仅适用于已由外部环境隔离的执行场景。'
})

const geminiExecutionWarning = computed(() => {
  if (!geminiYoloEnabled.value) {
    return ''
  }

  return '当前模式会自动接受 Gemini 的所有操作，仅适用于已由外部环境隔离的执行场景。'
})

const cursorTrustEnabled = computed(() => {
  return props.cliToolId === 'cursor-agent' && draftConfig.value.trust === true
})

const cursorForceEnabled = computed(() => {
  return props.cliToolId === 'cursor-agent' && draftConfig.value.force === true
})

const cursorExecutionWarning = computed(() => {
  if (props.cliToolId !== 'cursor-agent') {
    return ''
  }

  if (cursorTrustEnabled.value && cursorForceEnabled.value) {
    return '当前配置会信任工作区并强制放行命令执行，仅适用于已由外部环境隔离的执行场景。'
  }

  if (cursorForceEnabled.value) {
    return '当前配置会强制放行命令执行，请确认运行环境已隔离。'
  }

  if (cursorTrustEnabled.value) {
    return '当前配置会信任工作区，执行前不会再提示工作区确认。'
  }

  return ''
})

const formatFieldLabel = (key: string): string => {
  if (key === 'auth_token' && props.cliToolId === 'claude-code') {
    return draftConfig.value.auth_type === 'ANTHROPIC_API_KEY' ? 'Api Key' : 'Auth Token'
  }

  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const getFieldDescription = (fieldKey: string, field: ConfigFieldSchema): string => {
  if (fieldKey === 'auth_token' && props.cliToolId === 'claude-code') {
    const envKey = getClaudeAuthEnvKey(draftConfig.value)
    return `修改后自动写入 env.${envKey}`
  }

  if (props.cliToolId === 'opencode' && (fieldKey === 'api_key' || fieldKey === 'base_url')) {
    const mapping = getOpencodeEnvMapping(draftConfig.value)
    if (fieldKey === 'api_key') {
      return `修改后自动写入 env.${mapping.apiKeyEnv}`
    }
    if (fieldKey === 'base_url') {
      return mapping.baseUrlEnv
        ? `修改后自动写入 env.${mapping.baseUrlEnv}`
        : '当前供应商不支持自定义 Base URL'
    }
  }

  if (field.description) {
    return field.description
  }

  if (fieldKey === 'config_overrides') {
    return '每行一个 key=value'
  }

  if (fieldKey === 'headers') {
    return '每行一个 Name: Value'
  }

  if (field.type === 'stringArray') {
    return '每行一个参数'
  }

  if (field.type === 'stringMap') {
    return '每行使用 KEY=VALUE'
  }

  return ''
}

const shouldShowDefaultOption = (fieldKey: string): boolean => {
  if (props.cliToolId === 'codex' && fieldKey === 'execution_mode') {
    return false
  }

  if (props.cliToolId === 'claude-code' && fieldKey === 'auth_type') {
    return false
  }

  return true
}

const getStringFieldSelectOptions = (fieldKey: string, field: ConfigFieldSchema) => {
  const options = (field.options ?? []).map((option) => ({
    label: option.label,
    value: option.value,
  }))

  if (shouldShowDefaultOption(fieldKey)) {
    return [{ label: 'Default', value: '' }, ...options]
  }

  return options
}

const getStringFieldValue = (fieldKey: string): string => {
  const value = draftConfig.value[fieldKey]
  return typeof value === 'string' ? value : ''
}

const getBooleanNullableFieldValue = (fieldKey: string): boolean | null => {
  const value = draftConfig.value[fieldKey]

  if (value === true) {
    return true
  }

  if (value === false) {
    return false
  }

  return null
}

const getBooleanFieldChecked = (fieldKey: string, field: ConfigFieldSchema): boolean => {
  return (draftConfig.value[fieldKey] ?? field.defaultValue) === true
}

const getBooleanFieldStatusLabel = (fieldKey: string, field: ConfigFieldSchema): string => {
  if (fieldKey === 'dangerously_skip_permissions') {
    return 'Dangerously Skip Permissions'
  }

  return getBooleanFieldChecked(fieldKey, field) ? '已启用' : '已禁用'
}

const getBooleanFieldStatusHint = (fieldKey: string, field: ConfigFieldSchema): string => {
  if (fieldKey === 'dangerously_skip_permissions') {
    return getBooleanFieldChecked(fieldKey, field)
      ? '当前会跳过 Claude Code 权限检查'
      : '当前继续使用显式权限模式'
  }

  return '点击右侧开关切换当前状态'
}

const getStringInputName = (fieldKey: string): string => {
  return `agent-cli-${props.cliToolId}-${fieldKey}`
}

const getStringInputAutocomplete = (fieldKey: string): string => {
  return isSecretFieldKey(fieldKey) ? 'new-password' : 'off'
}

const CLAUDE_AUTH_ENV_KEYS = new Set(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'])

const getClaudeAuthEnvKey = (config: Record<string, unknown>): string => {
  return config.auth_type === 'ANTHROPIC_API_KEY' ? 'ANTHROPIC_API_KEY' : 'ANTHROPIC_AUTH_TOKEN'
}

const syncClaudeFieldToEnv = (config: Record<string, unknown>, changedField: string) => {
  const env = sanitizeStringMap(config.env)

  if (changedField === 'auth_token' || changedField === 'auth_type') {
    const envKey = getClaudeAuthEnvKey(config)
    const tokenValue = typeof config.auth_token === 'string' ? config.auth_token : ''

    for (const key of CLAUDE_AUTH_ENV_KEYS) {
      delete env[key]
    }

    if (tokenValue) {
      env[envKey] = tokenValue
    }
  }

  if (changedField === 'base_url') {
    const baseUrl = typeof config.base_url === 'string' ? config.base_url : ''
    if (baseUrl) {
      env['ANTHROPIC_BASE_URL'] = baseUrl
    } else {
      delete env['ANTHROPIC_BASE_URL']
    }
  }

  config.env = env
}

const syncClaudeEnvToFields = (config: Record<string, unknown>) => {
  const env = sanitizeStringMap(config.env)

  if (env['ANTHROPIC_AUTH_TOKEN']) {
    config.auth_type = 'ANTHROPIC_AUTH_TOKEN'
    config.auth_token = env['ANTHROPIC_AUTH_TOKEN']
  } else if (env['ANTHROPIC_API_KEY']) {
    config.auth_type = 'ANTHROPIC_API_KEY'
    config.auth_token = env['ANTHROPIC_API_KEY']
  } else {
    config.auth_token = ''
  }

  config.base_url = env['ANTHROPIC_BASE_URL'] ?? ''
}

const syncCodexFieldToEnv = (config: Record<string, unknown>, changedField: string) => {
  const env = sanitizeStringMap(config.env)

  if (changedField === 'api_key') {
    const apiKey = typeof config.api_key === 'string' ? config.api_key : ''
    if (apiKey) {
      env['OPENAI_API_KEY'] = apiKey
    } else {
      delete env['OPENAI_API_KEY']
    }
  }

  delete env['OPENAI_BASE_URL']

  config.env = env
}

const syncCodexEnvToFields = (config: Record<string, unknown>) => {
  const env = sanitizeStringMap(config.env)

  if (env['OPENAI_API_KEY']) {
    config.api_key = env['OPENAI_API_KEY']
  } else {
    config.api_key = ''
  }
}

const CODEX_SYNC_FIELDS = new Set(['api_key', 'base_url', 'provider_name'])

const GEMINI_SYNC_FIELDS = new Set(['api_key', 'base_url'])

const OPENCODE_SYNC_FIELDS = new Set(['provider', 'api_key', 'base_url'])

const syncGeminiFieldToEnv = (config: Record<string, unknown>, changedField: string) => {
  const env = sanitizeStringMap(config.env)

  if (changedField === 'api_key') {
    const apiKey = typeof config.api_key === 'string' ? config.api_key : ''
    if (apiKey) {
      env['GEMINI_API_KEY'] = apiKey
    } else {
      delete env['GEMINI_API_KEY']
    }
  }

  if (changedField === 'base_url') {
    const baseUrl = typeof config.base_url === 'string' ? config.base_url : ''
    if (baseUrl) {
      env['GOOGLE_GEMINI_BASE_URL'] = baseUrl
      env['GEMINI_API_KEY_AUTH_MECHANISM'] = 'bearer'
    } else {
      delete env['GOOGLE_GEMINI_BASE_URL']
      delete env['GEMINI_API_KEY_AUTH_MECHANISM']
    }
  }

  config.env = env
}

const syncGeminiEnvToFields = (config: Record<string, unknown>) => {
  const env = sanitizeStringMap(config.env)

  if (env['GEMINI_API_KEY']) {
    config.api_key = env['GEMINI_API_KEY']
  } else {
    config.api_key = ''
  }

  config.base_url = env['GOOGLE_GEMINI_BASE_URL'] ?? ''
}

const getOpencodeEnvMapping = (
  config: Record<string, unknown>,
): { apiKeyEnv: string; baseUrlEnv?: string } => {
  const provider = typeof config.provider === 'string' ? config.provider : 'openai'
  return OPENCODE_PROVIDER_ENV_MAP[provider] ?? OPENCODE_FALLBACK_MAPPING
}

const syncOpencodeFieldToEnv = (config: Record<string, unknown>, changedField: string) => {
  const env = sanitizeStringMap(config.env)
  const mapping = getOpencodeEnvMapping(config)

  if (changedField === 'provider' || changedField === 'api_key') {
    for (const key of ALL_OPENCODE_API_KEY_ENVS) {
      delete env[key]
    }
    const apiKey = typeof config.api_key === 'string' ? config.api_key : ''
    if (apiKey) {
      env[mapping.apiKeyEnv] = apiKey
    }
  }

  if (changedField === 'provider' || changedField === 'base_url') {
    for (const key of ALL_OPENCODE_BASE_URL_ENVS) {
      delete env[key]
    }
    const baseUrl = typeof config.base_url === 'string' ? config.base_url : ''
    if (baseUrl && mapping.baseUrlEnv) {
      env[mapping.baseUrlEnv] = baseUrl
    }
  }

  config.env = env
}

const syncOpencodeEnvToFields = (config: Record<string, unknown>) => {
  const env = sanitizeStringMap(config.env)

  for (const [providerId, mapping] of Object.entries(OPENCODE_PROVIDER_ENV_MAP)) {
    if (env[mapping.apiKeyEnv]) {
      config.provider = providerId
      config.api_key = env[mapping.apiKeyEnv]
      config.base_url = mapping.baseUrlEnv ? (env[mapping.baseUrlEnv] ?? '') : ''
      return
    }
  }

  config.api_key = ''
  config.base_url = ''
}

const setDraftFieldValue = (fieldKey: string, value: unknown) => {
  const newConfig = { ...draftConfig.value, [fieldKey]: value }

  if (props.cliToolId === 'claude-code') {
    if (fieldKey === 'auth_token' || fieldKey === 'base_url' || fieldKey === 'auth_type') {
      syncClaudeFieldToEnv(newConfig, fieldKey)
    } else if (fieldKey === 'env') {
      syncClaudeEnvToFields(newConfig)
    }
  }

  if (props.cliToolId === 'codex') {
    if (CODEX_SYNC_FIELDS.has(fieldKey)) {
      syncCodexFieldToEnv(newConfig, fieldKey)
    } else if (fieldKey === 'env') {
      syncCodexEnvToFields(newConfig)
    }
  }

  if (props.cliToolId === 'gemini-cli') {
    if (GEMINI_SYNC_FIELDS.has(fieldKey)) {
      syncGeminiFieldToEnv(newConfig, fieldKey)
    } else if (fieldKey === 'env') {
      syncGeminiEnvToFields(newConfig)
    }
  }

  if (props.cliToolId === 'opencode') {
    if (OPENCODE_SYNC_FIELDS.has(fieldKey)) {
      syncOpencodeFieldToEnv(newConfig, fieldKey)
    } else if (fieldKey === 'env') {
      syncOpencodeEnvToFields(newConfig)
    }
  }

  draftConfig.value = sanitizeConfigBySchema(props.cliToolId, newConfig)
}

const validateConfig = (toolId: string, parsed: Record<string, unknown>): string | null => {
  const schema = TOOL_CONFIG_SCHEMAS[toolId]
  if (!schema) {
    return null
  }

  for (const [key, field] of Object.entries(schema)) {
    if (!field.required) {
      continue
    }

    const value = parsed[key]
    if (field.type === 'string' && (typeof value !== 'string' || !value.trim())) {
      return `必填字段缺失：${key}`
    }
  }

  if (toolId === 'codex') {
    const configOverrides = sanitizeStringArray(parsed.config_overrides)
    const invalidOverride = configOverrides.find((item) => !item.includes('='))

    if (invalidOverride) {
      return 'Config Overrides 需使用 key=value 格式'
    }
  }

  if (toolId === 'cursor-agent') {
    const headers = sanitizeStringArray(parsed.headers)
    const invalidHeader = headers.find((item) => !item.includes(':'))

    if (invalidHeader) {
      return 'Headers 需使用 Name: Value 格式'
    }
  }

  return null
}

const migrateClaudeConfig = (seed: Record<string, unknown>): Record<string, unknown> => {
  const migrated = { ...seed }

  if (migrated.api_key && !migrated.auth_token) {
    migrated.auth_token = migrated.api_key
    migrated.auth_type = 'ANTHROPIC_API_KEY'
  }
  delete migrated.api_key

  const env = sanitizeStringMap(migrated.env)
  if (env['ANTHROPIC_AUTH_TOKEN'] && !migrated.auth_token) {
    migrated.auth_type = 'ANTHROPIC_AUTH_TOKEN'
    migrated.auth_token = env['ANTHROPIC_AUTH_TOKEN']
  } else if (env['ANTHROPIC_API_KEY'] && !migrated.auth_token) {
    migrated.auth_type = 'ANTHROPIC_API_KEY'
    migrated.auth_token = env['ANTHROPIC_API_KEY']
  }

  if (env['ANTHROPIC_BASE_URL'] && !migrated.base_url) {
    migrated.base_url = env['ANTHROPIC_BASE_URL']
  }

  return migrated
}

const syncFormValues = () => {
  name.value = props.initialName
  description.value = props.initialDescription
  isDefault.value = props.initialIsDefault
  isApiKeyVisible.value = false
  validationMessage.value = ''

  let seed =
    props.initialConfig &&
    typeof props.initialConfig === 'object' &&
    !Array.isArray(props.initialConfig)
      ? (props.initialConfig as Record<string, unknown>)
      : {}

  if (props.cliToolId === 'claude-code') {
    seed = migrateClaudeConfig(seed)
  }

  const merged = {
    ...createConfigTemplate(props.cliToolId),
    ...seed,
  }

  if (props.cliToolId === 'claude-code') {
    syncClaudeFieldToEnv(merged, 'auth_token')
    syncClaudeFieldToEnv(merged, 'base_url')
  }

  if (props.cliToolId === 'codex') {
    const env = sanitizeStringMap(merged.env)
    if (env['OPENAI_API_KEY'] && !merged.api_key) {
      merged.api_key = env['OPENAI_API_KEY']
    }
    syncCodexFieldToEnv(merged, 'api_key')
  }

  if (props.cliToolId === 'gemini-cli') {
    const env = sanitizeStringMap(merged.env)
    if (env['GEMINI_API_KEY'] && !merged.api_key) {
      merged.api_key = env['GEMINI_API_KEY']
    }
    if (env['GOOGLE_GEMINI_BASE_URL'] && !merged.base_url) {
      merged.base_url = env['GOOGLE_GEMINI_BASE_URL']
    }
    syncGeminiFieldToEnv(merged, 'api_key')
    syncGeminiFieldToEnv(merged, 'base_url')
  }

  if (props.cliToolId === 'opencode') {
    if (!merged.api_key) {
      syncOpencodeEnvToFields(merged)
    }
    syncOpencodeFieldToEnv(merged, 'api_key')
    syncOpencodeFieldToEnv(merged, 'base_url')
  }

  draftConfig.value = sanitizeConfigBySchema(props.cliToolId, merged)
}

const close = () => {
  emit('update:open', false)
}

const submit = () => {
  if (!name.value.trim()) {
    validationMessage.value = '配置名称不能为空'
    return
  }

  const normalizedConfig = sanitizeConfigBySchema(props.cliToolId, draftConfig.value)
  const fieldValidationMessage = validateConfig(props.cliToolId, normalizedConfig)
  if (fieldValidationMessage) {
    validationMessage.value = fieldValidationMessage
    return
  }

  validationMessage.value = ''
  emit('submit', {
    name: name.value.trim(),
    description: description.value,
    isDefault: isDefault.value,
    config: normalizedConfig,
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    syncFormValues()
  },
  { immediate: true },
)

watch(
  () => [
    props.initialName,
    props.initialDescription,
    props.initialIsDefault,
    props.initialConfig,
    props.mode,
    props.cliToolId,
  ],
  () => {
    if (!props.open) {
      return
    }

    syncFormValues()
  },
)


  return reactive({
    CLAUDE_AUTH_ENV_KEYS,
    CODEX_SYNC_FIELDS,
    GEMINI_SYNC_FIELDS,
    OPENCODE_SYNC_FIELDS,
    activeConfigSchema,
    advancedFieldEntries,
    advancedFieldKeys,
    basicFieldEntries,
    claudeDangerouslySkipPermissions,
    claudeExecutionWarning,
    close,
    codexExecutionMode,
    codexExecutionWarning,
    configFieldEntries,
    cursorExecutionWarning,
    cursorForceEnabled,
    cursorTrustEnabled,
    description,
    draftConfig,
    formatFieldLabel,
    geminiExecutionWarning,
    geminiYoloEnabled,
    getBooleanFieldChecked,
    getBooleanFieldStatusHint,
    getBooleanFieldStatusLabel,
    getBooleanNullableFieldValue,
    getClaudeAuthEnvKey,
    getFieldDescription,
    getOpencodeEnvMapping,
    getStringFieldSelectOptions,
    getStringFieldValue,
    getStringInputAutocomplete,
    getStringInputName,
    hiddenFieldKeys,
    isApiKeyVisible,
    isClaudePermissionModeDisabled,
    isCodexSandboxDisabled,
    isDefault,
    migrateClaudeConfig,
    modalTitle,
    name,
    sectionClass,
    setDraftFieldValue,
    shouldShowDefaultOption,
    submit,
    syncClaudeEnvToFields,
    syncClaudeFieldToEnv,
    syncCodexEnvToFields,
    syncCodexFieldToEnv,
    syncFormValues,
    syncGeminiEnvToFields,
    syncGeminiFieldToEnv,
    syncOpencodeEnvToFields,
    syncOpencodeFieldToEnv,
    validateConfig,
    validationMessage,
  })
}
