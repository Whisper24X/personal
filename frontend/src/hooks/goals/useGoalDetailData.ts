import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goalsApi } from '@/api/goals'
import { workflowApi } from '@/api/workflow'
import { useMessage } from '@/hooks'
import type { GoalDetail as GoalDetailType } from '@/types/api/goals'
import { flattenGoalPlanSubTasks } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import {
  planDependencyMermaidMarkdown,
  planItemsDependencyHasCycle,
} from '@/utils/goal-plan-dependency-graph'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

export const GOAL_SELECT_PANEL_Z_INDEX = 130
export const GOAL_SELECT_PANEL_PLACEMENT = 'top' as const

export type GoalDetailTab = 'prd' | 'plan'

type GoalGenerationFlags = { generatingPrd: boolean; generatingPlan: boolean }

/** 按需求 ID 持久化「生成中」状态，避免离开详情页再返回时按钮被错误解除禁用 */
const goalGenerationByGoalId = reactive<Record<string, GoalGenerationFlags>>({})

function ensureGoalGeneration(id: string): GoalGenerationFlags {
  return (goalGenerationByGoalId[id] ??= {
    generatingPrd: false,
    generatingPlan: false,
  })
}

function clearGoalGenerationEntryIfIdle(id: string) {
  const entry = goalGenerationByGoalId[id]
  if (!entry) {
    return
  }
  if (!entry.generatingPrd && !entry.generatingPlan) {
    delete goalGenerationByGoalId[id]
  }
}

export function useGoalDetailData() {
  const route = useRoute()
  const router = useRouter()
  const message = useMessage()

  const goalId = computed(() => String(route.params.goalId ?? ''))
  const loading = ref(false)

  const generatingPrd = computed(() => {
    const id = goalId.value
    if (!id) {
      return false
    }
    return goalGenerationByGoalId[id]?.generatingPrd ?? false
  })

  const generatingPlan = computed(() => {
    const id = goalId.value
    if (!id) {
      return false
    }
    return goalGenerationByGoalId[id]?.generatingPlan ?? false
  })
  const detail = ref<GoalDetailType | null>(null)
  const tab = ref<GoalDetailTab>('prd')

  const workflowTemplates = ref<WorkflowTemplate[]>([])
  const loadingWorkflowTemplates = ref(false)

  const planDepsMarkdown = computed(() => {
    const d = detail.value
    if (!d) {
      return ''
    }
    return planDependencyMermaidMarkdown(d.planItems ?? [])
  })

  const planDepsGraphKey = computed(() => {
    const d = detail.value
    if (!d) {
      return ''
    }
    const subPart = flattenGoalPlanSubTasks(d)
      .map((s) => `${s.id}:${s.status}`)
      .join('|')
    const groupPart = (d.planItems ?? [])
      .map((g) => `${g.id}:${(g.dependsOnItemIds ?? []).join(',')}`)
      .join(';')
    return `${subPart}__${groupPart}`
  })

  const planDepsHasCycle = computed(() => {
    const d = detail.value
    if (!d) {
      return false
    }
    const subs = flattenGoalPlanSubTasks(d)
    const groupCycle = planItemsDependencyHasCycle(
      (d.planItems ?? []).map((g) => ({
        id: g.id,
        dependsOnItemIds: g.dependsOnItemIds ?? [],
      })),
    )
    const subCycle = planItemsDependencyHasCycle(
      subs.map((s) => ({
        id: s.id,
        dependsOnItemIds: s.dependsOnSubTaskIds ?? [],
      })),
    )
    return groupCycle || subCycle
  })

  const goalHasPrd = computed(() => Boolean(detail.value?.goal.prdDocPath?.trim()))
  const goalHasPlanItems = computed(() => {
    const d = detail.value
    if (!d) {
      return false
    }
    return flattenGoalPlanSubTasks(d).length > 0
  })

  const planProgressTotal = computed(() => detail.value?.progress.totalTasks ?? 0)
  const planProgressDone = computed(() => detail.value?.progress.doneTasks ?? 0)
  const planProgressPercent = computed(() => detail.value?.progress.percent ?? 0)

  const planDependencyEdgeCount = computed(() => {
    const d = detail.value
    if (!d) {
      return 0
    }
    const subCount = flattenGoalPlanSubTasks(d).reduce(
      (sum, s) => sum + (s.dependsOnSubTaskIds?.length ?? 0),
      0,
    )
    const groupCount = (d.planItems ?? []).reduce(
      (sum, g) => sum + (g.dependsOnItemIds?.length ?? 0),
      0,
    )
    return subCount + groupCount
  })

  const loadWorkflowTemplatesForProject = async (projectId: string) => {
    if (!projectId) {
      workflowTemplates.value = []
      return
    }
    loadingWorkflowTemplates.value = true
    try {
      workflowTemplates.value = await fetchAllPages((page, limit) =>
        workflowApi.list({
          page,
          limit,
          isActive: true,
          scope: 'project',
          projectId,
        }),
      )
    } catch (error) {
      workflowTemplates.value = []
      message.error(toErrorMessage(error, '加载项目工作流列表失败'))
    } finally {
      loadingWorkflowTemplates.value = false
    }
  }

  async function load(options?: { silent?: boolean }) {
    if (!goalId.value) {
      return
    }
    const silent = options?.silent === true
    if (!silent) {
      loading.value = true
    }
    try {
      detail.value = await goalsApi.get(goalId.value)
      const projectId = detail.value.goal.projectId
      await loadWorkflowTemplatesForProject(projectId)
    } catch (e) {
      message.error(toErrorMessage(e, '加载需求失败'))
    } finally {
      if (!silent) {
        loading.value = false
      }
    }
  }

  function goBack() {
    router.back()
  }

  function goTask(taskId: string) {
    const projectId = detail.value?.goal.projectId?.trim()
    router.push({
      name: 'task-detail',
      params: { id: taskId },
      ...(projectId ? { query: { projectId } } : {}),
    })
  }

  function goalGenerationAgentPayload() {
    const goal = detail.value?.goal
    if (!goal?.agentCliId?.trim() || !goal?.agentCliConfigId?.trim()) {
      return {}
    }
    return {
      agentCliId: goal.agentCliId.trim(),
      agentCliConfigId: goal.agentCliConfigId.trim(),
    }
  }

  async function runGeneratePrd() {
    const goal = detail.value?.goal
    if (!goal?.agentCliId?.trim() || !goal?.agentCliConfigId?.trim()) {
      message.warning(
        '缺少业务线 Agent 配置，无法生成 PRD。创建需求时需选择 CLI 与工具配置，或更新需求后重试。',
      )
      return
    }
    const id = goalId.value
    if (!id) {
      return
    }
    message.info('PRD 生成中，预计需数十秒，请稍候…', {
      duration: 12_000,
      dedupeKey: 'goal-generate-prd',
    })
    ensureGoalGeneration(id).generatingPrd = true
    tab.value = 'prd'
    try {
      await goalsApi.generatePrd(id, {
        overwrite: true,
        ...goalGenerationAgentPayload(),
      })
      message.success('PRD 已生成')
      await load({ silent: true })
    } catch (e) {
      message.error(toErrorMessage(e, '生成 PRD 失败'))
    } finally {
      const entry = goalGenerationByGoalId[id]
      if (entry) {
        entry.generatingPrd = false
      }
      clearGoalGenerationEntryIfIdle(id)
    }
  }

  async function runGeneratePlan() {
    const goal = detail.value?.goal
    if (!goal?.agentCliId?.trim() || !goal?.agentCliConfigId?.trim()) {
      message.warning(
        '缺少业务线 Agent 配置，无法生成任务计划。创建需求时需选择 CLI 与工具配置，或更新需求后重试。',
      )
      return
    }
    const id = goalId.value
    if (!id) {
      return
    }
    message.info('任务计划生成中，预计需数十秒，请稍候…', {
      duration: 12_000,
      dedupeKey: 'goal-generate-plan',
    })
    ensureGoalGeneration(id).generatingPlan = true
    tab.value = 'plan'
    try {
      await goalsApi.generatePlan(id, {
        granularity: 'standard',
        overwrite: true,
        ...goalGenerationAgentPayload(),
      })
      message.success('任务计划已生成')
      await load({ silent: true })
    } catch (e) {
      message.error(toErrorMessage(e, '生成任务计划失败'))
    } finally {
      const entry = goalGenerationByGoalId[id]
      if (entry) {
        entry.generatingPlan = false
      }
      clearGoalGenerationEntryIfIdle(id)
    }
  }

  onMounted(load)

  return {
    detail,
    generatingPlan,
    generatingPrd,
    goalHasPlanItems,
    goalHasPrd,
    goalId,
    goBack,
    goTask,
    load,
    loading,
    loadingWorkflowTemplates,
    planDependencyEdgeCount,
    planDepsGraphKey,
    planDepsHasCycle,
    planDepsMarkdown,
    planProgressDone,
    planProgressPercent,
    planProgressTotal,
    runGeneratePlan,
    runGeneratePrd,
    tab,
    workflowTemplates,
  }
}
