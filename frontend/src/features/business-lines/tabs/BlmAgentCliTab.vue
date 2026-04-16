<script setup lang="ts">
import type { AgentToolConfig } from '@/api/business-lines'
import type { SupportedCliToolId } from '../blm-workflow-template.types'

defineOptions({ name: 'BlmAgentCliTab' })

const activeAgentCliToolId = defineModel<SupportedCliToolId>('activeAgentCliToolId', {
  required: true,
})

defineProps<{
  activeLineId: string
  loadingAgentToolConfigs: boolean
  agentToolConfigs: AgentToolConfig[]
  activeAgentCliToolLabel: string
  submittingAgentToolConfig: boolean
  deletingAgentToolConfigId: string
  testingAgentToolConfigId: string
  supportedCliTools: Array<{ id: SupportedCliToolId; label: string }>
  formatDate: (value?: string) => string
}>()

const emit = defineEmits<{
  refresh: []
  'create-config': []
  'edit-config': [config: AgentToolConfig]
  'set-default': [config: AgentToolConfig]
  'remove-config': [configId: string]
  'test-config': [config: AgentToolConfig]
}>()
</script>

<template>
  <section class="space-y-4">
    <article class="panel-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">Agent CLI 配置</p>
          <p class="mt-1 text-xs text-muted-foreground">
            业务线统一维护多套 Agent CLI 配置，供同业务线项目复用。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            :disabled="!activeLineId"
            @click="emit('refresh')"
          >
            刷新
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm"
            :disabled="!activeLineId"
            @click="emit('create-config')"
          >
            新建配置
          </button>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="tool in supportedCliTools"
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

      <div v-if="loadingAgentToolConfigs" class="mt-4 text-sm text-muted-foreground">加载配置中...</div>

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
              v-for="config in agentToolConfigs"
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
              <td class="px-4 py-3 text-muted-foreground">{{ formatDate(config.updatedAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="testingAgentToolConfigId === config.id"
                    @click="emit('test-config', config)"
                  >
                    {{ testingAgentToolConfigId === config.id ? '探测中…' : '测试' }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
                    @click="emit('edit-config', config)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="!config.isDefault"
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                    :disabled="submittingAgentToolConfig"
                    @click="emit('set-default', config)"
                  >
                    设为默认
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="deletingAgentToolConfigId === config.id"
                    @click="emit('remove-config', config.id)"
                  >
                    {{ deletingAgentToolConfigId === config.id ? '删除中...' : '删除' }}
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!loadingAgentToolConfigs && agentToolConfigs.length === 0">
              <td colspan="5" class="px-4 py-5 text-sm text-muted-foreground">
                {{ activeAgentCliToolLabel }} 暂无配置，请先创建。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
