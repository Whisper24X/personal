import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goalsApi } from '@/api/goals'
import { workflowApi } from '@/api/workflow'
import { useMessage } from '@app/composables/useMessage'
import type { GoalDetail as GoalDetailType, PlanGranularity } from '@/types/api/goals'
import { flattenGoalPlanSubTasks } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import {
  planDependencyMermaidMarkdown,
  planItemsDependencyHasCycle,
} from '@features/goals/utils/goal-plan-dependency-graph'
import {
  clearGoalGenerationPendingIfSatisfied,
  normalizeGoalGenerationKey,
  readGoalGenerationPending,
  setGoalGenerationPlanPending,
  setGoalGenerationPrdPending,
} from '@features/goals/utils/goal-generation-pending'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'
import { isRequestPreemptedFetchError } from '@shared/utils/is-request-preempted-fetch-error'

const GOAL_GEN_POLL_INTERVAL_MS = 4000
const GOAL_GEN_MAX_WAIT_MS = 12 * 60 * 1000

/** 与 computed(route) 一致解析，避免 param 为数组或首帧异常导致 id 为空、存储读写对不上 */
function goalIdFromRouteParam(route: { params: { goalId?: string | string[] } }): string {
  const raw = route.params.goalId
  const s = Array.isArray(raw) ? raw[0] : raw
  if (s === null || s === undefined) {
    return ''
  }
  return String(s).trim()
}

export const GOAL_SELECT_PANEL_Z_INDEX = 130
export const GOAL_SELECT_PANEL_PLACEMENT = 'top' as const

export type GoalDetailTab = 'prd' | 'plan'

type GoalGenerationFlags = { generatingPrd: boolean; generatingPlan: boolean }

/** 按需求 ID 持久化「生成中」状态，避免离开详情页再返回时按钮被错误解除禁用 */
const goalGenerationByGoalId = reactive<Record<string, GoalGenerationFlags>>({})

function ensureGoalGeneration(id: string): GoalGenerationFlags {
  const k = normalizeGoalGenerationKey(id)
  return (goalGenerationByGoalId[k] ??= {
    generatingPrd: false,
    generatingPlan: false,
  })
}

function clearGoalGenerationEntryIfIdle(id: string) {
  const k = normalizeGoalGenerationKey(id)
  const entry = goalGenerationByGoalId[k]
  if (!entry) {
    return
  }
  if (!entry.generatingPrd && !entry.generatingPlan) {
    delete goalGenerationByGoalId[k]
  }
}

export function useGoalDetailData() {
  const route = useRoute()
  const router = useRouter()
  const message = useMessage()

  const goalId = computed(() => goalIdFromRouteParam(route))
  const loading = ref(false)

  /** 仅本标签页内 POST generate-prd / generate-plan 进行中；刷新后为 false，用于区分「覆盖写入中」与「轮询恢复」 */
  const prdGenerateHttpInFlight = ref(false)
  const planGenerateHttpInFlight = ref(false)

  let generationPollTimer: ReturnType<typeof setInterval> | null = null
  let generationPollDeadline: number | null = null

  function stopGenerationPoll() {
    if (generationPollTimer != null) {
      clearInterval(generationPollTimer)
      generationPollTimer = null
    }
    generationPollDeadline = null
  }

  const generatingPrd = computed(() => {
    const id = goalId.value.trim()
    if (!id) {
      return false
    }
    return goalGenerationByGoalId[normalizeGoalGenerationKey(id)]?.generatingPrd ?? false
  })

  const generatingPlan = computed(() => {
    const id = goalId.value.trim()
    if (!id) {
      return false
    }
    return goalGenerationByGoalId[normalizeGoalGenerationKey(id)]?.generatingPlan ?? false
  })
  const detail = ref<GoalDetailType | null>(null)
  const tab = ref<GoalDetailTab>('prd')

  ;(() => {
    const id = goalIdFromRouteParam(route)
    if (!id) {
      return
    }
    const pending = readGoalGenerationPending(id)
    if (pending?.plan) {
      ensureGoalGeneration(id).generatingPlan = true
      tab.value = 'plan'
    }
    if (pending?.prd) {
      ensureGoalGeneration(id).generatingPrd = true
      if (!pending?.plan) {
        tab.value = 'prd'
      }
    }
  })()

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

  /** 避免路由 goalId 已变但 detail 仍为上一需求时的误判；与接口 goal.id 大小写可能不一致 */
  const detailMatchesRouteGoalId = computed(() => {
    const routeId = goalId.value.trim()
    const gid = detail.value?.goal.id?.trim()
    if (!routeId || !gid) {
      return false
    }
    return normalizeGoalGenerationKey(routeId) === normalizeGoalGenerationKey(gid)
  })
  const goalHasPrdWhenAligned = computed(
    () => detailMatchesRouteGoalId.value && goalHasPrd.value,
  )
  const goalHasPlanItemsWhenAligned = computed(
    () => detailMatchesRouteGoalId.value && goalHasPlanItems.value,
  )

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
      /** pending 的清理仅在「详情已与路由对齐」的 sync watch 中进行，避免此处误清 session（例如 id 大小写不一致时） */
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
    setGoalGenerationPrdPending(id, true, {
      prdPathBaseline: goal.prdDocPath?.trim() ?? '',
    })
    tab.value = 'prd'
    prdGenerateHttpInFlight.value = true
    try {
      await goalsApi.generatePrd(id, {
        overwrite: true,
        ...goalGenerationAgentPayload(),
      })
      message.success('PRD 已生成')
      await load({ silent: true })
      const entry = goalGenerationByGoalId[normalizeGoalGenerationKey(id)]
      if (entry) {
        entry.generatingPrd = false
      }
      setGoalGenerationPrdPending(id, false)
      clearGoalGenerationEntryIfIdle(id)
    } catch (e) {
      if (isRequestPreemptedFetchError(e)) {
        /* 刷新/关页会中断 fetch：保留 pending，新页从 storage 恢复后轮询 */
        return
      }
      message.error(toErrorMessage(e, '生成 PRD 失败'))
      const entry = goalGenerationByGoalId[normalizeGoalGenerationKey(id)]
      if (entry) {
        entry.generatingPrd = false
      }
      setGoalGenerationPrdPending(id, false)
      clearGoalGenerationEntryIfIdle(id)
    } finally {
      prdGenerateHttpInFlight.value = false
    }
  }

  async function runGeneratePlan(granularity: PlanGranularity = 'standard') {
    const d = detail.value
    const goal = d?.goal
    if (!goal?.agentCliId?.trim() || !goal?.agentCliConfigId?.trim()) {
      message.warning(
        '缺少业务线 Agent 配置，无法生成任务计划。创建需求时需选择 CLI 与工具配置，或更新需求后重试。',
      )
      return
    }
    const id = goalId.value
    if (!id || !d) {
      return
    }
    message.info('任务计划生成中，预计需数十秒，请稍候…', {
      duration: 12_000,
      dedupeKey: 'goal-generate-plan',
    })
    ensureGoalGeneration(id).generatingPlan = true
    const planSubBase = flattenGoalPlanSubTasks(d).length
    setGoalGenerationPlanPending(id, true, {
      planPathBaseline: goal.planDocPath?.trim() ?? '',
      planSubTaskBaselineCount: planSubBase,
    })
    tab.value = 'plan'
    planGenerateHttpInFlight.value = true
    try {
      await goalsApi.generatePlan(id, {
        granularity,
        overwrite: true,
        ...goalGenerationAgentPayload(),
      })
      message.success('任务计划已生成')
      await load({ silent: true })
      const entry = goalGenerationByGoalId[normalizeGoalGenerationKey(id)]
      if (entry) {
        entry.generatingPlan = false
      }
      setGoalGenerationPlanPending(id, false)
      clearGoalGenerationEntryIfIdle(id)
    } catch (e) {
      if (isRequestPreemptedFetchError(e)) {
        return
      }
      message.error(toErrorMessage(e, '生成任务计划失败'))
      const entry = goalGenerationByGoalId[normalizeGoalGenerationKey(id)]
      if (entry) {
        entry.generatingPlan = false
      }
      setGoalGenerationPlanPending(id, false)
      clearGoalGenerationEntryIfIdle(id)
    } finally {
      planGenerateHttpInFlight.value = false
    }
  }

  watch(
    goalId,
    (id) => {
      if (!id) {
        return
      }
      const pending = readGoalGenerationPending(id)
      if (pending?.plan) {
        ensureGoalGeneration(id).generatingPlan = true
        tab.value = 'plan'
      }
      if (pending?.prd) {
        ensureGoalGeneration(id).generatingPrd = true
        if (!pending?.plan) {
          tab.value = 'prd'
        }
      }
    },
    { immediate: true },
  )

  watch(
    [
      goalHasPrd,
      goalHasPlanItems,
      goalId,
      detailMatchesRouteGoalId,
      prdGenerateHttpInFlight,
      planGenerateHttpInFlight,
    ],
    () => {
      const id = goalId.value
      if (!id || !detailMatchesRouteGoalId.value) {
        return
      }
      const d = detail.value
      if (!d) {
        return
      }
      clearGoalGenerationPendingIfSatisfied({
        goalId: id,
        goalStatus: d.goal.status,
        currentPrdPath: d.goal.prdDocPath?.trim() ?? '',
        currentPlanPath: d.goal.planDocPath?.trim() ?? '',
        currentPlanSubTaskCount: flattenGoalPlanSubTasks(d).length,
        prdClientRequestInFlight: prdGenerateHttpInFlight.value,
        planClientRequestInFlight: planGenerateHttpInFlight.value,
      })
      const pending = readGoalGenerationPending(id)
      const entry = goalGenerationByGoalId[normalizeGoalGenerationKey(id)]
      if (entry?.generatingPrd && goalHasPrd.value && !pending?.prd) {
        entry.generatingPrd = false
      }
      if (entry?.generatingPlan && goalHasPlanItems.value && !pending?.plan) {
        entry.generatingPlan = false
      }
      clearGoalGenerationEntryIfIdle(id)
    },
    { flush: 'sync' },
  )

  watch(
    () =>
      [
        goalId.value,
        generatingPrd.value,
        generatingPlan.value,
        goalHasPrdWhenAligned.value,
        goalHasPlanItemsWhenAligned.value,
      ] as const,
    ([id, genPrd, genPlan, hasPrd, hasPlan]) => {
      stopGenerationPoll()
      const needPoll =
        Boolean(id) && ((genPrd && !hasPrd) || (genPlan && !hasPlan))
      if (!needPoll || !id) {
        return
      }
      const deadline = Date.now() + GOAL_GEN_MAX_WAIT_MS
      generationPollDeadline = deadline
      void load({ silent: true })
      generationPollTimer = setInterval(() => {
        const d = generationPollDeadline
        if (d != null && Date.now() > d) {
          stopGenerationPoll()
          setGoalGenerationPrdPending(id, false)
          setGoalGenerationPlanPending(id, false)
          const entry = goalGenerationByGoalId[normalizeGoalGenerationKey(id)]
          if (entry) {
            entry.generatingPrd = false
            entry.generatingPlan = false
          }
          clearGoalGenerationEntryIfIdle(id)
          message.warning(
            '等待生成结果超时。若后台仍在处理，请稍后手动刷新页面或重试。',
            { duration: 10_000, dedupeKey: 'goal-gen-poll-timeout' },
          )
          return
        }
        void load({ silent: true })
      }, GOAL_GEN_POLL_INTERVAL_MS)
    },
    { immediate: true },
  )

  watch(goalId, (id, previousId) => {
    if (!id || previousId === undefined || id === previousId) {
      return
    }
    void load()
  })

  onMounted(load)

  onUnmounted(() => {
    stopGenerationPoll()
  })

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
