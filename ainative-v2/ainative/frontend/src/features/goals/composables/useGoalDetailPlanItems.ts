import { computed, ref, watch, type Ref } from 'vue'
import { goalsApi } from '@/api/goals'
import { useMessage } from '@app/composables/useMessage'
import { requestSidebarRecentTasksRefresh } from '@features/layout'
import { refreshSidebarRecentTasks } from '@shared/utils/sidebar-recent-tasks-refresh'
import type {
  GoalDetail as GoalDetailType,
  GoalPlanItem,
  GoalPlanSubTask,
} from '@/types/api/goals'
import { flattenGoalPlanSubTasks } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { mergeTaskBranchIntoBase } from '@features/tasks'
import { topologicalMaterializeOrder } from '@features/goals/utils/goal-plan-materialize-order'
import { toErrorMessage } from '@api/shared/to-error-message'

type UseGoalDetailPlanItemsOptions = {
  detail: Ref<GoalDetailType | null>
  goalId: Ref<string>
  goTask: (taskId: string) => void
  load: (options?: { silent?: boolean }) => Promise<void>
  workflowTemplates: Ref<WorkflowTemplate[]>
}

type MaterializeTasksResult = {
  tasks: { planSubTaskId: string; taskId: string }[]
}

function taskIdForMaterializedSubTask(
  result: MaterializeTasksResult,
  planSubTaskId: string,
): string | null {
  const taskId = result.tasks
    .find((task) => task.planSubTaskId === planSubTaskId)
    ?.taskId.trim()
  return taskId || null
}

function mergeSubTaskInDetail(detail: GoalDetailType, updated: GoalPlanSubTask) {
  for (const g of detail.planItems) {
    const idx = g.subTasks?.findIndex((st) => st.id === updated.id) ?? -1
    if (idx >= 0 && g.subTasks) {
      g.subTasks[idx] = updated
      return
    }
  }
}

function subTaskDependencyBlockedMessage(
  item: GoalPlanSubTask,
  predecessor: GoalPlanSubTask,
  suffix: 'approve' | 'materialize',
): string {
  const tail = suffix === 'approve' ? '后再确认本项' : '后再为本项创建任务'
  if (predecessor.goalPlanItemId === item.goalPlanItemId) {
    return (
      `请先将前置子任务「${predecessor.title}」对应分支通过任务计划「合并分支」并入本功能组分支，并标记为「分支已合并」；` +
      `合并后请将功能组分支推送至远端，${tail}`
    )
  }
  return (
    `请先将前置子任务「${predecessor.title}」对应分支并入其所属功能组分支，并标记为「分支已合并」；` +
    `若依赖跨功能组，请确保前置功能组已整体并入需求分支后，${tail}`
  )
}

export function useGoalDetailPlanItems(options: UseGoalDetailPlanItemsOptions) {
  const message = useMessage()

  const materializing = ref(false)
  const pushingGoalSubrepos = ref(false)
  const savingPlanItemWorkflowId = ref<string | null>(null)

  const planItemDetailOpen = ref(false)
  const selectedPlanSubTask = ref<GoalPlanSubTask | null>(null)
  const selectedPlanGroupTitle = ref('')

  const planItemEditSummary = ref('')
  const planItemEditAcceptance = ref('')
  const planItemEditSuggestedPrompt = ref('')
  const savingPlanItemText = ref(false)

  const planItemStatusLabel: Record<GoalPlanSubTask['status'], string> = {
    draft: '待确认',
    approved: '已确认',
    task_created: '已创建任务',
    completed: '任务已完成',
    branch_merged: '分支已合并',
    cancelled: '已取消',
  }

  function goMaterializedTask(result: MaterializeTasksResult, planSubTaskId: string) {
    const taskId = taskIdForMaterializedSubTask(result, planSubTaskId)
    if (!taskId) {
      message.warning('任务已创建，但未返回任务 ID，请刷新后查看')
      return
    }
    options.goTask(taskId)
  }

  function openPlanItemDetail(sub: GoalPlanSubTask, groupTitle: string) {
    selectedPlanSubTask.value = sub
    selectedPlanGroupTitle.value = groupTitle
    planItemDetailOpen.value = true
  }

  function onPlanItemSheetOpen(open: boolean) {
    planItemDetailOpen.value = open
    if (!open) {
      selectedPlanSubTask.value = null
      selectedPlanGroupTitle.value = ''
    }
  }

  watch(
    () => [planItemDetailOpen.value, selectedPlanSubTask.value?.id] as const,
    () => {
      const item = selectedPlanSubTask.value
      if (!planItemDetailOpen.value || !item) {
        return
      }
      planItemEditSummary.value = item.summary ?? ''
      planItemEditAcceptance.value = item.acceptanceCriteria ?? ''
      planItemEditSuggestedPrompt.value = item.suggestedPrompt ?? ''
    },
  )

  function resetPlanItemTextDraft() {
    const item = selectedPlanSubTask.value
    if (!item) {
      return
    }
    planItemEditSummary.value = item.summary ?? ''
    planItemEditAcceptance.value = item.acceptanceCriteria ?? ''
    planItemEditSuggestedPrompt.value = item.suggestedPrompt ?? ''
  }

  function isPlanItemEditable(item: GoalPlanSubTask | null): boolean {
    return item?.status === 'draft'
  }

  function workflowNameForPlanItem(item: GoalPlanSubTask): string {
    const id = item.workflowTemplateId?.trim()
    if (!id) {
      return ''
    }
    const template = options.workflowTemplates.value.find((entry) => entry.id === id)
    return template?.name ?? id
  }

  function dependencyTitlesForPlanItem(item: GoalPlanSubTask): string[] {
    const detail = options.detail.value
    if (!detail) {
      return []
    }
    const byId = new Map(
      flattenGoalPlanSubTasks(detail).map((st) => [st.id, st]),
    )
    return item.dependsOnSubTaskIds.map((depId) => byId.get(depId)?.title ?? depId)
  }

  /** 功能组 dependsOnItemIds：前置组内全部子任务须已标记「分支已合并」（与后端一致） */
  function planItemGroupDependencyBlockedReason(item: GoalPlanSubTask): string | null {
    const detail = options.detail.value
    if (!detail) {
      return null
    }
    const groupById = new Map(detail.planItems.map((g) => [g.id, g]))
    const parent = groupById.get(item.goalPlanItemId)
    if (!parent) {
      return null
    }
    for (const predId of parent.dependsOnItemIds ?? []) {
      const predGroup = groupById.get(predId)
      if (!predGroup) {
        continue
      }
      const subs = predGroup.subTasks ?? []
      if (subs.length === 0) {
        return `前置功能组「${predGroup.title}」无子任务，无法处理本组子任务`
      }
      for (const st of subs) {
        if (!st.taskId?.trim()) {
          return `请先为前置功能组「${predGroup.title}」的全部子任务创建任务后再继续`
        }
        if (st.status !== 'branch_merged') {
          return `请先将前置功能组「${predGroup.title}」的子任务「${st.title}」对应分支通过任务计划「合并分支」并入该功能组分支，并标记为「分支已合并」后再继续`
        }
      }
    }
    return null
  }

  function planItemApproveBlockedReason(item: GoalPlanSubTask): string | null {
    if (item.status !== 'draft') {
      return null
    }
    const detail = options.detail.value
    if (!detail) {
      return null
    }
    const groupBlocked = planItemGroupDependencyBlockedReason(item)
    if (groupBlocked) {
      return groupBlocked
    }
    const byId = new Map(
      flattenGoalPlanSubTasks(detail).map((st) => [st.id, st]),
    )
    for (const predId of item.dependsOnSubTaskIds ?? []) {
      const predecessor = byId.get(predId)
      if (!predecessor) {
        continue
      }
      if (
        predecessor.status !== 'branch_merged' ||
        !predecessor.taskId?.trim()
      ) {
        return subTaskDependencyBlockedMessage(item, predecessor, 'approve')
      }
    }
    return null
  }

  function planItemMaterializeBlockedReason(item: GoalPlanSubTask): string | null {
    const detail = options.detail.value
    if (!detail) {
      return null
    }
    const unfinishedTask = detail.tasks.find((task) => task.status !== 'done')
    if (unfinishedTask) {
      return `任务「${unfinishedTask.title}」尚未完成，请先完成后再创建新的计划任务`
    }
    const planSubTaskByTaskId = new Map(
      flattenGoalPlanSubTasks(detail)
        .filter((st) => st.taskId?.trim())
        .map((st) => [st.taskId!, st]),
    )
    for (const task of detail.tasks) {
      const planSubTask = planSubTaskByTaskId.get(task.id)
      if (!planSubTask || planSubTask.status === 'branch_merged') {
        continue
      }
      return `任务「${task.title}」已完成但尚未合并分支，请先在任务计划中执行「合并分支」`
    }
    const unmergedOtherGroup = detail.planItems.find(
      (group) =>
        group.id !== item.goalPlanItemId &&
        !!group.gitBranch?.trim() &&
        !group.groupMergedIntoGoalAt,
    )
    if (unmergedOtherGroup) {
      return `功能组「${unmergedOtherGroup.title}」分支尚未并入需求分支，请先合并后再创建新的计划任务`
    }
    const groupBlocked = planItemGroupDependencyBlockedReason(item)
    if (groupBlocked) {
      return groupBlocked
    }
    const planById = new Map(
      flattenGoalPlanSubTasks(detail).map((st) => [st.id, st]),
    )
    for (const predId of item.dependsOnSubTaskIds ?? []) {
      const predecessor = planById.get(predId)
      if (!predecessor) {
        continue
      }
      if (!predecessor.taskId?.trim()) {
        return `请先为前置子任务「${predecessor.title}」创建任务后再为本项创建任务`
      }
      if (predecessor.status !== 'branch_merged') {
        return subTaskDependencyBlockedMessage(item, predecessor, 'materialize')
      }
    }
    return null
  }

  const selectedPlanItemDependencyTitles = computed(() =>
    selectedPlanSubTask.value ? dependencyTitlesForPlanItem(selectedPlanSubTask.value) : [],
  )

  const selectedPlanItemWorkflowName = computed(() =>
    selectedPlanSubTask.value ? workflowNameForPlanItem(selectedPlanSubTask.value) : '',
  )

  async function confirmPlanItemFromSheet() {
    const detail = options.detail.value
    const item = selectedPlanSubTask.value
    const goalId = options.goalId.value
    if (!detail || !item || !goalId) {
      return
    }
    if (!isPlanItemEditable(item)) {
      message.warning('当前子任务已非待确认状态，不能再编辑')
      resetPlanItemTextDraft()
      return
    }
    if (!item.workflowTemplateId?.trim()) {
      message.warning('请先配置工作流')
      return
    }
    const blocked = planItemApproveBlockedReason(item)
    if (blocked) {
      message.warning(blocked)
      return
    }

    savingPlanItemText.value = true
    try {
      let current = await goalsApi.patchPlanSubTask(goalId, item.id, {
        summary: planItemEditSummary.value,
        acceptanceCriteria: planItemEditAcceptance.value,
        suggestedPrompt: planItemEditSuggestedPrompt.value,
      })
      mergeSubTaskInDetail(detail, current)
      selectedPlanSubTask.value = current

      if (current.status === 'draft') {
        current = await goalsApi.patchPlanSubTask(goalId, item.id, { status: 'approved' })
        mergeSubTaskInDetail(detail, current)
        selectedPlanSubTask.value = current
      }

      const materializeBlocked = planItemMaterializeBlockedReason(current)
      if (materializeBlocked) {
        message.warning(materializeBlocked)
        await options.load()
        return
      }

      const materialized = await goalsApi.materializeTasks(goalId, [current.id])
      requestSidebarRecentTasksRefresh()
      void refreshSidebarRecentTasks()
      message.success('已确认并创建任务')
      await options.load()
      await refreshSidebarRecentTasks()
      onPlanItemSheetOpen(false)
      goMaterializedTask(materialized, current.id)
    } catch (e) {
      message.error(toErrorMessage(e, '创建任务失败'))
      await options.load()
      const d = options.detail.value
      if (d && selectedPlanSubTask.value) {
        const fresh = flattenGoalPlanSubTasks(d).find(
          (st) => st.id === selectedPlanSubTask.value!.id,
        )
        if (fresh) {
          selectedPlanSubTask.value = fresh
        }
      }
    } finally {
      savingPlanItemText.value = false
    }
  }

  function workflowOptionsForPlanItem(workflowTemplateId: string | null | undefined) {
    const base = options.workflowTemplates.value.map((template) => ({
      label: template.name,
      value: template.id,
    }))
    const id = workflowTemplateId?.trim()
    if (id && !base.some((option) => option.value === id)) {
      return [{ label: '（已选模板不在列表中，请重新选择）', value: id }, ...base]
    }
    return base
  }

  async function setPlanItemWorkflow(item: GoalPlanSubTask, workflowTemplateId: string) {
    if (!options.goalId.value || !options.detail.value) {
      return
    }
    if (!workflowTemplateId.trim()) {
      message.warning('请先配置工作流')
      return
    }
    if ((item.workflowTemplateId ?? '') === workflowTemplateId) {
      return
    }
    savingPlanItemWorkflowId.value = item.id
    try {
      const updated = await goalsApi.patchPlanSubTask(options.goalId.value, item.id, {
        workflowTemplateId,
      })
      const detail = options.detail.value
      mergeSubTaskInDetail(detail, updated)
      if (selectedPlanSubTask.value?.id === updated.id) {
        selectedPlanSubTask.value = updated
      }
    } catch (e) {
      message.error(toErrorMessage(e, '保存工作流失败'))
    } finally {
      savingPlanItemWorkflowId.value = null
    }
  }

  function goTaskFromSheet(taskId: string) {
    onPlanItemSheetOpen(false)
    options.goTask(taskId)
  }

  async function materializeSingleSubTask(item: GoalPlanSubTask) {
    const goalId = options.goalId.value
    const detail = options.detail.value
    if (!goalId || !detail) {
      return
    }
    if (item.status !== 'approved' || item.taskId) {
      message.warning('仅已确认且尚未创建任务的子任务可创建任务')
      return
    }
    if (!item.workflowTemplateId?.trim()) {
      message.warning(
        `请先在「任务计划」中为「${item.title}」配置工作流后再创建任务`,
      )
      return
    }
    const blocked = planItemMaterializeBlockedReason(item)
    if (blocked) {
      message.warning(blocked)
      return
    }
    const allSubs = flattenGoalPlanSubTasks(detail)
    try {
      topologicalMaterializeOrder(
        [item.id],
        allSubs.map((s) => ({
          id: s.id,
          dependsOnItemIds: s.dependsOnSubTaskIds ?? [],
        })),
      )
    } catch {
      message.error('子任务依赖成环，无法创建任务')
      return
    }

    materializing.value = true
    try {
      const materialized = await goalsApi.materializeTasks(goalId, [item.id])
      requestSidebarRecentTasksRefresh()
      void refreshSidebarRecentTasks()
      message.success('已创建任务')
      await options.load()
      await refreshSidebarRecentTasks()
      goMaterializedTask(materialized, item.id)
    } catch (e) {
      message.error(toErrorMessage(e, '创建任务失败'))
    } finally {
      materializing.value = false
    }
  }

  const mergingPlanGroupId = ref<string | null>(null)
  const markingBranchMergedId = ref<string | null>(null)

  async function markBranchMergedSubTask(item: GoalPlanSubTask) {
    const goalId = options.goalId.value
    const detail = options.detail.value
    if (!goalId || !detail) {
      return
    }
    if (item.status !== 'completed') {
      return
    }
    const taskId = item.taskId?.trim()
    if (!taskId) {
      message.warning('未找到关联任务，无法合并')
      return
    }
    const task = detail.tasks.find((t) => t.id === taskId)
    if (!task) {
      message.warning('未找到关联任务数据，请刷新后重试')
      return
    }
    const baseBranch = task.gitBaseBranch?.trim() || 'main'

    markingBranchMergedId.value = item.id
    try {
      const mergeResult = await mergeTaskBranchIntoBase(taskId, baseBranch)
      if (!mergeResult.success) {
        const conflictExtra =
          mergeResult.conflicts?.length && mergeResult.conflicts.length > 0
            ? `（冲突：${mergeResult.conflicts.slice(0, 8).join('、')}${
                mergeResult.conflicts.length > 8 ? '…' : ''
              }）`
            : ''
        message.warning(`${mergeResult.message}${conflictExtra}`)
        return
      }

      const updated = await goalsApi.patchPlanSubTask(goalId, item.id, {
        status: 'branch_merged',
      })
      mergeSubTaskInDetail(detail, updated)
      if (selectedPlanSubTask.value?.id === updated.id) {
        selectedPlanSubTask.value = updated
      }
      message.success(
        '已合并并更新计划状态。请将功能组分支推送至远端，以便后续任务基于最新代码创建。',
      )
      await options.load()
    } catch (e) {
      message.error(toErrorMessage(e, '合并失败'))
    } finally {
      markingBranchMergedId.value = null
    }
  }

  async function mergePlanGroupIntoGoal(group: GoalPlanItem) {
    const goalId = options.goalId.value
    if (!goalId) {
      return
    }
    mergingPlanGroupId.value = group.id
    try {
      const res = await goalsApi.mergePlanItemIntoGoal(goalId, group.id)
      if (!res.success) {
        const conflictExtra =
          res.conflicts?.length && res.conflicts.length > 0
            ? `（冲突：${res.conflicts.slice(0, 8).join('、')}${
                res.conflicts.length > 8 ? '…' : ''
              }）`
            : ''
        message.warning(`${res.message}${conflictExtra}`)
        return
      }
      message.success('已合并功能组分支至需求分支')
      await options.load()
    } catch (e) {
      message.error(toErrorMessage(e, '合并失败'))
    } finally {
      mergingPlanGroupId.value = null
    }
  }

  async function pushGoalSubrepos() {
    const goalId = options.goalId.value
    if (!goalId) {
      return
    }

    pushingGoalSubrepos.value = true
    try {
      const res = await goalsApi.pushSubrepos(goalId)
      if (res.success) {
        message.success(res.message || '已推送需求分支至子仓')
      } else {
        message.warning(res.message || '推送部分失败')
      }
      await options.load()
    } catch (e) {
      message.error(toErrorMessage(e, '推送失败'))
    } finally {
      pushingGoalSubrepos.value = false
    }
  }

  return {
    confirmPlanItemFromSheet,
    goTaskFromSheet,
    materializeSingleSubTask,
    mergingPlanGroupId,
    markingBranchMergedId,
    markBranchMergedSubTask,
    materializing,
    mergePlanGroupIntoGoal,
    onPlanItemSheetOpen,
    openPlanItemDetail,
    planItemApproveBlockedReason,
    planItemDetailOpen,
    planItemEditAcceptance,
    planItemEditSuggestedPrompt,
    planItemEditSummary,
    planItemMaterializeBlockedReason,
    planItemStatusLabel,
    pushGoalSubrepos,
    pushingGoalSubrepos,
    resetPlanItemTextDraft,
    savingPlanItemText,
    savingPlanItemWorkflowId,
    selectedPlanItem: selectedPlanSubTask,
    selectedPlanGroupTitle,
    selectedPlanItemDependencyTitles,
    selectedPlanItemWorkflowName,
    setPlanItemWorkflow,
    workflowOptionsForPlanItem,
  }
}
