import { defineComponent, ref, type ComponentPublicInstance, type Ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGoalDetailPrd } from '@features/goals/composables/useGoalDetailPrd'
import type { Goal, GoalDetail } from '@/types/api/goals'
import type { GoalDetailTab } from '@features/goals/composables/useGoalDetailData'

const { error, goalsApi, success } = vi.hoisted(() => ({
  error: vi.fn(),
  goalsApi: {
    readPrdDoc: vi.fn(),
    updatePrdDoc: vi.fn(),
  },
  success: vi.fn(),
}))

vi.mock('@/api/goals', () => ({
  goalsApi,
}))

vi.mock('@app/composables/useMessage', () => ({
  useMessage: () => ({
    error,
    success,
  }),
}))

type HarnessVm = ComponentPublicInstance & {
  openPrdEditor: () => Promise<void>
  prdEditorContent: string
  prdPreviewContent: string
  savePrdEditor: () => Promise<void>
}

const mountedWrappers: VueWrapper[] = []

function createGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    projectId: 'project-1',
    title: '需求详情',
    status: 'prd_generated',
    prdDocPath: 'goals/goal-1/PRD.md',
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

function createGoalDetail(goal = createGoal()): GoalDetail {
  return {
    goal,
    sourceDocs: [],
    planItems: [],
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

function mountHarness(detail: Ref<GoalDetail | null>, tab: Ref<GoalDetailTab>) {
  const Harness = defineComponent({
    setup() {
      return useGoalDetailPrd({ detail, tab })
    },
    template: '<div />',
  })

  const wrapper = mount(Harness)
  mountedWrappers.push(wrapper)
  return wrapper as VueWrapper<HarnessVm>
}

describe('useGoalDetailPrd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount()
    }
  })

  it('loads PRD preview from goal API', async () => {
    const detail = ref<GoalDetail | null>(createGoalDetail())
    const tab = ref<GoalDetailTab>('plan')
    const wrapper = mountHarness(detail, tab)

    goalsApi.readPrdDoc.mockResolvedValue({ content: '# PRD' })
    tab.value = 'prd'
    await flushPromises()

    expect(goalsApi.readPrdDoc).toHaveBeenCalledWith('goal-1')
    expect(wrapper.vm.prdPreviewContent).toBe('# PRD')
  })

  it('opens and saves PRD through goal API', async () => {
    const detail = ref<GoalDetail | null>(createGoalDetail())
    const tab = ref<GoalDetailTab>('prd')
    const wrapper = mountHarness(detail, tab)

    goalsApi.readPrdDoc.mockResolvedValue({ content: '# PRD' })
    goalsApi.updatePrdDoc.mockResolvedValue({ content: '# Updated PRD' })

    await wrapper.vm.openPrdEditor()
    expect(goalsApi.readPrdDoc).toHaveBeenCalledWith('goal-1')
    expect(wrapper.vm.prdEditorContent).toBe('# PRD')

    wrapper.vm.prdEditorContent = '# Updated PRD'
    await wrapper.vm.savePrdEditor()

    expect(goalsApi.updatePrdDoc).toHaveBeenCalledWith('goal-1', {
      content: '# Updated PRD',
    })
    expect(success).toHaveBeenCalledWith('PRD 已保存')
  })
})
