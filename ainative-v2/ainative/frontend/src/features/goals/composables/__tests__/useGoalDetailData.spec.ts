import { defineComponent, type ComponentPublicInstance } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGoalDetailData } from '@features/goals/composables/useGoalDetailData'
import { readGoalGenerationPending } from '@features/goals/utils/goal-generation-pending'
import type { Goal, GoalDetail, GoalPlanItem } from '@/types/api/goals'

const routeState: { params: { goalId?: string } } = {
  params: {},
}

const { error, fetchAllPages, goalsApi, info, push, success, warning, workflowApi } =
  vi.hoisted(() => ({
    error: vi.fn(),
    fetchAllPages: vi.fn(),
    goalsApi: {
      generatePlan: vi.fn(),
      generatePrd: vi.fn(),
      get: vi.fn(),
    },
    info: vi.fn(),
    push: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    workflowApi: {
      list: vi.fn(),
    },
  }))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')

  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({
      back: vi.fn(),
      push,
    }),
  }
})

vi.mock('@/api/goals', () => ({
  goalsApi,
}))

vi.mock('@/api/workflow', () => ({
  workflowApi,
}))

vi.mock('@app/composables/useMessage', () => ({
  useMessage: () => ({
    error,
    info,
    success,
    warning,
  }),
}))

vi.mock('@shared/utils/pagination', () => ({
  fetchAllPages,
}))

type GoalDetailVm = ComponentPublicInstance & {
  generatingPlan: boolean
  generatingPrd: boolean
  runGeneratePlan: () => Promise<void>
  runGeneratePrd: () => Promise<void>
}

const Harness = defineComponent({
  setup() {
    return useGoalDetailData()
  },
  template: '<div />',
})

const mountedWrappers: VueWrapper[] = []

function createGoalDetail(
  overrides: Partial<Goal> & {
    id: string
    planItems?: GoalPlanItem[]
  },
): GoalDetail {
  const planItems = overrides.planItems ?? []

  return {
    goal: {
      id: overrides.id,
      projectId: 'project-1',
      title: '需求详情',
      status: overrides.status ?? 'draft',
      prdDocPath: overrides.prdDocPath ?? null,
      planDocPath: overrides.planDocPath ?? null,
      defaultWorkflowTemplateId: null,
      agentCliId: 'codex',
      agentCliConfigId: 'cfg-1',
      gitBaseBranch: 'main',
      gitBranch: `feature/${overrides.id}`,
      createdAt: '2026-05-14T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
      deletedAt: null,
    },
    sourceDocs: [],
    planItems,
    tasks: [],
    taskDependencies: [],
    progress: {
      doneTasks: 0,
      percent: 0,
      statusCounts: {
        done: 0,
        in_progress: 0,
        in_review: 0,
        todo: 0,
      },
      totalTasks: 0,
    },
  }
}

function createPlanItem(goalId: string): GoalPlanItem {
  return {
    id: 'plan-item-1',
    goalId,
    title: '功能组',
    summary: null,
    acceptanceCriteria: null,
    suggestedPrompt: null,
    dependsOnItemIds: [],
    itemOrder: 1,
    gitBranch: null,
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
    subTasks: [
      {
        id: 'sub-task-1',
        goalPlanItemId: 'plan-item-1',
        title: '子任务',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnSubTaskIds: [],
        itemOrder: 1,
        taskId: null,
        workflowTemplateId: null,
        status: 'draft',
        createdAt: '2026-05-14T00:00:00.000Z',
        updatedAt: '2026-05-14T00:00:00.000Z',
      },
    ],
  }
}

async function mountHarness(goalId: string, readDetail: () => GoalDetail) {
  routeState.params = { goalId }
  goalsApi.get.mockImplementation(async () => readDetail())
  const wrapper = mount(Harness)
  mountedWrappers.push(wrapper)
  await flushPromises()
  return wrapper.vm as GoalDetailVm
}

describe('useGoalDetailData generation refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    routeState.params = {}
    fetchAllPages.mockResolvedValue([])
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount()
    }
    localStorage.clear()
    sessionStorage.clear()
  })

  it('clears PRD generating state after the success refresh contains the generated PRD', async () => {
    const goalId = 'goal-prd-refresh'
    let detail = createGoalDetail({ id: goalId })
    const vm = await mountHarness(goalId, () => detail)

    goalsApi.generatePrd.mockImplementation(async () => {
      detail = createGoalDetail({
        id: goalId,
        prdDocPath: `goals/${goalId}/PRD.md`,
        status: 'prd_generated',
      })
      return { goal: detail.goal, markdownLength: 100 }
    })

    await vm.runGeneratePrd()
    await flushPromises()

    expect(success).toHaveBeenCalledWith('PRD 已生成')
    expect(goalsApi.get.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(vm.generatingPrd).toBe(false)
    expect(readGoalGenerationPending(goalId)).toBeNull()
  })

  it('keeps plan pending so polling continues when the success refresh is still stale', async () => {
    const goalId = 'goal-plan-stale'
    const detail = createGoalDetail({
      id: goalId,
      prdDocPath: `goals/${goalId}/PRD.md`,
      status: 'prd_generated',
    })
    const vm = await mountHarness(goalId, () => detail)

    goalsApi.generatePlan.mockResolvedValue({
      goal: {
        ...detail.goal,
        planDocPath: `goals/${goalId}/task-plan.md`,
        status: 'planned',
      },
      itemCount: 1,
      subTaskCount: 1,
    })

    await vm.runGeneratePlan()
    await flushPromises()

    expect(success).toHaveBeenCalledWith('任务计划已生成')
    expect(goalsApi.get.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(vm.generatingPlan).toBe(true)
    expect(readGoalGenerationPending(goalId)?.plan).toBe(true)
  })

  it('clears plan generating state after the success refresh contains plan sub tasks', async () => {
    const goalId = 'goal-plan-refresh'
    let detail = createGoalDetail({
      id: goalId,
      prdDocPath: `goals/${goalId}/PRD.md`,
      status: 'prd_generated',
    })
    const vm = await mountHarness(goalId, () => detail)

    goalsApi.generatePlan.mockImplementation(async () => {
      detail = createGoalDetail({
        id: goalId,
        planDocPath: `goals/${goalId}/task-plan.md`,
        prdDocPath: `goals/${goalId}/PRD.md`,
        status: 'planned',
        planItems: [createPlanItem(goalId)],
      })
      return {
        goal: detail.goal,
        itemCount: 1,
        subTaskCount: 1,
      }
    })

    await vm.runGeneratePlan()
    await flushPromises()

    expect(success).toHaveBeenCalledWith('任务计划已生成')
    expect(vm.generatingPlan).toBe(false)
    expect(readGoalGenerationPending(goalId)).toBeNull()
  })
})
