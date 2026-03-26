<script setup lang="ts">
import AppSelect from '@/components/core/select'
import { Button } from '@/components/ui/button'
import type { GoalDetail, GoalPlanItem, GoalPlanSubTask } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'

defineOptions({
  name: 'GoalDetailPlanPanel',
})

type SelectOption = {
  label: string
  value: string
}

const props = defineProps<{
  detail: GoalDetail
  loadingWorkflowTemplates: boolean
  workflowTemplates: WorkflowTemplate[]
  savingPlanItemWorkflowId: string | null
  creatingPrGroupId: string | null
  planItemStatusLabel: Record<GoalPlanSubTask['status'], string>
  workflowOptionsForPlanItem: (workflowTemplateId: string | null | undefined) => SelectOption[]
  planItemApproveBlockedReason: (item: GoalPlanSubTask) => string | null
  selectPanelZIndex: number
  selectPanelPlacement: 'top'
}>()

const emit = defineEmits<{
  openPlanItemDetail: [sub: GoalPlanSubTask, groupTitle: string]
  setPlanItemWorkflow: [payload: { item: GoalPlanSubTask; workflowTemplateId: string }]
  approveItem: [item: GoalPlanSubTask]
  createGroupPr: [group: GoalPlanItem]
}>()

function planGroupCountableSubTasks(group: GoalPlanItem): GoalPlanSubTask[] {
  return (group.subTasks ?? []).filter((s) => s.status !== 'cancelled')
}

function planGroupAllSubTasksCompleted(group: GoalPlanItem): boolean {
  const subs = planGroupCountableSubTasks(group)
  if (subs.length === 0) {
    return false
  }
  return subs.every((s) => s.status === 'completed')
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto">
    <p
      v-if="!props.loadingWorkflowTemplates && props.workflowTemplates.length === 0"
      class="text-muted-foreground mb-3 text-xs text-amber-600 dark:text-amber-500"
    >
      当前项目暂无启用的工作流，请先在项目下创建并启用后再为子任务配置工作流。
    </p>
    <div class="min-w-0 px-0">
      <table class="w-full table-fixed border-collapse text-left text-xs">
        <thead class="bg-muted/50">
          <tr>
            <th class="w-10 whitespace-nowrap p-2 text-center tabular-nums">顺序</th>
            <th class="min-w-0 p-2">标题</th>
            <th class="w-[4.5rem] whitespace-nowrap p-2">状态</th>
            <th class="min-w-0 w-[18%] p-2">配置工作流</th>
            <th class="w-28 whitespace-nowrap p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in props.detail.planItems" :key="group.id">
            <tr class="bg-muted/40 border-b">
              <td colspan="4" class="min-w-0 text-muted-foreground px-2 py-2 font-medium align-middle">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <span class="text-foreground">功能组 · {{ group.title }}</span>
                  <span
                    class="min-w-0 break-all font-mono text-[11px] text-muted-foreground"
                  >
                    {{ group.gitBranch ?? '分支未创建（确认子任务后创建）' }}
                  </span>
                </div>
              </td>
              <td class="w-28 whitespace-nowrap p-2 align-middle" @click.stop>
                <Button
                  v-if="planGroupAllSubTasksCompleted(group)"
                  type="button"
                  variant="link"
                  size="sm"
                  class="h-auto px-0 text-xs"
                  title="在浏览器中打开创建 PR 页面（功能组分支合并入需求分支）"
                  :disabled="props.creatingPrGroupId === group.id"
                  @click="emit('createGroupPr', group)"
                >
                  {{
                    props.creatingPrGroupId === group.id ? '生成中…' : '创建PR'
                  }}
                </Button>
              </td>
            </tr>
            <tr
              v-for="(item, sidx) in group.subTasks ?? []"
              :key="item.id"
              class="hover:bg-muted/50 cursor-pointer border-b"
              @click="emit('openPlanItemDetail', item, group.title)"
            >
              <td
                class="text-muted-foreground w-10 whitespace-nowrap p-2 text-center tabular-nums align-middle"
              >
                {{ group.itemOrder + 1 }}.{{ sidx + 1 }}
              </td>
              <td class="min-w-0 break-words p-2 hover:text-primary hover:underline">
                {{ item.title }}
              </td>
              <td class="w-[4.5rem] whitespace-nowrap p-2 align-middle">
                {{ props.planItemStatusLabel[item.status] }}
              </td>
              <td class="min-w-0 w-[18%] p-2 align-top" @click.stop>
                <template v-if="item.status === 'approved' && !item.taskId">
                  <AppSelect
                    :model-value="item.workflowTemplateId ?? ''"
                    aria-label="子任务配置工作流"
                    :block="true"
                    :match-trigger-width="false"
                    :trigger-label-truncate="false"
                    :option-label-truncate="false"
                    :options="props.workflowOptionsForPlanItem(item.workflowTemplateId)"
                    :disabled="
                      props.loadingWorkflowTemplates ||
                      props.workflowTemplates.length === 0 ||
                      props.savingPlanItemWorkflowId === item.id
                    "
                    :panel-z-index="props.selectPanelZIndex"
                    :panel-placement="props.selectPanelPlacement"
                    size="sm"
                    trigger-class="min-w-0 w-full rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm"
                    @update:model-value="
                      (value) =>
                        emit('setPlanItemWorkflow', {
                          item,
                          workflowTemplateId: String(value ?? ''),
                        })
                    "
                  />
                </template>
                <span
                  v-else-if="item.taskId && item.status !== 'completed'"
                  class="text-muted-foreground whitespace-nowrap"
                >
                  已创建任务
                </span>
                <span
                  v-else-if="item.status === 'completed'"
                  class="text-muted-foreground whitespace-nowrap"
                >
                  —
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </td>
              <td class="w-28 whitespace-nowrap p-2 align-middle" @click.stop>
                <Button
                  v-if="item.status === 'draft'"
                  type="button"
                  variant="link"
                  size="sm"
                  class="h-auto px-0 text-xs"
                  :disabled="!!props.planItemApproveBlockedReason(item)"
                  :title="props.planItemApproveBlockedReason(item) ?? undefined"
                  @click="emit('approveItem', item)"
                >
                  确认
                </Button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
