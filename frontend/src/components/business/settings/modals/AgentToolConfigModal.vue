<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type AgentToolConfigFormPayload = {
  name: string
  description: string
  isDefault: boolean
  config: Record<string, unknown>
}

type ConfigFieldType = 'string' | 'stringArray' | 'stringMap' | 'boolean' | 'booleanNullable'

type ConfigFieldOption = {
  value: string
  label: string
}

type ConfigFieldSchema = {
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

const TOOL_CONFIG_SCHEMAS: Record<string, Record<string, ConfigFieldSchema>> = {
  'claude-code': {
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
    append_prompt: { type: 'string', multiline: true },
    model: { type: 'string' },
    yolo: { type: 'booleanNullable' },
    resume: { type: 'string' },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
  opencode: {
    append_prompt: { type: 'string', multiline: true },
    model: { type: 'string' },
    variant: { type: 'string' },
    agent: { type: 'string' },
    continue: { type: 'booleanNullable' },
    session: { type: 'string' },
    auto_approve: { type: 'boolean', defaultValue: true },
    auto_compact: { type: 'boolean', defaultValue: true },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
}

const ADVANCED_FIELDS_BY_TOOL: Record<string, Set<string>> = {
  'claude-code': new Set([
    'allowed_tools',
    'disallowed_tools',
    'settings',
    'mcp_config',
    'env',
  ]),
  codex: new Set([
    'config_overrides',
    'env',
  ]),
  'cursor-agent': new Set(['headers', 'approve_mcps', 'env']),
  'gemini-cli': new Set(['resume', 'base_command_override', 'additional_params', 'env']),
  opencode: new Set([
    'variant',
    'continue',
    'session',
    'auto_compact',
    'base_command_override',
    'additional_params',
    'env',
  ]),
}

const props = defineProps<{
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
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: AgentToolConfigFormPayload): void
}>()

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

const basicFieldEntries = computed(() => {
  return configFieldEntries.value.filter(([fieldKey]) => {
    if (advancedFieldKeys.value.has(fieldKey)) {
      return false
    }

    if (
      props.cliToolId === 'claude-code' &&
      fieldKey === 'permission_mode' &&
      claudeDangerouslySkipPermissions.value
    ) {
      return false
    }

    return true
  })
})

const advancedFieldEntries = computed(() => {
  return configFieldEntries.value.filter(([fieldKey]) => advancedFieldKeys.value.has(fieldKey))
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

const sanitizeStringMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (accumulator, [key, item]) => {
      if (typeof item === 'string') {
        accumulator[key] = item
      }
      return accumulator
    },
    {},
  )
}

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const formatFieldLabel = (key: string): string => {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const parseStringArrayInput = (value: string): string[] => {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const toStringArrayInput = (value: unknown): string => {
  return sanitizeStringArray(value).join('\n')
}

const parseStringMapInput = (value: string): Record<string, string> => {
  const result: Record<string, string> = {}

  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      result[line] = ''
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (!key) {
      continue
    }

    result[key] = line.slice(separatorIndex + 1)
  }

  return result
}

const toStringMapInput = (value: unknown): string => {
  return Object.entries(sanitizeStringMap(value))
    .map(([key, item]) => `${key}=${item}`)
    .join('\n')
}

const sanitizeFieldByType = (
  type: ConfigFieldType,
  value: unknown,
  defaultValue?: unknown,
): unknown => {
  if (type === 'string') {
    return typeof value === 'string' ? value : typeof defaultValue === 'string' ? defaultValue : ''
  }

  if (type === 'stringArray') {
    return sanitizeStringArray(value)
  }

  if (type === 'stringMap') {
    return sanitizeStringMap(value)
  }

  if (type === 'boolean') {
    if (typeof value === 'boolean') {
      return value
    }

    if (typeof defaultValue === 'boolean') {
      return defaultValue
    }

    return false
  }

  if (type === 'booleanNullable') {
    return typeof value === 'boolean' ? value : null
  }

  return value
}

const normalizeConfigByTool = (
  toolId: string,
  config: Record<string, unknown>,
): Record<string, unknown> => {
  if (toolId === 'codex') {
    const executionMode =
      typeof config.execution_mode === 'string' ? config.execution_mode : ''

    if (executionMode !== 'standard') {
      return {
        ...config,
        sandbox: '',
      }
    }

    return config
  }

  if (toolId === 'claude-code' && config.dangerously_skip_permissions === true) {
    return {
      ...config,
      permission_mode: '',
    }
  }

  return config
}

const createConfigTemplate = (toolId: string): Record<string, unknown> => {
  const schema = TOOL_CONFIG_SCHEMAS[toolId]
  if (!schema) {
    return {}
  }

  return Object.entries(schema).reduce<Record<string, unknown>>((accumulator, [key, field]) => {
    accumulator[key] = sanitizeFieldByType(field.type, undefined, field.defaultValue)
    return accumulator
  }, {})
}

const sanitizeConfigBySchema = (
  toolId: string,
  parsed: Record<string, unknown>,
): Record<string, unknown> => {
  const schema = TOOL_CONFIG_SCHEMAS[toolId]
  if (!schema) {
    return parsed
  }

  const sanitized = Object.entries(schema).reduce<Record<string, unknown>>((accumulator, [key, field]) => {
    accumulator[key] = sanitizeFieldByType(field.type, parsed[key], field.defaultValue)
    return accumulator
  }, {})

  return normalizeConfigByTool(toolId, sanitized)
}

const isFieldWide = (fieldKey: string, field: ConfigFieldSchema): boolean => {
  return (
    field.type === 'stringArray' ||
    field.type === 'stringMap' ||
    (field.type === 'string' && Boolean(field.multiline)) ||
    fieldKey === 'api_key'
  )
}

const getFieldDescription = (fieldKey: string, field: ConfigFieldSchema): string => {
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

  return true
}

const getStringFieldValue = (fieldKey: string): string => {
  const value = draftConfig.value[fieldKey]
  return typeof value === 'string' ? value : ''
}

const getBooleanNullableSelectValue = (fieldKey: string): string => {
  const value = draftConfig.value[fieldKey]

  if (value === true) {
    return 'true'
  }

  if (value === false) {
    return 'false'
  }

  return 'null'
}

const getBooleanFieldChecked = (fieldKey: string, field: ConfigFieldSchema): boolean => {
  return (draftConfig.value[fieldKey] ?? field.defaultValue) === true
}

const getBooleanFieldStatusLabel = (
  fieldKey: string,
  field: ConfigFieldSchema,
): string => {
  if (fieldKey === 'dangerously_skip_permissions') {
    return 'Dangerously Skip Permissions'
  }

  return getBooleanFieldChecked(fieldKey, field) ? '已启用' : '已禁用'
}

const getBooleanFieldStatusHint = (
  fieldKey: string,
  field: ConfigFieldSchema,
): string => {
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
  return fieldKey === 'api_key' ? 'new-password' : 'off'
}

const setDraftFieldValue = (fieldKey: string, value: unknown) => {
  draftConfig.value = sanitizeConfigBySchema(props.cliToolId, {
    ...draftConfig.value,
    [fieldKey]: value,
  })
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

const syncFormValues = () => {
  name.value = props.initialName
  description.value = props.initialDescription
  isDefault.value = props.initialIsDefault
  isApiKeyVisible.value = false
  validationMessage.value = ''

  const seed =
    props.initialConfig && typeof props.initialConfig === 'object' && !Array.isArray(props.initialConfig)
      ? (props.initialConfig as Record<string, unknown>)
      : {}

  draftConfig.value = sanitizeConfigBySchema(props.cliToolId, {
    ...createConfigTemplate(props.cliToolId),
    ...seed,
  })
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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      @keydown.esc.prevent.stop="close"
    >
      <button
        type="button"
        aria-label="关闭 Agent CLI 配置弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="close"
      />

      <section
        aria-modal="true"
        role="dialog"
        :class="sectionClass"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold">{{ modalTitle }}</h2>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <form
          class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          autocomplete="off"
          @submit.prevent="submit"
        >
          <section class="space-y-3 rounded-xl border border-border/70 bg-muted/[0.18] p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
                {{ props.cliToolLabel }}
              </span>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                :class="
                  isDefault
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'bg-foreground/5 text-muted-foreground'
                "
              >
                {{ isDefault ? '默认配置' : '手动选择' }}
              </span>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="block space-y-1">
                <span class="text-xs font-semibold text-muted-foreground">配置名称</span>
                <input
                  v-model="name"
                  type="text"
                  name="agent-cli-config-name"
                  autocomplete="off"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                  placeholder="例如 default"
                />
              </label>

              <label class="block space-y-1">
                <span class="text-xs font-semibold text-muted-foreground">默认配置</span>
                <select
                  v-model="isDefault"
                  class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                >
                  <option :value="true">是</option>
                  <option :value="false">否</option>
                </select>
              </label>
            </div>
          </section>

          <div class="grid gap-3">
            <label class="block space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
              <input
                v-model="description"
                type="text"
                name="agent-cli-config-description"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                placeholder="例如 面向 retail 业务线"
              />
            </label>
          </div>

          <section class="space-y-2 rounded-xl border border-border/70 bg-muted/[0.12] p-3">
            <p class="text-xs font-semibold text-muted-foreground">基础参数</p>

            <div v-if="basicFieldEntries.length === 0" class="text-xs text-muted-foreground">
              当前 CLI 暂无可配置字段。
            </div>

            <div v-else class="grid gap-3 md:grid-cols-2">
              <div
                v-for="[fieldKey, field] in basicFieldEntries"
                :key="`basic-${fieldKey}`"
                :class="
                  isFieldWide(fieldKey, field)
                    ? 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3 md:col-span-2'
                    : 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3'
                "
              >
                <label class="text-sm font-medium">{{ formatFieldLabel(fieldKey) }}</label>

                <select
                  v-if="field.type === 'string' && field.options?.length"
                  :value="getStringFieldValue(fieldKey)"
                  :disabled="
                    (fieldKey === 'sandbox' && isCodexSandboxDisabled) ||
                    (fieldKey === 'permission_mode' && isClaudePermissionModeDisabled)
                  "
                  class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-if="shouldShowDefaultOption(fieldKey)" value="">Default</option>
                  <option v-for="option in field.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>

                <textarea
                  v-else-if="field.type === 'string' && field.multiline"
                  :value="getStringFieldValue(fieldKey)"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
                  @input="setDraftFieldValue(fieldKey, ($event.target as HTMLTextAreaElement).value)"
                />

                <div v-else-if="field.type === 'string'" class="relative">
                  <input
                    :type="fieldKey === 'api_key' && !isApiKeyVisible ? 'password' : 'text'"
                    :value="getStringFieldValue(fieldKey)"
                    :name="getStringInputName(fieldKey)"
                    :autocomplete="getStringInputAutocomplete(fieldKey)"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                    :class="fieldKey === 'api_key' ? 'pr-10' : ''"
                    @input="setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    v-if="fieldKey === 'api_key'"
                    type="button"
                    class="absolute inset-y-0 right-2 inline-flex items-center text-xs text-muted-foreground"
                    @click="isApiKeyVisible = !isApiKeyVisible"
                  >
                    {{ isApiKeyVisible ? '隐藏' : '显示' }}
                  </button>
                </div>

                <textarea
                  v-else-if="field.type === 'stringArray'"
                  :value="toStringArrayInput(draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringArrayInput(($event.target as HTMLTextAreaElement).value))"
                />

                <textarea
                  v-else-if="field.type === 'stringMap'"
                  :value="toStringMapInput(draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringMapInput(($event.target as HTMLTextAreaElement).value))"
                />

                <select
                  v-else-if="field.type === 'booleanNullable'"
                  :value="getBooleanNullableSelectValue(fieldKey)"
                  class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value === 'null' ? null : ($event.target as HTMLSelectElement).value === 'true')"
                >
                  <option value="null">Default</option>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>

                <label
                  v-else
                  class="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition"
                  :class="
                    getBooleanFieldChecked(fieldKey, field)
                      ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                      : 'border-border/70 bg-background hover:border-border/90 hover:bg-muted/20'
                  "
                >
                  <div v-if="fieldKey !== 'dangerously_skip_permissions'" class="space-y-0.5">
                    <span class="font-medium text-foreground">
                      {{ getBooleanFieldStatusLabel(fieldKey, field) }}
                    </span>
                    <p class="text-xs text-muted-foreground">
                      {{ getBooleanFieldStatusHint(fieldKey, field) }}
                    </p>
                  </div>
                  <span class="relative inline-flex h-6 w-11 shrink-0 items-center">
                    <input
                      type="checkbox"
                      class="peer sr-only"
                      :checked="getBooleanFieldChecked(fieldKey, field)"
                      @change="setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).checked)"
                    />
                    <span
                      class="absolute inset-0 rounded-full transition-colors"
                      :class="
                        getBooleanFieldChecked(fieldKey, field)
                          ? 'bg-emerald-500'
                          : 'bg-muted-foreground/30'
                      "
                    />
                    <span
                      class="absolute left-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5"
                    />
                  </span>
                </label>

                <p class="text-[11px] text-muted-foreground">
                  {{ fieldKey }}{{ getFieldDescription(fieldKey, field) ? ` · ${getFieldDescription(fieldKey, field)}` : '' }}
                </p>
              </div>
            </div>

            <p
              v-if="codexExecutionWarning"
              class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              {{ codexExecutionWarning }}
            </p>
            <p
              v-if="claudeExecutionWarning"
              class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              {{ claudeExecutionWarning }}
            </p>
            <p
              v-if="cursorExecutionWarning"
              class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              {{ cursorExecutionWarning }}
            </p>
          </section>

          <section v-if="advancedFieldEntries.length > 0" class="space-y-2 rounded-xl border border-border/70 bg-muted/[0.12] p-3">
            <p class="text-xs font-semibold text-muted-foreground">高级参数</p>

            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="[fieldKey, field] in advancedFieldEntries"
                :key="`advanced-${fieldKey}`"
                :class="
                  isFieldWide(fieldKey, field)
                    ? 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3 md:col-span-2'
                    : 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3'
                "
              >
                <label class="text-sm font-medium">{{ formatFieldLabel(fieldKey) }}</label>

                <select
                  v-if="field.type === 'string' && field.options?.length"
                  :value="getStringFieldValue(fieldKey)"
                  class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-if="shouldShowDefaultOption(fieldKey)" value="">Default</option>
                  <option v-for="option in field.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>

                <textarea
                  v-else-if="field.type === 'string' && field.multiline"
                  :value="getStringFieldValue(fieldKey)"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
                  @input="setDraftFieldValue(fieldKey, ($event.target as HTMLTextAreaElement).value)"
                />

                <div v-else-if="field.type === 'string'" class="relative">
                  <input
                    :type="fieldKey === 'api_key' && !isApiKeyVisible ? 'password' : 'text'"
                    :value="getStringFieldValue(fieldKey)"
                    :name="getStringInputName(fieldKey)"
                    :autocomplete="getStringInputAutocomplete(fieldKey)"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                    :class="fieldKey === 'api_key' ? 'pr-10' : ''"
                    @input="setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    v-if="fieldKey === 'api_key'"
                    type="button"
                    class="absolute inset-y-0 right-2 inline-flex items-center text-xs text-muted-foreground"
                    @click="isApiKeyVisible = !isApiKeyVisible"
                  >
                    {{ isApiKeyVisible ? '隐藏' : '显示' }}
                  </button>
                </div>

                <textarea
                  v-else-if="field.type === 'stringArray'"
                  :value="toStringArrayInput(draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringArrayInput(($event.target as HTMLTextAreaElement).value))"
                />

                <textarea
                  v-else-if="field.type === 'stringMap'"
                  :value="toStringMapInput(draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringMapInput(($event.target as HTMLTextAreaElement).value))"
                />

                <select
                  v-else-if="field.type === 'booleanNullable'"
                  :value="getBooleanNullableSelectValue(fieldKey)"
                  class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value === 'null' ? null : ($event.target as HTMLSelectElement).value === 'true')"
                >
                  <option value="null">Default</option>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>

                <label
                  v-else
                  class="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition"
                  :class="
                    getBooleanFieldChecked(fieldKey, field)
                      ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                      : 'border-border/70 bg-background hover:border-border/90 hover:bg-muted/20'
                  "
                >
                  <div v-if="fieldKey !== 'dangerously_skip_permissions'" class="space-y-0.5">
                    <span class="font-medium text-foreground">
                      {{ getBooleanFieldStatusLabel(fieldKey, field) }}
                    </span>
                    <p class="text-xs text-muted-foreground">
                      {{ getBooleanFieldStatusHint(fieldKey, field) }}
                    </p>
                  </div>
                  <span class="relative inline-flex h-6 w-11 shrink-0 items-center">
                    <input
                      type="checkbox"
                      class="peer sr-only"
                      :checked="getBooleanFieldChecked(fieldKey, field)"
                      @change="setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).checked)"
                    />
                    <span
                      class="absolute inset-0 rounded-full transition-colors"
                      :class="
                        getBooleanFieldChecked(fieldKey, field)
                          ? 'bg-emerald-500'
                          : 'bg-muted-foreground/30'
                      "
                    />
                    <span
                      class="absolute left-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5"
                    />
                  </span>
                </label>

                <p class="text-[11px] text-muted-foreground">
                  {{ fieldKey }}{{ getFieldDescription(fieldKey, field) ? ` · ${getFieldDescription(fieldKey, field)}` : '' }}
                </p>
              </div>
            </div>
          </section>

          <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">{{ props.errorMessage }}</p>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="close"
            >
              取消
            </button>
            <button
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting"
            >
              {{ props.submitting ? '保存中...' : props.mode === 'create' ? '创建配置' : '保存修改' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
