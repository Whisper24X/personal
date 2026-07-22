import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
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
    vi.useRealTimers()

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
    tasksApi.gitPush.mockResolvedValue({
      success: true,
      message: '推送完成',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('shows a generic background push message when push returns operationId', async () => {
    tasksApi.gitPush.mockResolvedValueOnce({
      success: true,
      message: '推送已在后台开始，可继续使用页面，完成后会显示结果。',
      operationId: 'push-1',
    })
    tasksApi.gitStatus
      .mockResolvedValueOnce({
        branchName: 'feature/demo',
        baseBranch: 'main',
        files: [],
      })
      .mockResolvedValueOnce({
        branchName: 'feature/demo',
        baseBranch: 'main',
        files: [],
        operation: {
          id: 'push-1',
          type: 'push',
          status: 'running',
          startedAt: '2026-05-07T00:00:00.000Z',
          logs: ['推送已开始，正在后台执行中。'],
          message: '推送已在后台开始，可继续使用页面，完成后会显示结果。',
        },
      })

    const wrapper = mount(TaskGitPanel, {
      props: {
        taskId: 'task-1',
      },
    })

    await flushPromises()

    const operationsTab = wrapper.findAll('button').find((node) => node.text() === '操作')
    expect(operationsTab).toBeDefined()
    await operationsTab!.trigger('click')
    await flushPromises()

    const pushButton = wrapper.findAll('button').find((node) => node.text().includes('推送'))
    expect(pushButton).toBeDefined()

    await pushButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('后台推送已开始')
    expect(wrapper.text()).not.toContain('部署中')
  })

  it('shows success feedback when background push polling reaches success', async () => {
    vi.useFakeTimers()
    tasksApi.gitPush.mockResolvedValueOnce({
      success: true,
      message: '推送已在后台开始，可继续使用页面，完成后会显示结果。',
      operationId: 'push-1',
    })
    tasksApi.gitStatus
      .mockResolvedValueOnce({
        branchName: 'feature/demo',
        baseBranch: 'main',
        files: [],
      })
      .mockResolvedValueOnce({
        branchName: 'feature/demo',
        baseBranch: 'main',
        files: [],
        operation: {
          id: 'push-1',
          type: 'push',
          status: 'running',
          startedAt: '2026-05-07T00:00:00.000Z',
          logs: ['推送已开始，正在后台执行中。'],
          message: '推送已在后台开始，可继续使用页面，完成后会显示结果。',
        },
      })
      .mockResolvedValueOnce({
        branchName: 'feature/demo',
        baseBranch: 'main',
        files: [],
        operation: {
          id: 'push-1',
          type: 'push',
          status: 'success',
          startedAt: '2026-05-07T00:00:00.000Z',
          finishedAt: '2026-05-07T00:00:05.000Z',
          logs: ['推送已开始，正在后台执行中。', '[frontend] success'],
          message: '推送完成: 2 个子仓',
        },
      })
    tasksApi.gitBranchDiffFiles.mockResolvedValue({ baseBranch: 'main', currentBranch: 'feature/demo', files: [] })

    const wrapper = mount(TaskGitPanel, {
      props: {
        taskId: 'task-1',
      },
    })

    await flushPromises()

    const operationsTab = wrapper.findAll('button').find((node) => node.text() === '操作')
    expect(operationsTab).toBeDefined()
    await operationsTab!.trigger('click')
    await flushPromises()

    const pushButton = wrapper.findAll('button').find((node) => node.text().includes('推送'))
    await pushButton!.trigger('click')
    await flushPromises()

    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()

    expect(wrapper.text()).toContain('推送完成: 2 个子仓')
  })

  it('shows a commit-before-push error when backend rejects dirty workspace push', async () => {
    tasksApi.gitPush.mockResolvedValueOnce({
      success: false,
      message: '任务工作区存在未提交改动，请先填写提交信息并点击“提交”后再推送。',
    })

    const wrapper = mount(TaskGitPanel, {
      props: {
        taskId: 'task-1',
      },
    })

    await flushPromises()

    const operationsTab = wrapper.findAll('button').find((node) => node.text() === '操作')
    expect(operationsTab).toBeDefined()
    await operationsTab!.trigger('click')
    await flushPromises()

    const pushButton = wrapper.findAll('button').find((node) => node.text().includes('推送'))
    expect(pushButton).toBeDefined()

    await pushButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('任务工作区存在未提交改动，请先填写提交信息并点击“提交”后再推送。')
    expect(wrapper.text()).not.toContain('后台推送已开始')
  })
})
