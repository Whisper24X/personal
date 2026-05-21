import { defineComponent, ref, type ComponentPublicInstance, type Ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGoalDetailPlanItems } from '@features/goals/composables/useGoalDetailPlanItems'
import type { Goal, GoalDetail, GoalPlanItem, GoalPlanSubTask } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'

const {
  error,
  goalsApi,
  goTask,
  refreshSidebarRecentTasks,
  requestSidebarRecentTasksRefresh,
  success,
  warning,
} = vi.hoisted(() => ({
  error: vi.fn(),
  goalsApi: {
    materializeTasks: vi.fn(),
    patchPlanSubTask: vi.fn(),
  },
  goTask: vi.fn(),
  refreshSidebarRecentTasks: vi.fn(),
  requestSidebarRecentTasksRefresh: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/api/goals', () => ({
  goalsApi,
}))

vi.mock('@app/composables/useMessage', () => ({
  useMessage: () => ({
    error,
    success,
    warning,
  }),
}))

vi.mock('@features/layout', () => ({
  requestSidebarRecentTasksRefresh,
}))

vi.mock('@shared/utils/sidebar-recent-tasks-refresh', () => ({
  refreshSidebarRecentTasks,
}))

vi.mock('@features/tasks', () => ({
  mergeTaskBranchIntoBase: vi.fn(),
}))

type HarnessVm = ComponentPublicInstance & {
  confirmPlanItemFromSheet: () => Promise<void>
  materializeSingleSubTask: (item: GoalPlanSubTask) => Promise<void>
  openPlanItemDetail: (sub: GoalPlanSubTask, groupTitle: string) => void
}

const mountedWrappers: VueWrapper[] = []

function createGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    projectId: 'project-1',
    title: '需求详情',
    status: 'planned',
    prdDocPath: null,
    planDocPath: null,
    defaultWorkflowTemplateId: null,
    agentCliId: 'codex',
    agentCliConfigId: 'cfg-1',
    gitBaseBranch: 'main',
    gitBranch: 'feature/goal-1',
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function createPlanSubTask(overrides: Partial<GoalPlanSubTask> = {}): GoalPlanSubTask {
  return {
    id: 'sub-task-1',
    goalPlanItemId: 'plan-item-1',
    title: '子任务',
    summary: null,
    acceptanceCriteria: null,
    suggestedPrompt: null,
    dependsOnSubTaskIds: [],
    itemOrder: 0,
    taskId: null,
    workflowTemplateId: 'workflow-1',
    status: 'approved',
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
    ...overrides,
  }
}

function createPlanItem(subTask: GoalPlanSubTask): GoalPlanItem {
  return {
    id: 'plan-item-1',
    goalId: 'goal-1',
    title: '功能组',
    summary: null,
    acceptanceCriteria: null,
    suggestedPrompt: null,
    dependsOnItemIds: [],
    itemOrder: 0,
    gitBranch: 'feature/group-1',
    groupMergedIntoGoalAt: null,
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
    subTasks: [subTask],
  }
}

function createGoalDetail(subTask: GoalPlanSubTask): GoalDetail {
  return {
    goal: createGoal(),
    sourceDocs: [],
    planItems: [createPlanItem(subTask)],
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

function mountHarness(detail: Ref<GoalDetail | null>, load = vi.fn().mockResolvedValue(undefined)) {
  const Harness = defineComponent({
    setup() {
      return useGoalDetailPlanItems({
        detail,
        goalId: ref('goal-1'),
        goTask,
        load,
        workflowTemplates: ref<WorkflowTemplate[]>([]),
      })
    },
    template: '<div />',
  })

  const wrapper = mount(Harness)
  mountedWrappers.push(wrapper)
  return { load, vm: wrapper.vm as HarnessVm }
}

describe('useGoalDetailPlanItems materialize navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshSidebarRecentTasks.mockResolvedValue(undefined)
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount()
    }
  })

  it('navigates to the task detail after materializing from the plan table', async () => {
    const subTask = createPlanSubTask()
    const detail = ref(createGoalDetail(subTask))
    const { load, vm } = mountHarness(detail)
    goalsApi.materializeTasks.mockResolvedValue({
      tasks: [{ planSubTaskId: subTask.id, taskId: 'task-created-1' }],
    })

    await vm.materializeSingleSubTask(subTask)
    await flushPromises()

    expect(goalsApi.materializeTasks).toHaveBeenCalledWith('goal-1', [subTask.id])
    expect(requestSidebarRecentTasksRefresh).toHaveBeenCalledTimes(1)
    expect(success).toHaveBeenCalledWith('已创建任务')
    expect(load).toHaveBeenCalledTimes(1)
    expect(goTask).toHaveBeenCalledWith('task-created-1')
  })

  it('navigates to the task detail after confirming and materializing from the sheet', async () => {
    const draftSubTask = createPlanSubTask({ status: 'draft' })
    const approvedSubTask = { ...draftSubTask, status: 'approved' as const }
    const detail = ref(createGoalDetail(draftSubTask))
    const { load, vm } = mountHarness(detail)
    goalsApi.patchPlanSubTask
      .mockResolvedValueOnce(draftSubTask)
      .mockResolvedValueOnce(approvedSubTask)
    goalsApi.materializeTasks.mockResolvedValue({
      tasks: [{ planSubTaskId: draftSubTask.id, taskId: 'task-created-2' }],
    })

    vm.openPlanItemDetail(draftSubTask, '功能组')
    await vm.confirmPlanItemFromSheet()
    await flushPromises()

    expect(goalsApi.materializeTasks).toHaveBeenCalledWith('goal-1', [draftSubTask.id])
    expect(requestSidebarRecentTasksRefresh).toHaveBeenCalledTimes(1)
    expect(success).toHaveBeenCalledWith('已确认并创建任务')
    expect(load).toHaveBeenCalledTimes(1)
    expect(goTask).toHaveBeenCalledWith('task-created-2')
  })
})
