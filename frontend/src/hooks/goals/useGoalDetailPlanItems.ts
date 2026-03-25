import { computed, ref, watch, type Ref } from 'vue'
import { goalsApi } from '@/api/goals'
import { useMessage } from '@/hooks'
import type { GoalDetail as GoalDetailType, GoalPlanItem } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { topologicalMaterializeOrder } from '@/utils/goal-plan-materialize-order'
import { toErrorMessage } from '@/utils/http/to-error-message'

type UseGoalDetailPlanItemsOptions = {
  branchOptions: Ref<string[]>
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
  const savingPlanItemGitBaseBranchId = ref<string | null>(null)

  const planItemDetailOpen = ref(false)
  const selectedPlanItem = ref<GoalPlanItem | null>(null)

  const planItemEditSummary = ref('')
  const planItemEditAcceptance = ref('')
  const planItemEditSuggestedPrompt = ref('')
  const savingPlanItemText = ref(false)

  const planItemStatusLabel: Record<GoalPlanItem['status'], string> = {
    draft: '草稿',
    approved: '已确认',
    task_created: '已创建任务',
    cancelled: '已取消',
  }

  function openPlanItemDetail(item: GoalPlanItem) {
    selectedPlanItem.value = item
    planItemDetailOpen.value = true
  }

  function onPlanItemSheetOpen(open: boolean) {
    planItemDetailOpen.value = open
    if (!open) {
      selectedPlanItem.value = null
    }
  }

  watch(
    () => [planItemDetailOpen.value, selectedPlanItem.value?.id] as const,
    () => {
      const item = selectedPlanItem.value
      if (!planItemDetailOpen.value || !item) {
        return
      }
      planItemEditSummary.value = item.summary ?? ''
      planItemEditAcceptance.value = item.acceptanceCriteria ?? ''
      planItemEditSuggestedPrompt.value = item.suggestedPrompt ?? ''
    },
  )

  function resetPlanItemTextDraft() {
    const item = selectedPlanItem.value
    if (!item) {
      return
    }
    planItemEditSummary.value = item.summary ?? ''
    planItemEditAcceptance.value = item.acceptanceCriteria ?? ''
    planItemEditSuggestedPrompt.value = item.suggestedPrompt ?? ''
  }

  function isPlanItemEditable(item: GoalPlanItem | null): boolean {
    return item?.status === 'draft'
  }

  function workflowNameForPlanItem(item: GoalPlanItem): string {
    const id = item.workflowTemplateId?.trim()
    if (!id) {
      return ''
    }
    const template = options.workflowTemplates.value.find((entry) => entry.id === id)
    return template?.name ?? id
  }

  function dependencyTitlesForPlanItem(item: GoalPlanItem): string[] {
    const detail = options.detail.value
    if (!detail) {
      return []
    }
    const byId = new Map(detail.planItems.map((planItem) => [planItem.id, planItem]))
    return item.dependsOnItemIds.map((depId) => byId.get(depId)?.title ?? depId)
  }

  function planItemApproveBlockedReason(item: GoalPlanItem): string | null {
    if (item.status !== 'draft') {
      return null
    }
    const detail = options.detail.value
    if (!detail) {
      return null
    }
    const byId = new Map(detail.planItems.map((planItem) => [planItem.id, planItem]))
    for (const predId of item.dependsOnItemIds ?? []) {
      const predecessor = byId.get(predId)
      if (!predecessor) {
        continue
      }
      if (predecessor.status !== 'task_created' || !predecessor.taskId?.trim()) {
        return `请先为前置计划项「${predecessor.title}」创建任务后再确认本项`
      }
    }
    return null
  }

  function planItemMaterializeBlockedReason(item: GoalPlanItem): string | null {
    const detail = options.detail.value
    if (!detail) {
      return null
    }
    const planById = new Map(detail.planItems.map((planItem) => [planItem.id, planItem]))
    for (const predId of item.dependsOnItemIds ?? []) {
      const predecessor = planById.get(predId)
      if (!predecessor) {
        continue
      }
      if (!predecessor.taskId?.trim()) {
        return `请先为前置计划项「${predecessor.title}」创建任务后再为本项新建任务`
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
    selectedPlanItem.value ? dependencyTitlesForPlanItem(selectedPlanItem.value) : [],
  )

  const selectedPlanItemWorkflowName = computed(() =>
    selectedPlanItem.value ? workflowNameForPlanItem(selectedPlanItem.value) : '',
  )

  async function savePlanItemText() {
    const detail = options.detail.value
    const item = selectedPlanItem.value
    const goalId = options.goalId.value
    if (!detail || !item || !goalId) {
      return
    }
    if (!isPlanItemEditable(item)) {
      message.warning('当前计划项已确认或已进入后续状态，不能再编辑')
      resetPlanItemTextDraft()
      return
    }
    savingPlanItemText.value = true
    try {
      const updated = await goalsApi.patchPlanItem(goalId, item.id, {
        summary: planItemEditSummary.value,
        acceptanceCriteria: planItemEditAcceptance.value,
        suggestedPrompt: planItemEditSuggestedPrompt.value,
      })
      const idx = detail.planItems.findIndex((planItem) => planItem.id === updated.id)
      if (idx >= 0) {
        detail.planItems[idx] = updated
      }
      selectedPlanItem.value = updated
      message.success('已保存')
    } catch (e) {
      message.error(toErrorMessage(e, '保存计划项失败'))
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

  function branchOptionsForPlanItem(gitBaseBranch: string | null | undefined) {
    const base = options.branchOptions.value.map((branch) => ({ label: branch, value: branch }))
    const id = gitBaseBranch?.trim()
    const rest =
      id && !base.some((option) => option.value === id)
        ? [{ label: `（当前：${id}）`, value: id }, ...base]
        : base
    return [{ label: '未选择（项目默认）', value: '' }, ...rest]
  }

  async function approveItem(item: GoalPlanItem) {
    const blocked = planItemApproveBlockedReason(item)
    if (blocked) {
      message.warning(blocked)
      return
    }
    try {
      await goalsApi.patchPlanItem(options.goalId.value, item.id, { status: 'approved' })
      message.success('已确认计划项')
      await options.load()
    } catch (e) {
      message.error(toErrorMessage(e, '确认计划项失败'))
    }
  }

  async function setPlanItemWorkflow(item: GoalPlanItem, workflowTemplateId: string) {
    if (!options.goalId.value || !options.detail.value) {
      return
    }
    if (!workflowTemplateId.trim()) {
      message.warning('请先为计划项配置工作流')
      return
    }
    if ((item.workflowTemplateId ?? '') === workflowTemplateId) {
      return
    }
    savingPlanItemWorkflowId.value = item.id
    try {
      const updated = await goalsApi.patchPlanItem(options.goalId.value, item.id, {
        workflowTemplateId,
      })
      const idx = options.detail.value.planItems.findIndex((planItem) => planItem.id === item.id)
      if (idx >= 0) {
        options.detail.value.planItems[idx] = updated
      }
    } catch (e) {
      message.error(toErrorMessage(e, '保存工作流失败'))
    } finally {
      savingPlanItemWorkflowId.value = null
    }
  }

  async function setPlanItemGitBaseBranch(item: GoalPlanItem, value: string) {
    if (!options.goalId.value || !options.detail.value) {
      return
    }
    const trimmed = String(value ?? '').trim()
    const nextStored: string | null = trimmed === '' ? null : trimmed
    const current = item.gitBaseBranch?.trim() ?? null
    if (current === nextStored) {
      return
    }
    savingPlanItemGitBaseBranchId.value = item.id
    try {
      const updated = await goalsApi.patchPlanItem(options.goalId.value, item.id, {
        gitBaseBranch: nextStored,
      })
      const idx = options.detail.value.planItems.findIndex((planItem) => planItem.id === item.id)
      if (idx >= 0) {
        options.detail.value.planItems[idx] = updated
      }
    } catch (e) {
      message.error(toErrorMessage(e, '保存基准分支失败'))
    } finally {
      savingPlanItemGitBaseBranchId.value = null
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
    const rawIds = detail.planItems
      .filter((item) => item.status === 'approved' && !item.taskId)
      .map((item) => item.id)
    if (rawIds.length === 0) {
      message.warning('没有待新建任务的已确认计划项')
      return
    }
    let orderedIds: string[]
    try {
      orderedIds = topologicalMaterializeOrder(rawIds, detail.planItems)
    } catch {
      message.error('计划项依赖成环，无法按顺序新建任务')
      return
    }

    for (const planItemId of orderedIds) {
      const item = detail.planItems.find((entry) => entry.id === planItemId)
      if (!item?.workflowTemplateId?.trim()) {
        message.warning(
          `请先在「任务计划」中为「${item?.title ?? planItemId}」配置工作流后再新建任务`,
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
      for (const planItemId of orderedIds) {
        await goalsApi.materializeTasks(options.goalId.value, [planItemId])
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

  return {
    approveItem,
    branchOptionsForPlanItem,
    goTaskFromSheet,
    materializeSelected,
    materializing,
    onPlanItemSheetOpen,
    openPlanItemDetail,
    planItemApproveBlockedReason,
    planItemDetailOpen,
    planItemEditAcceptance,
    planItemEditSuggestedPrompt,
    planItemEditSummary,
    planItemStatusLabel,
    resetPlanItemTextDraft,
    savePlanItemText,
    savingPlanItemGitBaseBranchId,
    savingPlanItemText,
    savingPlanItemWorkflowId,
    selectedPlanItem,
    selectedPlanItemDependencyTitles,
    selectedPlanItemWorkflowName,
    setPlanItemGitBaseBranch,
    setPlanItemWorkflow,
    workflowOptionsForPlanItem,
  }
}
