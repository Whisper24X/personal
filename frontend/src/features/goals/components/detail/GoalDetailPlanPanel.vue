<script setup lang="ts">
import { Button } from '@shared/ui/button'
import type { GoalDetail, GoalPlanItem, GoalPlanSubTask } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { Loader2 } from 'lucide-vue-next'

defineOptions({
  name: 'GoalDetailPlanPanel',
})

const props = withDefaults(
  defineProps<{
    generatingPlan?: boolean
    detail: GoalDetail
    loadingWorkflowTemplates: boolean
    workflowTemplates: WorkflowTemplate[]
    mergingPlanGroupId: string | null
    materializing: boolean
    markingBranchMergedId: string | null
    planItemStatusLabel: Record<GoalPlanSubTask['status'], string>
    planItemApproveBlockedReason: (item: GoalPlanSubTask) => string | null
  }>(),
  { generatingPlan: false, markingBranchMergedId: null, mergingPlanGroupId: null },
)

const emit = defineEmits<{
  openPlanItemDetail: [sub: GoalPlanSubTask, groupTitle: string]
  materializePlanItem: [item: GoalPlanSubTask]
  mergePlanGroupIntoGoal: [group: GoalPlanItem]
  markBranchMerged: [item: GoalPlanSubTask]
}>()

function planGroupCountableSubTasks(group: GoalPlanItem): GoalPlanSubTask[] {
  return (group.subTasks ?? []).filter((s) => s.status !== 'cancelled')
}

function planGroupAllSubTasksBranchMerged(group: GoalPlanItem): boolean {
  const subs = planGroupCountableSubTasks(group)
  if (subs.length === 0) {
    return false
  }
  return subs.every((s) => s.status === 'branch_merged')
}

function planGroupCanMergeIntoGoal(group: GoalPlanItem): boolean {
  return (
    planGroupAllSubTasksBranchMerged(group) &&
    !group.groupMergedIntoGoalAt
  )
}

function formatGroupMergedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 列表仅展示，配置在侧栏完成 */
function workflowDisplayLabel(item: GoalPlanSubTask): string {
  const id = item.workflowTemplateId?.trim()
  if (!id) {
    return '未配置'
  }
  const t = props.workflowTemplates.find((w) => w.id === id)
  return t?.name ?? id
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      v-if="props.generatingPlan"
      class="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-4 py-8"
      role="status"
      aria-live="polite"
    >
      <Loader2 class="text-muted-foreground size-9 shrink-0 animate-spin" aria-hidden="true" />
      <div class="text-center">
        <p class="text-foreground text-sm font-medium">正在生成任务计划…</p>
        <p class="text-muted-foreground mt-1 max-w-sm text-xs">
          预计需要数十秒；刷新页面不会中断后台生成，本页会自动检测生成结果
        </p>
      </div>
    </div>
    <div v-else class="min-h-0 flex-1 overflow-auto">
      <p
        v-if="!props.loadingWorkflowTemplates && props.workflowTemplates.length === 0"
        class="text-muted-foreground mb-3 text-xs text-amber-600 dark:text-amber-500"
      >
        当前项目暂无启用的工作流，请先在项目下创建并启用后，在子任务侧栏内为待确认项配置工作流。
      </p>
      <div class="min-w-0 px-0">
        <table class="w-full table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col style="width: 2.5rem" />
            <col style="min-width: 9rem; max-width: min(52%, 36rem); width: 42%" />
            <col style="width: 4.75rem" />
            <col style="min-width: 6.5rem; max-width: min(28%, 18rem); width: 24%" />
            <col style="min-width: 7.5rem; width: 8.5rem" />
          </colgroup>
          <thead class="bg-muted/50">
            <tr>
              <th class="whitespace-nowrap p-2 text-center tabular-nums">顺序</th>
              <th class="min-w-0 p-2">标题</th>
              <th class="whitespace-nowrap p-2">状态</th>
              <th class="min-w-0 p-2">工作流</th>
              <th class="whitespace-nowrap p-2">操作</th>
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
                <td class="whitespace-nowrap p-2 align-middle" @click.stop>
                  <div
                    v-if="group.groupMergedIntoGoalAt"
                    class="text-muted-foreground max-w-[10rem] text-xs leading-snug"
                    :title="group.groupMergedIntoGoalAt"
                  >
                    已并入需求分支
                    <span class="tabular-nums">{{
                      formatGroupMergedAt(group.groupMergedIntoGoalAt)
                    }}</span>
                  </div>
                  <Button
                    v-else-if="planGroupCanMergeIntoGoal(group)"
                    type="button"
                    variant="link"
                    size="sm"
                    class="h-auto px-0 text-xs"
                    title="将功能组分支合并入需求分支（项目主仓库）"
                    :disabled="props.mergingPlanGroupId === group.id"
                    @click="emit('mergePlanGroupIntoGoal', group)"
                  >
                    {{
                      props.mergingPlanGroupId === group.id ? '合并中…' : '合并分支'
                    }}
                  </Button>
                </td>
              </tr>
              <tr
                v-for="(item, sidx) in group.subTasks ?? []"
                :key="item.id"
                class="hover:bg-muted/50 border-b"
              >
                <td
                  class="text-muted-foreground whitespace-nowrap p-2 text-center tabular-nums align-middle"
                >
                  {{ group.itemOrder + 1 }}.{{ sidx + 1 }}
                </td>
                <td class="min-w-0 break-words p-2">
                  {{ item.title }}
                </td>
                <td class="whitespace-nowrap p-2 align-middle">
                  {{ props.planItemStatusLabel[item.status] }}
                </td>
                <td class="min-w-0 break-words p-2 align-middle">
                  <template
                    v-if="(item.status === 'draft' || item.status === 'approved') && !item.taskId"
                  >
                    <span class="text-muted-foreground break-words" :title="workflowDisplayLabel(item)">
                      {{ workflowDisplayLabel(item) }}
                    </span>
                  </template>
                  <span
                    v-else-if="
                      item.taskId &&
                      item.status !== 'completed' &&
                      item.status !== 'branch_merged'
                    "
                    class="text-muted-foreground break-words"
                    :title="workflowDisplayLabel(item)"
                  >
                    {{ workflowDisplayLabel(item) }}
                  </span>
                  <span
                    v-else-if="item.status === 'completed' || item.status === 'branch_merged'"
                    class="text-muted-foreground whitespace-nowrap"
                  >
                    —
                  </span>
                  <span v-else class="text-muted-foreground">—</span>
                </td>
                <td class="whitespace-nowrap p-2 align-middle" @click.stop>
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Button
                      v-if="item.status === 'draft'"
                      type="button"
                      variant="link"
                      size="sm"
                      class="h-auto px-0 text-xs"
                      :disabled="!!props.planItemApproveBlockedReason(item)"
                      :title="props.planItemApproveBlockedReason(item) ?? undefined"
                      @click="emit('openPlanItemDetail', item, group.title)"
                    >
                      确认
                    </Button>
                    <template v-else>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        class="h-auto px-0 text-xs"
                        @click="emit('openPlanItemDetail', item, group.title)"
                      >
                        查看
                      </Button>
                      <Button
                        v-if="item.status === 'completed'"
                        type="button"
                        variant="link"
                        size="sm"
                        class="h-auto px-0 text-xs"
                        :disabled="props.markingBranchMergedId === item.id"
                        @click="emit('markBranchMerged', item)"
                      >
                        {{
                          props.markingBranchMergedId === item.id
                            ? '合并中…'
                            : '合并分支'
                        }}
                      </Button>
                      <Button
                        v-if="item.status === 'approved' && !item.taskId"
                        type="button"
                        variant="link"
                        size="sm"
                        class="h-auto px-0 text-xs"
                        :disabled="props.materializing"
                        @click="emit('materializePlanItem', item)"
                      >
                        {{ props.materializing ? '创建中…' : '创建任务' }}
                      </Button>
                    </template>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
