import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskGitPanel from '../TaskGitPanel.vue'

const { tasksApi } = vi.hoisted(() => ({
  tasksApi: {
    gitStatus: vi.fn(),
    gitDiff: vi.fn(),
    workspacePreview: vi.fn(),
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
      ],
    })
    tasksApi.gitDiff.mockResolvedValue({
      diffText: '',
    })
    tasksApi.workspacePreview.mockResolvedValue({
      path: 'docs/feature/20260319-111330/brainstorm.md',
      previewType: 'text',
      tooLarge: false,
      size: 12,
      mimeType: 'text/markdown',
      text: '# Brainstorm\n\ncontent',
    })
  })

  it('falls back to workspace preview for untracked files without git diff output', async () => {
    const wrapper = mount(TaskGitPanel, {
      props: {
        taskId: 'task-1',
      },
    })

    await flushPromises()

    const fileRow = wrapper
      .findAll('[role="button"]')
      .find((node) => node.text().includes('docs/feature/20260319-111330/brainstorm.md'))

    expect(fileRow).toBeDefined()

    await fileRow!.trigger('click')
    await flushPromises()

    expect(tasksApi.gitDiff).toHaveBeenCalledWith('task-1', {
      path: 'docs/feature/20260319-111330/brainstorm.md',
      staged: false,
    })
    expect(tasksApi.workspacePreview).toHaveBeenCalledWith(
      'task-1',
      'docs/feature/20260319-111330/brainstorm.md',
    )
    expect(wrapper.text()).toContain('# Brainstorm')
    expect(wrapper.text()).toContain('content')
  })
})
