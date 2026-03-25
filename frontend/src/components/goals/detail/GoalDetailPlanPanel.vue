<script setup lang="ts">
import AppSelect from '@/components/core/select'
import { Button } from '@/components/ui/button'
import type { GoalDetail, GoalPlanItem } from '@/types/api/goals'
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
  loadingBranches: boolean
  savingPlanItemWorkflowId: string | null
  savingPlanItemGitBaseBranchId: string | null
  planItemStatusLabel: Record<GoalPlanItem['status'], string>
  workflowOptionsForPlanItem: (workflowTemplateId: string | null | undefined) => SelectOption[]
  branchOptionsForPlanItem: (gitBaseBranch: string | null | undefined) => SelectOption[]
  planItemApproveBlockedReason: (item: GoalPlanItem) => string | null
  selectPanelZIndex: number
  selectPanelPlacement: 'top'
}>()

const emit = defineEmits<{
  openPlanItemDetail: [item: GoalPlanItem]
  setPlanItemWorkflow: [payload: { item: GoalPlanItem; workflowTemplateId: string }]
  setPlanItemGitBaseBranch: [payload: { item: GoalPlanItem; gitBaseBranch: string }]
  approveItem: [item: GoalPlanItem]
}>()
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto">
    <p
      v-if="!props.loadingWorkflowTemplates && props.workflowTemplates.length === 0"
      class="text-muted-foreground mb-3 text-xs text-amber-600 dark:text-amber-500"
    >
      当前项目暂无启用的工作流，请先在项目下创建并启用后再为计划项配置工作流。
    </p>
    <div class="-mx-1 overflow-x-auto px-1">
      <table class="w-full min-w-[52rem] text-left text-xs">
        <thead class="bg-muted/50">
          <tr>
            <th class="w-10 min-w-[2.5rem] whitespace-nowrap p-2 text-center tabular-nums">顺序</th>
            <th class="min-w-[8rem] p-2">标题</th>
            <th class="min-w-[5.5rem] whitespace-nowrap p-2">状态</th>
            <th class="min-w-[16rem] p-2">配置工作流</th>
            <th class="min-w-[14rem] p-2">基准分支</th>
            <th class="min-w-[4rem] whitespace-nowrap p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in props.detail.planItems"
            :key="item.id"
            class="hover:bg-muted/50 cursor-pointer border-b"
            @click="emit('openPlanItemDetail', item)"
          >
            <td
              class="text-muted-foreground w-10 min-w-[2.5rem] whitespace-nowrap p-2 text-center tabular-nums align-middle"
            >
              {{ item.itemOrder + 1 }}
            </td>
            <td class="hover:text-primary break-words p-2 hover:underline">{{ item.title }}</td>
            <td class="min-w-[5.5rem] whitespace-nowrap p-2 align-middle">
              {{ props.planItemStatusLabel[item.status] }}
            </td>
            <td class="min-w-[16rem] max-w-[28rem] p-2 align-top" @click.stop>
              <template v-if="item.status === 'approved' && !item.taskId">
                <AppSelect
                  :model-value="item.workflowTemplateId ?? ''"
                  aria-label="计划项配置工作流"
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
              <span v-else-if="item.taskId" class="text-muted-foreground whitespace-nowrap">
                已创建任务
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="min-w-[14rem] max-w-[28rem] p-2 align-top" @click.stop>
              <template v-if="item.status === 'approved' && !item.taskId">
                <AppSelect
                  :model-value="item.gitBaseBranch ?? ''"
                  aria-label="计划项基准分支"
                  :block="true"
                  :match-trigger-width="false"
                  :trigger-label-truncate="false"
                  :option-label-truncate="false"
                  :options="props.branchOptionsForPlanItem(item.gitBaseBranch)"
                  :disabled="
                    props.loadingBranches || props.savingPlanItemGitBaseBranchId === item.id
                  "
                  :panel-z-index="props.selectPanelZIndex"
                  :panel-placement="props.selectPanelPlacement"
                  size="sm"
                  trigger-class="min-w-0 w-full rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm"
                  @update:model-value="
                    (value) =>
                      emit('setPlanItemGitBaseBranch', {
                        item,
                        gitBaseBranch: String(value ?? ''),
                      })
                  "
                />
              </template>
              <span
                v-else-if="item.taskId"
                class="text-muted-foreground block break-words"
                :title="item.gitBaseBranch?.trim() || undefined"
              >
                {{ item.gitBaseBranch?.trim() || '—' }}
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="min-w-[4rem] whitespace-nowrap p-2 align-middle" @click.stop>
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
        </tbody>
      </table>
    </div>
  </div>
</template>
