import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TaskArtifactsPanel from '../TaskArtifactsPanel.vue'

const { tasksApi } = vi.hoisted(() => ({
  tasksApi: {
    gitArtifactsTree: vi.fn(),
    gitArtifactPreview: vi.fn(),
    getGitArtifactRawUrl: vi.fn(),
  },
}))

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

describe('TaskArtifactsPanel', () => {
  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null as never)

  beforeEach(() => {
    vi.clearAllMocks()

    tasksApi.gitArtifactsTree.mockResolvedValue({
      cwd: '.',
      entries: [],
      files: [
        {
          path: 'src/pages/index.vue',
          status: 'M',
          deleted: false,
        },
        {
          path: 'docs/guide/index.md',
          status: 'M',
          deleted: false,
        },
      ],
      artifactSource: {
        sourceType: 'commit_range',
        nodeId: 'node-1',
        beforeCommitSha: 'before-1',
        afterCommitSha: 'after-1',
      },
    })
    tasksApi.gitArtifactPreview.mockResolvedValue({
      path: 'docs/guide/index.md',
      previewType: 'text',
      tooLarge: false,
      size: 12,
      mimeType: 'text/markdown',
      text: '# hello',
      artifactSource: {
        sourceType: 'commit_range',
        nodeId: 'node-1',
        beforeCommitSha: 'before-1',
        afterCommitSha: 'after-1',
      },
    })
    tasksApi.getGitArtifactRawUrl.mockReturnValue('/raw')
  })

  afterEach(() => {
    getContextSpy.mockClear()
  })

  it('renders artifacts as a flat file list with file names only', async () => {
    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
        artifactFilePath: 'docs/guide/index.md',
      },
      global: {
        stubs: {
          FilePreviewCard: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('index.md')
    expect(wrapper.text()).toContain('index.vue')
    expect(wrapper.text()).not.toContain('docs')
    expect(wrapper.text()).not.toContain('guide')
    expect(wrapper.text()).not.toContain('src')
    expect(wrapper.text()).not.toContain('pages')
  })

  it('normalizes markdown previews for friendly rendering', async () => {
    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
      },
      global: {
        stubs: {
          FilePreviewCard: {
            props: ['preview'],
            template: '<div data-test="preview-type">{{ preview?.previewType }}</div>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="preview-type"]').text()).toBe('markdown')
  })

  it('does not reload preview when refresh does not touch the selected artifact', async () => {
    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
        artifactFilePath: 'docs/guide/index.md',
      },
      global: {
        stubs: {
          FilePreviewCard: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(tasksApi.gitArtifactPreview).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      refreshToken: 1,
      artifactRefreshPaths: ['src/pages/index.vue'],
    })
    await flushPromises()

    expect(tasksApi.gitArtifactsTree).toHaveBeenCalledTimes(2)
    expect(tasksApi.gitArtifactPreview).toHaveBeenCalledTimes(1)
  })

  it('reloads preview when the selected artifact node changes', async () => {
    tasksApi.gitArtifactsTree
      .mockResolvedValueOnce({
        cwd: '.',
        entries: [],
        files: [
          {
            path: 'src/pages/index.vue',
            status: 'M',
            deleted: false,
          },
          {
            path: 'docs/guide/index.md',
            status: 'M',
            deleted: false,
          },
        ],
        artifactSource: {
          sourceType: 'commit_range',
          nodeId: 'node-1',
          beforeCommitSha: 'before-1',
          afterCommitSha: 'after-1',
        },
      })
      .mockResolvedValueOnce({
        cwd: '.',
        entries: [],
        files: [
          {
            path: 'src/pages/index.vue',
            status: 'M',
            deleted: false,
          },
          {
            path: 'docs/guide/index.md',
            status: 'M',
            deleted: false,
          },
        ],
        artifactSource: {
          sourceType: 'commit_range',
          nodeId: 'node-2',
          beforeCommitSha: 'before-2',
          afterCommitSha: 'after-2',
        },
      })

    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
        artifactFilePath: 'docs/guide/index.md',
        artifactNodeId: 'node-1',
      },
      global: {
        stubs: {
          FilePreviewCard: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(tasksApi.gitArtifactPreview).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      artifactNodeId: 'node-2',
    })
    await flushPromises()

    expect(tasksApi.gitArtifactPreview).toHaveBeenCalledTimes(2)
    expect(tasksApi.gitArtifactPreview).toHaveBeenLastCalledWith(
      'task-1',
      'docs/guide/index.md',
      'node-2',
    )
  })

  it('reloads preview when the selected artifact path is part of the workspace changes', async () => {
    tasksApi.gitArtifactsTree.mockResolvedValue({
      cwd: '.',
      entries: [],
      files: [
        {
          path: 'src/pages/index.vue',
          status: 'M',
          deleted: false,
        },
        {
          path: 'docs/guide/index.md',
          status: 'M',
          deleted: false,
        },
      ],
      artifactSource: {
        sourceType: 'workspace_unstaged_fallback',
        nodeId: 'node-1',
        beforeCommitSha: null,
        afterCommitSha: null,
      },
    })

    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
        artifactFilePath: 'docs/guide/index.md',
      },
      global: {
        stubs: {
          FilePreviewCard: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(tasksApi.gitArtifactPreview).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      refreshToken: 1,
      artifactRefreshPaths: ['docs/guide/index.md'],
    })
    await flushPromises()

    expect(tasksApi.gitArtifactPreview).toHaveBeenCalledTimes(2)
  })

  it('renders fallback workspace artifacts for unfinished nodes', async () => {
    tasksApi.gitArtifactsTree.mockResolvedValueOnce({
      cwd: '.',
      entries: [],
      files: [
        {
          path: 'docs/guide/index.md',
          status: 'M',
          deleted: false,
        },
      ],
      artifactSource: {
        sourceType: 'workspace_unstaged_fallback',
        nodeId: 'node-2',
        beforeCommitSha: null,
        afterCommitSha: null,
      },
    })

    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
        artifactNodeId: 'node-2',
      },
      global: {
        stubs: {
          FilePreviewCard: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('index.md')
  })

  it('shows a friendly message for deleted commit-range artifacts instead of requesting preview', async () => {
    tasksApi.gitArtifactsTree.mockResolvedValueOnce({
      cwd: '.',
      entries: [],
      files: [
        {
          path: 'docs/guide/index.md',
          status: 'D',
          deleted: true,
        },
      ],
      artifactSource: {
        sourceType: 'commit_range',
        nodeId: 'node-1',
        beforeCommitSha: 'before-1',
        afterCommitSha: 'after-1',
      },
    })

    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
        artifactNodeId: 'node-1',
      },
      global: {
        stubs: {
          FilePreviewCard: {
            props: ['errorMessage'],
            template: '<div data-test="preview-error">{{ errorMessage }}</div>',
          },
        },
      },
    })

    await flushPromises()

    expect(tasksApi.gitArtifactPreview).not.toHaveBeenCalled()
    expect(wrapper.get('[data-test="preview-error"]').text()).toContain('已删除')
  })
})
