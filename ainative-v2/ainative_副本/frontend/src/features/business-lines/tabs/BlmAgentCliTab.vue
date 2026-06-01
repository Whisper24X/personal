<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from '@shared/components/select'
import type { AgentToolConfig } from '@/api/business-lines'
import type { SupportedCliToolId } from '../blm-workflow-template.types'

defineOptions({ name: 'BlmAgentCliTab' })

const activeAgentCliToolId = defineModel<SupportedCliToolId>('activeAgentCliToolId', {
  required: true,
})

const defaultAgentCliToolDraft = defineModel<SupportedCliToolId | ''>('defaultAgentCliToolDraft', {
  required: true,
})

const props = defineProps<{
  activeLineId: string
  loadingAgentToolConfigs: boolean
  agentToolConfigs: AgentToolConfig[]
  activeAgentCliToolLabel: string
  defaultAgentCliToolId: SupportedCliToolId | ''
  defaultAgentCliToolOptions: Array<{ label: string; value: SupportedCliToolId }>
  canViewAgentToolConfigList: boolean
  canCreateAgentToolConfig: boolean
  canUpdateAgentToolConfig: boolean
  canSetDefaultAgentToolConfig: boolean
  canSaveDefaultAgentCliTool: boolean
  canDeleteAgentToolConfig: boolean
  canTestAgentToolConfig: boolean
  submittingAgentToolConfig: boolean
  savingDefaultAgentCliTool: boolean
  deletingAgentToolConfigId: string
  testingAgentToolConfigId: string
  supportedCliTools: Array<{ id: SupportedCliToolId; label: string }>
  formatDate: (value?: string) => string
}>()

const emit = defineEmits<{
  refresh: []
  'save-default-tool': []
  'clear-default-tool': []
  'create-config': []
  'edit-config': [config: AgentToolConfig]
  'set-default': [config: AgentToolConfig]
  'remove-config': [configId: string]
  'test-config': [config: AgentToolConfig]
}>()

const currentDefaultAgentCliToolLabel = computed(() => {
  if (!props.defaultAgentCliToolId) {
    return '未设置'
  }

  return (
    props.supportedCliTools.find((tool) => tool.id === props.defaultAgentCliToolId)?.label ??
    props.defaultAgentCliToolId
  )
})
</script>

<template>
  <section class="space-y-4">
    <article
      v-if="props.activeLineId && props.canViewAgentToolConfigList"
      class="panel-card p-5"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">默认 Agent CLI</p>
          <p class="mt-1 text-xs text-muted-foreground">
            任务创建、Goal 创建和工作流节点新建时会优先选中这个工具。
          </p>
        </div>
        <div class="text-sm font-semibold text-foreground">
          {{ currentDefaultAgentCliToolLabel }}
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <AppSelect
          v-model="defaultAgentCliToolDraft"
          aria-label="默认 Agent CLI"
          :options="props.defaultAgentCliToolOptions"
          :disabled="
            !props.activeLineId ||
            props.defaultAgentCliToolOptions.length === 0 ||
            !props.canSetDefaultAgentToolConfig ||
            props.savingDefaultAgentCliTool
          "
          :panel-z-index="140"
          size="md"
          trigger-class="min-w-[220px] rounded-lg border-border bg-background text-sm"
        />
        <button
          v-if="props.canSetDefaultAgentToolConfig"
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="
            !props.canSaveDefaultAgentCliTool || props.savingDefaultAgentCliTool
          "
          @click="emit('save-default-tool')"
        >
          {{ props.savingDefaultAgentCliTool ? '保存中...' : '保存' }}
        </button>
        <button
          v-if="props.canSetDefaultAgentToolConfig"
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="
            props.savingDefaultAgentCliTool ||
            (!props.defaultAgentCliToolId && !defaultAgentCliToolDraft)
          "
          @click="emit('clear-default-tool')"
        >
          清空
        </button>
      </div>

      <p
        v-if="!props.canSetDefaultAgentToolConfig"
        class="mt-3 text-xs text-muted-foreground"
      >
        当前账号仅有查看权限，无法修改默认 Agent CLI。
      </p>
      <p
        v-else-if="props.defaultAgentCliToolOptions.length === 0"
        class="mt-3 text-xs text-muted-foreground"
      >
        当前业务线暂无已配置的 Agent CLI 工具，创建配置后才能设置默认工具。
      </p>
    </article>

    <article class="panel-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">Agent CLI 配置</p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{
              props.canViewAgentToolConfigList
                ? '业务线统一维护多套 Agent CLI 配置，供同业务线项目复用。'
                : '当前账号暂无查看 Agent CLI 配置列表权限。'
            }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="props.canViewAgentToolConfigList"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            :disabled="!props.activeLineId"
            @click="emit('refresh')"
          >
            刷新
          </button>
          <button
            v-if="props.canCreateAgentToolConfig"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
            :disabled="!props.activeLineId"
            @click="emit('create-config')"
          >
            新建配置
          </button>
        </div>
      </div>

      <div
        v-if="!props.activeLineId"
        class="mt-4 rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
      >
        请先选择业务线。
      </div>
      <div
        v-else-if="!props.canViewAgentToolConfigList"
        class="mt-4 rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
      >
        暂无查看 Agent CLI 配置列表权限。
      </div>
      <template v-else>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="tool in props.supportedCliTools"
            :key="tool.id"
            type="button"
            class="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
            :class="
              activeAgentCliToolId === tool.id
                ? 'border border-primary/45 bg-primary/12 text-primary shadow-sm'
                : 'border border-border text-muted-foreground hover:bg-background/60 hover:text-foreground'
            "
            @click="activeAgentCliToolId = tool.id"
          >
            {{ tool.label }}
          </button>
        </div>

        <div v-if="props.loadingAgentToolConfigs" class="mt-4 text-sm text-muted-foreground">
          加载配置中...
        </div>

        <div v-else class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="border-b border-border bg-background/70">
              <tr class="text-xs font-semibold text-muted-foreground">
                <th class="px-4 py-3">名称</th>
                <th class="px-4 py-3">Tool ID</th>
                <th class="px-4 py-3">默认</th>
                <th class="px-4 py-3">更新时间</th>
                <th class="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr
                v-for="config in props.agentToolConfigs"
                :key="config.id"
                class="transition hover:bg-background/70"
              >
                <td class="px-4 py-3">
                  <p class="text-sm font-semibold">{{ config.name }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ config.description || '暂无描述' }}</p>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-muted-foreground">{{ config.toolId }}</td>
                <td class="px-4 py-3">
                  <span
                    v-if="config.isDefault"
                    class="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                  >
                    默认
                  </span>
                  <span v-else class="text-xs text-muted-foreground">-</span>
                </td>
                <td class="px-4 py-3 text-muted-foreground">{{ props.formatDate(config.updatedAt) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      v-if="props.canTestAgentToolConfig"
                      type="button"
                      class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="props.testingAgentToolConfigId === config.id"
                      @click="emit('test-config', config)"
                    >
                      {{ props.testingAgentToolConfigId === config.id ? '探测中…' : '测试' }}
                    </button>
                    <button
                      v-if="props.canUpdateAgentToolConfig"
                      type="button"
                      class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                      @click="emit('edit-config', config)"
                    >
                      编辑
                    </button>
                    <button
                      v-if="props.canSetDefaultAgentToolConfig && !config.isDefault"
                      type="button"
                      class="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                      :disabled="props.submittingAgentToolConfig"
                      @click="emit('set-default', config)"
                    >
                      设为默认
                    </button>
                    <button
                      v-if="props.canDeleteAgentToolConfig"
                      type="button"
                      class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="props.deletingAgentToolConfigId === config.id"
                      @click="emit('remove-config', config.id)"
                    >
                      {{ props.deletingAgentToolConfigId === config.id ? '删除中...' : '删除' }}
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="!props.loadingAgentToolConfigs && props.agentToolConfigs.length === 0">
                <td colspan="5" class="px-4 py-5 text-sm text-muted-foreground">
                  {{ props.activeAgentCliToolLabel }} 暂无配置，请先创建。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </article>
  </section>
</template>
