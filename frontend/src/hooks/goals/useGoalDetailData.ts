import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goalsApi } from '@/api/goals'
import { gitApi } from '@/api/git'
import { projectsApi } from '@/api/projects'
import { workflowApi } from '@/api/workflow'
import { useMessage } from '@/hooks'
import type { GoalDetail as GoalDetailType } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { buildBranchOptions } from '@/utils/git-branch-options'
import {
  planDependencyMermaidMarkdown,
  planItemsDependencyHasCycle,
} from '@/utils/goal-plan-dependency-graph'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'

export const GOAL_SELECT_PANEL_Z_INDEX = 130
export const GOAL_SELECT_PANEL_PLACEMENT = 'top' as const

export type GoalDetailTab = 'prd' | 'plan'

export function useGoalDetailData() {
  const route = useRoute()
  const router = useRouter()
  const message = useMessage()

  const goalId = computed(() => String(route.params.goalId ?? ''))
  const loading = ref(false)
  const generatingPrd = ref(false)
  const generatingPlan = ref(false)
  const detail = ref<GoalDetailType | null>(null)
  const tab = ref<GoalDetailTab>('prd')

  const workflowTemplates = ref<WorkflowTemplate[]>([])
  const loadingWorkflowTemplates = ref(false)

  let latestBranchRequestId = 0
  const loadingBranches = ref(false)
  const branchOptions = ref<string[]>([])

  const planDepsMarkdown = computed(() => {
    const items = detail.value?.planItems ?? []
    void items.map((item) => `${item.id}:${item.status}`)
    return planDependencyMermaidMarkdown(items)
  })

  const planDepsGraphKey = computed(() =>
    (detail.value?.planItems ?? []).map((item) => `${item.id}:${item.status}`).join('|'),
  )

  const planDepsHasCycle = computed(() =>
    planItemsDependencyHasCycle(detail.value?.planItems ?? []),
  )

  const goalHasPrd = computed(() => Boolean(detail.value?.goal.prdDocPath?.trim()))
  const goalHasPlanItems = computed(() => (detail.value?.planItems.length ?? 0) > 0)

  const planProgressTotal = computed(() => detail.value?.planItems.length ?? 0)
  const planProgressDone = computed(() => detail.value?.progress.doneTasks ?? 0)
  const planProgressPercent = computed(() => {
    const total = planProgressTotal.value
    if (total <= 0) {
      return 0
    }
    return Math.min(100, Math.max(0, (planProgressDone.value / total) * 100))
  })

  const planDependencyEdgeCount = computed(() => {
    const items = detail.value?.planItems ?? []
    return items.reduce((sum, item) => sum + (item.dependsOnItemIds?.length ?? 0), 0)
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

  const loadBranchesForProject = async (projectId: string) => {
    const requestId = ++latestBranchRequestId
    if (!projectId) {
      branchOptions.value = []
      return
    }
    loadingBranches.value = true
    try {
      const [project, branchData] = await Promise.all([
        projectsApi.detail(projectId),
        gitApi.branches(projectId),
      ])
      if (requestId !== latestBranchRequestId) {
        return
      }
      const projectDefaultBranch = project.defaultBranch?.trim() || ''
      branchOptions.value = buildBranchOptions({
        localBranches: branchData.localBranches,
        remoteBranches: branchData.remoteBranches,
        preferredBranches: [projectDefaultBranch, branchData.defaultBranch],
      })
    } catch (error) {
      if (requestId !== latestBranchRequestId) {
        return
      }
      branchOptions.value = []
      message.error(toErrorMessage(error, '加载项目分支失败'))
    } finally {
      if (requestId === latestBranchRequestId) {
        loadingBranches.value = false
      }
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
      await Promise.all([
        loadWorkflowTemplatesForProject(projectId),
        loadBranchesForProject(projectId),
      ])
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
    message.info('PRD 生成中，预计需数十秒，请稍候…', {
      duration: 12_000,
      dedupeKey: 'goal-generate-prd',
    })
    generatingPrd.value = true
    try {
      await goalsApi.generatePrd(goalId.value, {
        overwrite: true,
        ...goalGenerationAgentPayload(),
      })
      tab.value = 'prd'
      message.success('PRD 已生成')
      await load({ silent: true })
    } catch (e) {
      message.error(toErrorMessage(e, '生成 PRD 失败'))
    } finally {
      generatingPrd.value = false
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
    message.info('任务计划生成中，预计需数十秒，请稍候…', {
      duration: 12_000,
      dedupeKey: 'goal-generate-plan',
    })
    generatingPlan.value = true
    try {
      await goalsApi.generatePlan(goalId.value, {
        granularity: 'standard',
        overwrite: true,
        ...goalGenerationAgentPayload(),
      })
      tab.value = 'plan'
      message.success('任务计划已生成')
      await load({ silent: true })
    } catch (e) {
      message.error(toErrorMessage(e, '生成任务计划失败'))
    } finally {
      generatingPlan.value = false
    }
  }

  onMounted(load)

  return {
    branchOptions,
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
    loadingBranches,
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
