<script setup lang="ts">
import AppSelect from '@shared/components/select'
import {
  AGENT_TOOL_CONFIG_SELECT_PANEL_Z_INDEX,
  BOOLEAN_NULLABLE_FIELD_OPTIONS,
} from './agent-tool-config-modal.schema'
import {
  isFieldWide,
  isSecretFieldKey,
  parseStringArrayInput,
  parseStringMapInput,
  toStringArrayInput,
  toStringMapInput,
} from './agent-tool-config-modal.parsing'
import {
  useAgentToolConfigModal,
  type AgentToolConfigModalProps,
  type AgentToolConfigFormPayload,
} from './use-agent-tool-config-modal'

defineOptions({
  name: 'AgentToolConfigModal',
})

const props = defineProps<AgentToolConfigModalProps>()
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'submit', payload: AgentToolConfigFormPayload): void
}>()

const vm = useAgentToolConfigModal(props, emit)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      @keydown.esc.prevent.stop="vm.close"
    >
      <button
        type="button"
        aria-label="关闭 Agent CLI 配置弹窗"
        class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        @click="vm.close"
      />

      <section aria-modal="true" role="dialog" :class="vm.sectionClass">
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-sm font-semibold">{{ vm.modalTitle }}</h2>
          <button
            type="button"
            aria-label="关闭"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            @click="vm.close"
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
          @submit.prevent="vm.submit"
        >
          <section class="space-y-3 rounded-xl border border-border/70 bg-muted/[0.18] p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground"
              >
                {{ props.cliToolLabel }}
              </span>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                :class="
                  vm.isDefault
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'bg-foreground/5 text-muted-foreground'
                "
              >
                {{ vm.isDefault ? '默认配置' : '手动选择' }}
              </span>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="block space-y-1">
                <span class="text-xs font-semibold text-muted-foreground">配置名称</span>
                <input
                  v-model="vm.name"
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
                <AppSelect
                  v-model="vm.isDefault"
                  aria-label="默认配置"
                  :options="[
                    { label: '是', value: true },
                    { label: '否', value: false },
                  ]"
                  :panel-z-index="AGENT_TOOL_CONFIG_SELECT_PANEL_Z_INDEX"
                  trigger-class="h-10 rounded-lg border-border/70 bg-background px-3 text-sm shadow-none"
                />
              </label>
            </div>
          </section>

          <div class="grid gap-3">
            <label class="block space-y-1">
              <span class="text-xs font-semibold text-muted-foreground">描述（可选）</span>
              <input
                v-model="vm.description"
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

            <div v-if="vm.basicFieldEntries.length === 0" class="text-xs text-muted-foreground">
              当前 CLI 暂无可配置字段。
            </div>

            <div v-else class="grid gap-3 md:grid-cols-2">
              <div
                v-for="[fieldKey, field] in vm.basicFieldEntries"
                :key="`basic-${fieldKey}`"
                :class="
                  isFieldWide(fieldKey, field)
                    ? 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3 md:col-span-2'
                    : 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3'
                "
              >
                <label class="text-sm font-medium">{{ vm.formatFieldLabel(fieldKey) }}</label>

                <AppSelect
                  v-if="field.type === 'string' && field.options?.length"
                  :model-value="vm.getStringFieldValue(fieldKey)"
                  :disabled="
                    (fieldKey === 'sandbox' && vm.isCodexSandboxDisabled) ||
                    (fieldKey === 'permission_mode' && vm.isClaudePermissionModeDisabled)
                  "
                  :options="vm.getStringFieldSelectOptions(fieldKey, field)"
                  :aria-label="vm.formatFieldLabel(fieldKey)"
                  :panel-z-index="AGENT_TOOL_CONFIG_SELECT_PANEL_Z_INDEX"
                  trigger-class="h-10 rounded-lg border-border/70 bg-background px-3 text-sm shadow-none"
                  @change="vm.setDraftFieldValue(fieldKey, $event)"
                />

                <textarea
                  v-else-if="field.type === 'string' && field.multiline"
                  :value="vm.getStringFieldValue(fieldKey)"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
                  @input="
                    vm.setDraftFieldValue(fieldKey, ($event.target as HTMLTextAreaElement).value)
                  "
                />

                <div v-else-if="field.type === 'string'" class="relative">
                  <input
                    :type="isSecretFieldKey(fieldKey) && !vm.isApiKeyVisible ? 'password' : 'text'"
                    :value="vm.getStringFieldValue(fieldKey)"
                    :name="vm.getStringInputName(fieldKey)"
                    :autocomplete="vm.getStringInputAutocomplete(fieldKey)"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                    :class="isSecretFieldKey(fieldKey) ? 'pr-10' : ''"
                    @input="vm.setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    v-if="isSecretFieldKey(fieldKey)"
                    type="button"
                    class="absolute inset-y-0 right-2 inline-flex items-center text-xs text-muted-foreground"
                    @click="vm.isApiKeyVisible = !vm.isApiKeyVisible"
                  >
                    {{ vm.isApiKeyVisible ? '隐藏' : '显示' }}
                  </button>
                </div>

                <textarea
                  v-else-if="field.type === 'stringArray'"
                  :value="toStringArrayInput(vm.draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="
                    vm.setDraftFieldValue(
                      fieldKey,
                      parseStringArrayInput(($event.target as HTMLTextAreaElement).value),
                    )
                  "
                />

                <textarea
                  v-else-if="field.type === 'stringMap'"
                  :value="toStringMapInput(vm.draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="
                    vm.setDraftFieldValue(
                      fieldKey,
                      parseStringMapInput(($event.target as HTMLTextAreaElement).value),
                    )
                  "
                />

                <AppSelect
                  v-else-if="field.type === 'booleanNullable'"
                  :model-value="vm.getBooleanNullableFieldValue(fieldKey)"
                  :options="[...BOOLEAN_NULLABLE_FIELD_OPTIONS]"
                  :aria-label="vm.formatFieldLabel(fieldKey)"
                  :panel-z-index="AGENT_TOOL_CONFIG_SELECT_PANEL_Z_INDEX"
                  trigger-class="h-10 rounded-lg border-border/70 bg-background px-3 text-sm shadow-none"
                  @change="vm.setDraftFieldValue(fieldKey, $event)"
                />

                <label
                  v-else
                  class="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition"
                  :class="
                    vm.getBooleanFieldChecked(fieldKey, field)
                      ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                      : 'border-border/70 bg-background hover:border-border/90 hover:bg-muted/20'
                  "
                >
                  <div v-if="fieldKey !== 'dangerously_skip_permissions'" class="space-y-0.5">
                    <span class="font-medium text-foreground">
                      {{ vm.getBooleanFieldStatusLabel(fieldKey, field) }}
                    </span>
                    <p class="text-xs text-muted-foreground">
                      {{ vm.getBooleanFieldStatusHint(fieldKey, field) }}
                    </p>
                  </div>
                  <span class="relative inline-flex h-6 w-11 shrink-0 items-center">
                    <input
                      type="checkbox"
                      class="peer sr-only"
                      :checked="vm.getBooleanFieldChecked(fieldKey, field)"
                      @change="
                        vm.setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).checked)
                      "
                    />
                    <span
                      class="absolute inset-0 rounded-full transition-colors"
                      :class="
                        vm.getBooleanFieldChecked(fieldKey, field)
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
                  {{ fieldKey
                  }}{{
                    vm.getFieldDescription(fieldKey, field)
                      ? ` · ${vm.getFieldDescription(fieldKey, field)}`
                      : ''
                  }}
                </p>
              </div>
            </div>

            <p
              v-if="vm.codexExecutionWarning"
              class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              {{ vm.codexExecutionWarning }}
            </p>
            <p
              v-if="vm.claudeExecutionWarning"
              class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              {{ vm.claudeExecutionWarning }}
            </p>
            <p
              v-if="vm.geminiExecutionWarning"
              class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              {{ vm.geminiExecutionWarning }}
            </p>
            <p
              v-if="vm.cursorExecutionWarning"
              class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              {{ vm.cursorExecutionWarning }}
            </p>
          </section>

          <section
            v-if="vm.advancedFieldEntries.length > 0"
            class="space-y-2 rounded-xl border border-border/70 bg-muted/[0.12] p-3"
          >
            <p class="text-xs font-semibold text-muted-foreground">高级参数</p>

            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="[fieldKey, field] in vm.advancedFieldEntries"
                :key="`advanced-${fieldKey}`"
                :class="
                  isFieldWide(fieldKey, field)
                    ? 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3 md:col-span-2'
                    : 'space-y-2 rounded-lg border border-border/60 bg-background/90 p-3'
                "
              >
                <label class="text-sm font-medium">{{ vm.formatFieldLabel(fieldKey) }}</label>

                <AppSelect
                  v-if="field.type === 'string' && field.options?.length"
                  :model-value="vm.getStringFieldValue(fieldKey)"
                  :options="vm.getStringFieldSelectOptions(fieldKey, field)"
                  :aria-label="vm.formatFieldLabel(fieldKey)"
                  :panel-z-index="AGENT_TOOL_CONFIG_SELECT_PANEL_Z_INDEX"
                  trigger-class="h-10 rounded-lg border-border/70 bg-background px-3 text-sm shadow-none"
                  @change="vm.setDraftFieldValue(fieldKey, $event)"
                />

                <textarea
                  v-else-if="field.type === 'string' && field.multiline"
                  :value="vm.getStringFieldValue(fieldKey)"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
                  @input="
                    vm.setDraftFieldValue(fieldKey, ($event.target as HTMLTextAreaElement).value)
                  "
                />

                <div v-else-if="field.type === 'string'" class="relative">
                  <input
                    :type="isSecretFieldKey(fieldKey) && !vm.isApiKeyVisible ? 'password' : 'text'"
                    :value="vm.getStringFieldValue(fieldKey)"
                    :name="vm.getStringInputName(fieldKey)"
                    :autocomplete="vm.getStringInputAutocomplete(fieldKey)"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    class="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
                    :class="isSecretFieldKey(fieldKey) ? 'pr-10' : ''"
                    @input="vm.setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    v-if="isSecretFieldKey(fieldKey)"
                    type="button"
                    class="absolute inset-y-0 right-2 inline-flex items-center text-xs text-muted-foreground"
                    @click="vm.isApiKeyVisible = !vm.isApiKeyVisible"
                  >
                    {{ vm.isApiKeyVisible ? '隐藏' : '显示' }}
                  </button>
                </div>

                <textarea
                  v-else-if="field.type === 'stringArray'"
                  :value="toStringArrayInput(vm.draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="
                    vm.setDraftFieldValue(
                      fieldKey,
                      parseStringArrayInput(($event.target as HTMLTextAreaElement).value),
                    )
                  "
                />

                <textarea
                  v-else-if="field.type === 'stringMap'"
                  :value="toStringMapInput(vm.draftConfig[fieldKey])"
                  class="min-h-24 w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground"
                  @input="
                    vm.setDraftFieldValue(
                      fieldKey,
                      parseStringMapInput(($event.target as HTMLTextAreaElement).value),
                    )
                  "
                />

                <AppSelect
                  v-else-if="field.type === 'booleanNullable'"
                  :model-value="vm.getBooleanNullableFieldValue(fieldKey)"
                  :options="[...BOOLEAN_NULLABLE_FIELD_OPTIONS]"
                  :aria-label="vm.formatFieldLabel(fieldKey)"
                  :panel-z-index="AGENT_TOOL_CONFIG_SELECT_PANEL_Z_INDEX"
                  trigger-class="h-10 rounded-lg border-border/70 bg-background px-3 text-sm shadow-none"
                  @change="vm.setDraftFieldValue(fieldKey, $event)"
                />

                <label
                  v-else
                  class="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition"
                  :class="
                    vm.getBooleanFieldChecked(fieldKey, field)
                      ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                      : 'border-border/70 bg-background hover:border-border/90 hover:bg-muted/20'
                  "
                >
                  <div v-if="fieldKey !== 'dangerously_skip_permissions'" class="space-y-0.5">
                    <span class="font-medium text-foreground">
                      {{ vm.getBooleanFieldStatusLabel(fieldKey, field) }}
                    </span>
                    <p class="text-xs text-muted-foreground">
                      {{ vm.getBooleanFieldStatusHint(fieldKey, field) }}
                    </p>
                  </div>
                  <span class="relative inline-flex h-6 w-11 shrink-0 items-center">
                    <input
                      type="checkbox"
                      class="peer sr-only"
                      :checked="vm.getBooleanFieldChecked(fieldKey, field)"
                      @change="
                        vm.setDraftFieldValue(fieldKey, ($event.target as HTMLInputElement).checked)
                      "
                    />
                    <span
                      class="absolute inset-0 rounded-full transition-colors"
                      :class="
                        vm.getBooleanFieldChecked(fieldKey, field)
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
                  {{ fieldKey
                  }}{{
                    vm.getFieldDescription(fieldKey, field)
                      ? ` · ${vm.getFieldDescription(fieldKey, field)}`
                      : ''
                  }}
                </p>
              </div>
            </div>
          </section>

          <p v-if="vm.validationMessage" class="text-sm text-destructive">{{ vm.validationMessage }}</p>
          <p v-else-if="props.errorMessage" class="text-sm text-destructive">
            {{ props.errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              @click="vm.close"
            >
              取消
            </button>
            <button
              type="submit"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="props.submitting"
            >
              {{
                props.submitting ? '保存中...' : props.mode === 'create' ? '创建配置' : '保存修改'
              }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
