import { computed, ref, watch, type Ref } from 'vue'
import { goalsApi } from '@/api/goals'
import { useMessage } from '@/hooks'
import { requestSidebarRecentTasksRefresh } from '@/hooks/useSidebarRecentTasks'
import type {
  GoalDetail as GoalDetailType,
  GoalPlanItem,
  GoalPlanSubTask,
} from '@/types/api/goals'
import { flattenGoalPlanSubTasks } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { topologicalMaterializeOrder } from '@/utils/goal-plan-materialize-order'
import { toErrorMessage } from '@/utils/http/to-error-message'

type UseGoalDetailPlanItemsOptions = {
  detail: Ref<GoalDetailType | null>
  goalId: Ref<string>
  goTask: (taskId: string) => void
  load: (options?: { silent?: boolean }) => Promise<void>
  workflowTemplates: Ref<WorkflowTemplate[]>
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

export function useGoalDetailPlanItems(options: UseGoalDetailPlanItemsOptions) {
  const message = useMessage()

  const materializing = ref(false)
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
    completed: '已完成',
    cancelled: '已取消',
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

  /** 功能组 dependsOnItemIds：前置组内全部子任务对应 Task 须已存在且均为 done（与后端一致） */
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
        const task = detail.tasks.find((entry) => entry.id === st.taskId)
        if (!task) {
          return '前置任务数据缺失，请刷新后重试'
        }
        if (task.status !== 'done') {
          return `请先完成前置功能组「${predGroup.title}」的全部子任务（「${st.title}」对应任务未完成）`
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
      const predMaterialized =
        (predecessor.status === 'task_created' ||
          predecessor.status === 'completed') &&
        !!predecessor.taskId?.trim()
      if (!predMaterialized) {
        return `请先为前置子任务「${predecessor.title}」创建任务后再确认本项`
      }
    }
    return null
  }

  function planItemMaterializeBlockedReason(item: GoalPlanSubTask): string | null {
    const detail = options.detail.value
    if (!detail) {
      return null
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
      const task = detail.tasks.find((entry) => entry.id === predecessor.taskId)
      if (!task) {
        return '前置任务数据缺失，请刷新后重试'
      }
      if (task.status !== 'done') {
        return `前置任务「${task.title}」未完成，请完成后再为本项创建任务`
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

      await goalsApi.materializeTasks(goalId, [item.id])
      requestSidebarRecentTasksRefresh()
      message.success('已确认并创建任务')
      await options.load()
      onPlanItemSheetOpen(false)
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
      await goalsApi.materializeTasks(goalId, [item.id])
      requestSidebarRecentTasksRefresh()
      message.success('已创建任务')
      await options.load()
    } catch (e) {
      message.error(toErrorMessage(e, '创建任务失败'))
    } finally {
      materializing.value = false
    }
  }

  const creatingPrGroupId = ref<string | null>(null)

  async function onCreateGroupPr(group: GoalPlanItem) {
    creatingPrGroupId.value = group.id
    try {
      const res = await goalsApi.getPlanItemPrLink(
        options.goalId.value,
        group.id,
      )
      if (!res.url) {
        message.warning('未能生成 PR 链接')
        return
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
      message.success('已打开 PR 链接')
    } catch (e) {
      message.error(toErrorMessage(e, '生成 PR 链接失败'))
    } finally {
      creatingPrGroupId.value = null
    }
  }

  return {
    confirmPlanItemFromSheet,
    goTaskFromSheet,
    materializeSingleSubTask,
    creatingPrGroupId,
    materializing,
    onCreateGroupPr,
    onPlanItemSheetOpen,
    openPlanItemDetail,
    planItemApproveBlockedReason,
    planItemDetailOpen,
    planItemEditAcceptance,
    planItemEditSuggestedPrompt,
    planItemEditSummary,
    planItemMaterializeBlockedReason,
    planItemStatusLabel,
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
