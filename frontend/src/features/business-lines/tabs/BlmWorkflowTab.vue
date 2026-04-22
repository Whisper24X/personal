<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowTemplate } from '@/types/api/workflow'

defineOptions({ name: 'BlmWorkflowTab' })

const props = defineProps<{
  activeLineId: string
  loadingWorkflowTemplates: boolean
  workflowTemplates: WorkflowTemplate[]
  workflowTemplateActionId: string
  canViewWorkflowTemplateList: boolean
  canCreateWorkflowTemplate: boolean
  canUpdateWorkflowTemplate: boolean
  canDeleteWorkflowTemplate: boolean
}>()

const emit = defineEmits<{
  'create-template': []
  'open-platform-copy': []
  refresh: []
  'edit-template': [template: WorkflowTemplate]
  'remove-template': [template: WorkflowTemplate]
}>()

const showActionColumn = computed(() => {
  return props.canUpdateWorkflowTemplate || props.canDeleteWorkflowTemplate
})
</script>

<template>
  <section class="space-y-4">
    <article class="panel-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">工作流模板列表</p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{
              !canViewWorkflowTemplateList
                ? '当前账号暂无查看工作流模板权限。'
                : loadingWorkflowTemplates
                  ? '加载中...'
                  : `共 ${workflowTemplates.length} 个`
            }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="canCreateWorkflowTemplate"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId"
            data-testid="open-copy-platform-wf"
            @click="emit('open-platform-copy')"
          >
            复制平台模板
          </button>
          <button
            v-if="canCreateWorkflowTemplate"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeLineId"
            @click="emit('create-template')"
          >
            创建模板
          </button>
          <button
            v-if="canViewWorkflowTemplateList"
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:shadow-sm"
            :disabled="!activeLineId || loadingWorkflowTemplates"
            @click="emit('refresh')"
          >
            刷新
          </button>
        </div>
      </div>

      <div
        v-if="!activeLineId"
        class="mt-3 rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
      >
        请先选择业务线。
      </div>

      <div
        v-else-if="!canViewWorkflowTemplateList"
        class="mt-3 rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground"
      >
        暂无查看工作流模板权限。
      </div>

      <div v-else-if="loadingWorkflowTemplates" class="mt-3 text-sm text-muted-foreground">
        加载业务线工作流模板中...
      </div>

      <div v-else class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[640px] table-fixed text-left text-sm">
          <thead class="border-b border-border bg-background/70">
            <tr class="text-xs font-semibold text-muted-foreground">
              <th class="px-3 py-2">模板</th>
              <th class="w-20 px-3 py-2 whitespace-nowrap">节点数</th>
              <th v-if="showActionColumn" class="w-44 px-3 py-2 text-right whitespace-nowrap">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="template in workflowTemplates"
              :key="template.id"
              class="transition hover:bg-background/70"
            >
              <td class="px-3 py-2">
                <div class="text-left">
                  <p class="truncate font-semibold">{{ template.name }}</p>
                  <p class="mt-0.5 truncate text-xs text-muted-foreground">
                    {{ template.description || '暂无描述' }}
                  </p>
                </div>
              </td>
              <td class="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {{ template.nodesJson.length }}
              </td>
              <td v-if="showActionColumn" class="px-3 py-2">
                <div class="flex justify-end gap-2">
                  <button
                    v-if="canUpdateWorkflowTemplate"
                    :data-testid="`workflow-edit-${template.id}`"
                    type="button"
                    class="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="workflowTemplateActionId === template.id"
                    @click="emit('edit-template', template)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="canDeleteWorkflowTemplate"
                    type="button"
                    class="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="workflowTemplateActionId === template.id"
                    @click="emit('remove-template', template)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="workflowTemplates.length === 0">
              <td :colspan="showActionColumn ? 3 : 2" class="px-3 py-4 text-sm text-muted-foreground">
                当前业务线暂无工作流模板。若有权限，可使用「复制平台模板」或「创建模板」。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
