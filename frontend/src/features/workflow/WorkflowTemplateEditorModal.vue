<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from '@shared/components/select'
import WorkflowPromptTextarea from './WorkflowPromptTextarea.vue'
import WorkflowPromptVariablesHint from './WorkflowPromptVariablesHint.vue'
import { WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX } from './workflow-template-editor.constants'
import type { WorkflowCreateFormState, WorkflowTemplateNodeForm } from './workflow-template-editor.types'

type CliSelectOption = { label: string; value: string; disabled?: boolean }

defineOptions({ name: 'WorkflowTemplateEditorModal' })

const form = defineModel<WorkflowCreateFormState>('form', { required: true })
const workflowEditorActiveNodeIndex = defineModel<number>('workflowEditorActiveNodeIndex', {
  required: true,
})

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    titleId: string
    validationMessage: string
    submittingWorkflowTemplate: boolean
    submitDisabled: boolean
    submitLoadingText: string
    submitIdleText: string
    formatWorkflowNodeTabLabel: (node: WorkflowTemplateNodeForm, index: number) => string
    /** 为 true 时隐藏 Agent CLI / Agent CLI 配置（如平台工作流编辑） */
    hideAgentCli?: boolean
    loadingWorkflowConfiguredCliTools?: boolean
    workflowConfiguredCliTools?: unknown[]
    workflowCliToolSelectOptions?: CliSelectOption[]
    getWorkflowNodeConfigSelectOptions?: (agentCliId: string) => CliSelectOption[]
    isWorkflowNodeConfigLoading?: (agentCliId: string) => boolean
    selectPanelZIndex?: number
    /** 模板信息区副文案；不传则不展示 */
    templateInfoHint?: string
    templateNamePlaceholder?: string
    templateNameLabel?: string
    tabKeyPrefix?: string
    /** 节点定义区副文案；不传则按 hideAgentCli 使用默认文案 */
    nodeDefinitionHint?: string
  }>(),
  {
    hideAgentCli: false,
    loadingWorkflowConfiguredCliTools: false,
    workflowConfiguredCliTools: () => [],
    workflowCliToolSelectOptions: () => [],
    getWorkflowNodeConfigSelectOptions: () => [],
    isWorkflowNodeConfigLoading: () => false,
    selectPanelZIndex: WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX,
    templateNamePlaceholder: '例如：项目发布修复流',
    templateNameLabel: '模板名称',
    tabKeyPrefix: 'workflow-template-editor-node-tab',
  },
)

const resolvedNodeDefinitionHint = computed(() => {
  if (props.nodeDefinitionHint) {
    return props.nodeDefinitionHint
  }
  return props.hideAgentCli
    ? '每个节点可配置 Prompt 与循环等选项；业务线侧再绑定 Agent CLI。'
    : '每个节点可配置 Prompt、Agent CLI 和配置。'
})

const panelZIndex = computed(() => props.selectPanelZIndex ?? WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX)

const activeWorkflowCreateNode = computed(
  () => form.value.nodes[workflowEditorActiveNodeIndex.value] ?? null,
)

function onWorkflowLoopEnabledChange() {
  const node = form.value.nodes[workflowEditorActiveNodeIndex.value]
  if (!node || node.input.loopEnabled) {
    return
  }
  node.maxLoops = 1
  node.input.earlyExitMarkerFileName = ''
  node.input.earlyExitMarkerEnabled = false
}

const emit = defineEmits<{
  close: []
  submit: []
  addNode: []
  removeNode: [index: number]
  nodeCliChange: [node: WorkflowTemplateNodeForm]
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @click.self="emit('close')"
    >
      <section
        class="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 :id="titleId" class="text-sm font-semibold">
            {{ title }}
          </h2>
          <button
            type="button"
            class="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
            aria-label="关闭工作流模板弹窗"
            @click="emit('close')"
          >
            关闭
          </button>
        </header>

        <form
          class="max-h-[calc(92vh-56px)] space-y-4 overflow-auto px-4 py-4"
          @submit.prevent="emit('submit')"
        >
          <section class="space-y-3 rounded-xl border border-border bg-background/60 p-3">
            <div>
              <p class="text-xs font-semibold text-muted-foreground">模板信息</p>
              <p v-if="templateInfoHint" class="mt-1 text-[11px] text-muted-foreground">
                {{ templateInfoHint }}
              </p>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="space-y-1">
                <span class="text-xs font-semibold text-muted-foreground">{{ templateNameLabel }}</span>
                <input
                  v-model="form.name"
                  class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  :placeholder="templateNamePlaceholder"
                  type="text"
                />
              </label>
              <label class="space-y-1">
                <span class="text-xs font-semibold text-muted-foreground">描述</span>
                <input
                  v-model="form.description"
                  class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  placeholder="可选"
                  type="text"
                />
              </label>
            </div>
            <slot name="template-settings" />
          </section>

          <section class="space-y-3 rounded-xl border border-border bg-background/60 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">节点定义</p>
                <p class="mt-1 text-[11px] text-muted-foreground">
                  {{ resolvedNodeDefinitionHint }}
                </p>
              </div>
              <button
                type="button"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-sm"
                @click="emit('addNode')"
              >
                添加节点
              </button>
            </div>

            <div class="space-y-3">
              <div class="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  v-for="(node, index) in form.nodes"
                  :key="`${tabKeyPrefix}-${index}`"
                  type="button"
                  class="inline-flex min-w-0 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition"
                  :class="
                    workflowEditorActiveNodeIndex === index
                      ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  "
                  @click="workflowEditorActiveNodeIndex = index"
                >
                  <span class="text-[11px] font-semibold">节点 {{ index + 1 }}</span>
                  <span class="max-w-[140px] truncate text-xs">
                    {{ formatWorkflowNodeTabLabel(node, index) }}
                  </span>
                </button>
              </div>

              <div
                v-if="activeWorkflowCreateNode"
                class="space-y-3 rounded-2xl border border-border bg-background/80 p-3.5"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p class="text-[11px] font-semibold text-muted-foreground">
                      当前编辑：节点 {{ workflowEditorActiveNodeIndex + 1 }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <label
                      class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground"
                    >
                      <input
                        v-model="activeWorkflowCreateNode.requiresApproval"
                        type="checkbox"
                        class="h-4 w-4"
                      />
                      审批
                    </label>
                    <label
                      class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground"
                    >
                      <input
                        v-model="activeWorkflowCreateNode.requiresArtifact"
                        type="checkbox"
                        class="h-4 w-4"
                      />
                      产物
                    </label>
                    <label
                      class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground"
                    >
                      <input
                        v-model="activeWorkflowCreateNode.input.loopEnabled"
                        type="checkbox"
                        class="h-4 w-4"
                        @change="onWorkflowLoopEnabledChange"
                      />
                      循环
                    </label>
                    <button
                      type="button"
                      class="inline-flex h-8 items-center rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="form.nodes.length <= 1"
                      @click="emit('removeNode', workflowEditorActiveNodeIndex)"
                    >
                      删除当前节点
                    </button>
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <label class="space-y-1 md:col-span-2">
                    <span class="text-[11px] text-muted-foreground">节点名称</span>
                    <input
                      v-model="activeWorkflowCreateNode.name"
                      class="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                      type="text"
                    />
                  </label>

                  <label class="space-y-1 md:col-span-2">
                    <span class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>节点 Prompt</span>
                      <WorkflowPromptVariablesHint variant="popover" size="sm" />
                    </span>
                    <WorkflowPromptTextarea
                      v-model="activeWorkflowCreateNode.input.prompt"
                      class="min-h-[180px]"
                      placeholder="输入该节点的提示词，输入 / 可插入变量"
                    />
                  </label>
                  <template v-if="activeWorkflowCreateNode.input.loopEnabled">
                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">循环次数限制</span>
                      <input
                        v-model.number="activeWorkflowCreateNode.maxLoops"
                        type="number"
                        min="1"
                        class="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                      />
                    </label>

                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">Marker 文件名</span>
                      <input
                        v-model="activeWorkflowCreateNode.input.earlyExitMarkerFileName"
                        class="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                        type="text"
                        placeholder="例如：taskResult（会读取 docs/code/taskResult.md）"
                      />
                    </label>
                  </template>

                  <template v-if="!hideAgentCli">
                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">Agent CLI</span>
                      <AppSelect
                        v-model="activeWorkflowCreateNode.input.agentCliId"
                        aria-label="Agent CLI"
                        :disabled="
                          loadingWorkflowConfiguredCliTools || workflowConfiguredCliTools.length === 0
                        "
                        :options="workflowCliToolSelectOptions"
                        :panel-z-index="panelZIndex"
                        trigger-class="h-8 rounded-lg border-border bg-background px-2.5 text-sm shadow-none"
                        @change="void emit('nodeCliChange', activeWorkflowCreateNode)"
                      />
                    </label>

                    <label class="space-y-1">
                      <span class="text-[11px] text-muted-foreground">Agent CLI 配置</span>
                      <AppSelect
                        v-model="activeWorkflowCreateNode.input.agentCliConfigId"
                        aria-label="Agent CLI 配置"
                        placeholder="请选择 Agent CLI 配置"
                        :disabled="
                          !activeWorkflowCreateNode.input.agentCliId ||
                          isWorkflowNodeConfigLoading(activeWorkflowCreateNode.input.agentCliId)
                        "
                        :options="
                          getWorkflowNodeConfigSelectOptions(activeWorkflowCreateNode.input.agentCliId)
                        "
                        :panel-z-index="panelZIndex"
                        panel-placement="top"
                        trigger-class="h-8 rounded-lg border-border bg-background px-2.5 text-sm shadow-none"
                      />
                    </label>
                  </template>
                </div>
              </div>
            </div>
          </section>

          <p v-if="validationMessage" class="text-sm text-destructive">
            {{ validationMessage }}
          </p>

          <div class="flex justify-end gap-2 border-t border-border pt-3">
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-xs font-semibold text-foreground"
              @click="emit('close')"
            >
              取消
            </button>
            <button
              type="submit"
              class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="submittingWorkflowTemplate || submitDisabled"
            >
              {{ submittingWorkflowTemplate ? submitLoadingText : submitIdleText }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
