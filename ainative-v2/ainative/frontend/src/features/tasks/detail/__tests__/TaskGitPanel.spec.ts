import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskGitPanel from '../TaskGitPanel.vue'

const { tasksApi } = vi.hoisted(() => ({
  tasksApi: {
    gitStatus: vi.fn(),
    gitDiff: vi.fn(),
    gitBranchDiffFiles: vi.fn(),
    gitBranchDiff: vi.fn(),
    gitLog: vi.fn(),
    gitStage: vi.fn(),
    gitUnstage: vi.fn(),
    gitCommit: vi.fn(),
    gitPush: vi.fn(),
    gitMerge: vi.fn(),
    gitRebase: vi.fn(),
    gitPrLink: vi.fn(),
  },
}))

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

describe('TaskGitPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    tasksApi.gitStatus.mockResolvedValue({
      branchName: 'feature/demo',
      baseBranch: 'main',
      files: [
        {
          path: 'docs/feature/20260319-111330/brainstorm.md',
          status: '??',
          staged: false,
        },
        {
          path: 'src/modules/demo.ts',
          status: 'M ',
          staged: true,
        },
      ],
    })
    tasksApi.gitDiff.mockResolvedValue({
      diffText: '',
    })
  })

  it('shows a git-only fallback message for untracked files without diff output', async () => {
    const wrapper = mount(TaskGitPanel, {
      props: {
        taskId: 'task-1',
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('docs')
    expect(wrapper.text()).toContain('feature')
    expect(wrapper.text()).toContain('20260319-111330')
    expect(wrapper.text()).toContain('brainstorm.md')
    expect(wrapper.text()).toContain('src')
    expect(wrapper.text()).toContain('modules')
    expect(wrapper.text()).toContain('demo.ts')

    const fileRow = wrapper.findAll('button').find((node) => node.text().includes('brainstorm.md'))

    expect(fileRow).toBeDefined()

    await fileRow!.trigger('click')
    await flushPromises()

    expect(tasksApi.gitDiff).toHaveBeenCalledWith('task-1', {
      path: 'docs/feature/20260319-111330/brainstorm.md',
      staged: false,
    })
    expect(wrapper.text()).toContain('未跟踪文件暂无 diff，可前往文件面板查看原始内容。')
  })
})
