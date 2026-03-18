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
  { value: 'auto', label: 'Auto' },
  { value: 'read-only', label: 'Read Only' },
  { value: 'workspace-write', label: 'Workspace Write' },
  { value: 'danger-full-access', label: 'Danger Full Access' },
]

const CODEX_APPROVAL_OPTIONS: ConfigFieldOption[] = [
  { value: 'unless-trusted', label: 'Unless Trusted' },
  { value: 'on-failure', label: 'On Failure' },
  { value: 'on-request', label: 'On Request' },
  { value: 'never', label: 'Never' },
]

const CODEX_REASONING_EFFORT_OPTIONS: ConfigFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
]

const CODEX_REASONING_SUMMARY_OPTIONS: ConfigFieldOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'none', label: 'None' },
]

const CODEX_REASONING_SUMMARY_FORMAT_OPTIONS: ConfigFieldOption[] = [
  { value: 'none', label: 'None' },
  { value: 'experimental', label: 'Experimental' },
]

const TOOL_CONFIG_SCHEMAS: Record<string, Record<string, ConfigFieldSchema>> = {
  'claude-code': {
    append_prompt: { type: 'string', multiline: true },
    claude_code_router: { type: 'booleanNullable' },
    plan: { type: 'booleanNullable' },
    approvals: { type: 'booleanNullable' },
    model: { type: 'string' },
    dangerously_skip_permissions: { type: 'booleanNullable' },
    disable_api_key: { type: 'booleanNullable' },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
  codex: {
    append_prompt: { type: 'string', multiline: true },
    sandbox: { type: 'string', options: CODEX_SANDBOX_OPTIONS },
    ask_for_approval: { type: 'string', options: CODEX_APPROVAL_OPTIONS },
    oss: { type: 'booleanNullable' },
    model: { type: 'string' },
    model_reasoning_effort: { type: 'string', options: CODEX_REASONING_EFFORT_OPTIONS },
    model_reasoning_summary: { type: 'string', options: CODEX_REASONING_SUMMARY_OPTIONS },
    model_reasoning_summary_format: {
      type: 'string',
      options: CODEX_REASONING_SUMMARY_FORMAT_OPTIONS,
    },
    profile: { type: 'string' },
    base_instructions: { type: 'string', multiline: true },
    include_apply_patch_tool: { type: 'booleanNullable' },
    model_provider: { type: 'string' },
    compact_prompt: { type: 'string', multiline: true },
    developer_instructions: { type: 'string', multiline: true },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
    env: { type: 'stringMap' },
  },
  'cursor-agent': {
    append_prompt: { type: 'string', multiline: true },
    api_key: { type: 'string' },
    force: { type: 'booleanNullable' },
    model: { type: 'string', defaultValue: 'auto' },
    base_command_override: { type: 'string' },
    additional_params: { type: 'stringArray' },
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
    'claude_code_router',
    'approvals',
    'dangerously_skip_permissions',
    'disable_api_key',
    'base_command_override',
    'additional_params',
    'env',
  ]),
  codex: new Set([
    'model_reasoning_effort',
    'model_reasoning_summary',
    'model_reasoning_summary_format',
    'base_instructions',
    'include_apply_patch_tool',
    'model_provider',
    'compact_prompt',
    'developer_instructions',
    'base_command_override',
    'additional_params',
    'env',
  ]),
  'cursor-agent': new Set(['base_command_override', 'additional_params', 'env']),
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
  return configFieldEntries.value.filter(([fieldKey]) => !advancedFieldKeys.value.has(fieldKey))
})

const advancedFieldEntries = computed(() => {
  return configFieldEntries.value.filter(([fieldKey]) => advancedFieldKeys.value.has(fieldKey))
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

  return Object.entries(schema).reduce<Record<string, unknown>>((accumulator, [key, field]) => {
    accumulator[key] = sanitizeFieldByType(field.type, parsed[key], field.defaultValue)
    return accumulator
  }, {})
}

const isFieldWide = (fieldKey: string, field: ConfigFieldSchema): boolean => {
  return (
    field.type === 'stringArray' ||
    field.type === 'stringMap' ||
    (field.type === 'string' && Boolean(field.multiline)) ||
    fieldKey === 'api_key'
  )
}

const getFieldDescription = (field: ConfigFieldSchema): string => {
  if (field.description) {
    return field.description
  }

  if (field.type === 'stringArray') {
    return '每行一个参数'
  }

  if (field.type === 'stringMap') {
    return '每行使用 KEY=VALUE'
  }

  return ''
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
        class="relative z-10 my-3 flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:my-0 sm:max-h-[calc(100vh-3rem)]"
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
          class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
          autocomplete="off"
          @submit.prevent="submit"
        >
          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">当前 CLI</span>
            <div
              class="flex h-10 items-center rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              {{ props.cliToolLabel }}（{{ props.cliToolId }}）
            </div>
          </label>

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
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如 default"
              />
            </label>

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
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="例如 面向 retail 业务线"
              />
            </label>
          </div>

          <label class="block space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">默认配置</span>
            <select
              v-model="isDefault"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option :value="true">是</option>
              <option :value="false">否</option>
            </select>
          </label>

          <section class="space-y-2 rounded-xl border border-border bg-background/70 p-3">
            <p class="text-xs font-semibold text-muted-foreground">基础参数</p>

            <div v-if="basicFieldEntries.length === 0" class="text-xs text-muted-foreground">
              当前 CLI 暂无可配置字段。
            </div>

            <div v-else class="grid gap-3 md:grid-cols-2">
              <div
                v-for="[fieldKey, field] in basicFieldEntries"
                :key="`basic-${fieldKey}`"
                :class="isFieldWide(fieldKey, field) ? 'space-y-2 md:col-span-2' : 'space-y-2'"
              >
                <label class="text-sm font-medium">{{ formatFieldLabel(fieldKey) }}</label>

                <select
                  v-if="field.type === 'string' && field.options?.length"
                  :value="getStringFieldValue(fieldKey)"
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Default</option>
                  <option v-for="option in field.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>

                <textarea
                  v-else-if="field.type === 'string' && field.multiline"
                  :value="getStringFieldValue(fieldKey)"
                  class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
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
                    class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
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
                  class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringArrayInput(($event.target as HTMLTextAreaElement).value))"
                />

                <textarea
                  v-else-if="field.type === 'stringMap'"
                  :value="toStringMapInput(draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringMapInput(($event.target as HTMLTextAreaElement).value))"
                />

                <select
                  v-else-if="field.type === 'booleanNullable'"
                  :value="getBooleanNullableSelectValue(fieldKey)"
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value === 'null' ? null : ($event.target as HTMLSelectElement).value === 'true')"
                >
                  <option value="null">Default</option>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>

                <label v-else class="inline-flex h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    :checked="getBooleanFieldChecked(fieldKey, field)"
                    @change="setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).checked)"
                  />
                  <span>{{ getBooleanFieldChecked(fieldKey, field) ? 'Enabled' : 'Disabled' }}</span>
                </label>

                <p class="text-[11px] text-muted-foreground">
                  {{ fieldKey }}{{ getFieldDescription(field) ? ` · ${getFieldDescription(field)}` : '' }}
                </p>
              </div>
            </div>
          </section>

          <section v-if="advancedFieldEntries.length > 0" class="space-y-2 rounded-xl border border-border bg-background/70 p-3">
            <p class="text-xs font-semibold text-muted-foreground">高级参数</p>

            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="[fieldKey, field] in advancedFieldEntries"
                :key="`advanced-${fieldKey}`"
                :class="isFieldWide(fieldKey, field) ? 'space-y-2 md:col-span-2' : 'space-y-2'"
              >
                <label class="text-sm font-medium">{{ formatFieldLabel(fieldKey) }}</label>

                <select
                  v-if="field.type === 'string' && field.options?.length"
                  :value="getStringFieldValue(fieldKey)"
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Default</option>
                  <option v-for="option in field.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>

                <textarea
                  v-else-if="field.type === 'string' && field.multiline"
                  :value="getStringFieldValue(fieldKey)"
                  class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
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
                    class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
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
                  class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringArrayInput(($event.target as HTMLTextAreaElement).value))"
                />

                <textarea
                  v-else-if="field.type === 'stringMap'"
                  :value="toStringMapInput(draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="setDraftFieldValue(fieldKey, parseStringMapInput(($event.target as HTMLTextAreaElement).value))"
                />

                <select
                  v-else-if="field.type === 'booleanNullable'"
                  :value="getBooleanNullableSelectValue(fieldKey)"
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  @change="setDraftFieldValue(fieldKey, ($event.target as HTMLSelectElement).value === 'null' ? null : ($event.target as HTMLSelectElement).value === 'true')"
                >
                  <option value="null">Default</option>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>

                <label v-else class="inline-flex h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    :checked="getBooleanFieldChecked(fieldKey, field)"
                    @change="setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).checked)"
                  />
                  <span>{{ getBooleanFieldChecked(fieldKey, field) ? 'Enabled' : 'Disabled' }}</span>
                </label>

                <p class="text-[11px] text-muted-foreground">
                  {{ fieldKey }}{{ getFieldDescription(field) ? ` · ${getFieldDescription(field)}` : '' }}
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
