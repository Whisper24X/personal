import { computed, ref, watch, type Ref } from 'vue'
import { goalsApi } from '@/api/goals'
import { useMessage } from '@/hooks'
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
    draft: '草稿',
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
        return `请先为前置子任务「${predecessor.title}」创建任务后再为本项新建任务`
      }
      const task = detail.tasks.find((entry) => entry.id === predecessor.taskId)
      if (!task) {
        return '前置任务数据缺失，请刷新后重试'
      }
      if (task.status !== 'done') {
        return `前置任务「${task.title}」未完成，请完成后再为本项新建任务`
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

  async function savePlanItemText() {
    const detail = options.detail.value
    const item = selectedPlanSubTask.value
    const goalId = options.goalId.value
    if (!detail || !item || !goalId) {
      return
    }
    if (!isPlanItemEditable(item)) {
      message.warning('当前子任务已确认或已进入后续状态，不能再编辑')
      resetPlanItemTextDraft()
      return
    }
    savingPlanItemText.value = true
    try {
      const updated = await goalsApi.patchPlanSubTask(goalId, item.id, {
        summary: planItemEditSummary.value,
        acceptanceCriteria: planItemEditAcceptance.value,
        suggestedPrompt: planItemEditSuggestedPrompt.value,
      })
      for (const g of detail.planItems) {
        const idx = g.subTasks?.findIndex((st) => st.id === updated.id) ?? -1
        if (idx >= 0 && g.subTasks) {
          g.subTasks[idx] = updated
          break
        }
      }
      selectedPlanSubTask.value = updated
      message.success('已保存')
    } catch (e) {
      message.error(toErrorMessage(e, '保存失败'))
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

  async function approveItem(item: GoalPlanSubTask) {
    const blocked = planItemApproveBlockedReason(item)
    if (blocked) {
      message.warning(blocked)
      return
    }
    try {
      await goalsApi.patchPlanSubTask(options.goalId.value, item.id, { status: 'approved' })
      message.success('已确认子任务')
      await options.load()
    } catch (e) {
      message.error(toErrorMessage(e, '确认失败'))
    }
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
      for (const g of detail.planItems) {
        const idx = g.subTasks?.findIndex((st) => st.id === updated.id) ?? -1
        if (idx >= 0 && g.subTasks) {
          g.subTasks[idx] = updated
          break
        }
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

  async function materializeSelected() {
    const detail = options.detail.value
    if (!detail) {
      return
    }
    const rawIds = flattenGoalPlanSubTasks(detail)
      .filter((item) => item.status === 'approved' && !item.taskId)
      .map((item) => item.id)
    if (rawIds.length === 0) {
      message.warning('没有待新建任务的已确认子任务')
      return
    }
    const allSubs = flattenGoalPlanSubTasks(detail)
    let orderedIds: string[]
    try {
      orderedIds = topologicalMaterializeOrder(
        rawIds,
        allSubs.map((s) => ({
          id: s.id,
          dependsOnItemIds: s.dependsOnSubTaskIds ?? [],
        })),
      )
    } catch {
      message.error('子任务依赖成环，无法按顺序新建任务')
      return
    }

    for (const subTaskId of orderedIds) {
      const item = allSubs.find((st) => st.id === subTaskId)
      if (!item?.workflowTemplateId?.trim()) {
        message.warning(
          `请先在「任务计划」中为「${item?.title ?? subTaskId}」配置工作流后再新建任务`,
        )
        return
      }
      const blocked = planItemMaterializeBlockedReason(item)
      if (blocked) {
        message.warning(blocked)
        return
      }
    }

    materializing.value = true
    try {
      for (const subTaskId of orderedIds) {
        await goalsApi.materializeTasks(options.goalId.value, [subTaskId])
      }
      message.success(
        orderedIds.length === 1 ? '已创建任务' : `已依次创建 ${orderedIds.length} 个任务`,
      )
      await options.load()
    } catch (e) {
      message.error(toErrorMessage(e, '新建任务失败'))
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
    approveItem,
    goTaskFromSheet,
    materializeSelected,
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
    savePlanItemText,
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
