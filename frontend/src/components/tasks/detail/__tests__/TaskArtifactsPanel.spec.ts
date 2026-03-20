import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskArtifactsPanel from '../TaskArtifactsPanel.vue'

const { tasksApi } = vi.hoisted(() => ({
  tasksApi: {
    gitStatus: vi.fn(),
    gitArtifactPreview: vi.fn(),
    getGitArtifactRawUrl: vi.fn(),
  },
}))

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

describe('TaskArtifactsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    tasksApi.gitStatus.mockResolvedValue({
      branchName: 'feature/demo',
      baseBranch: 'main',
      files: [
        {
          path: 'src/pages/index.vue',
          status: ' M',
          staged: false,
        },
        {
          path: 'docs/guide/index.md',
          status: 'M ',
          staged: true,
        },
      ],
    })
    tasksApi.gitArtifactPreview.mockResolvedValue({
      path: 'docs/guide/index.md',
      previewType: 'text',
      tooLarge: false,
      size: 12,
      mimeType: 'text/markdown',
      text: '# hello',
    })
    tasksApi.getGitArtifactRawUrl.mockReturnValue('/raw')
  })

  it('renders artifacts as a flat file list with file names only', async () => {
    const wrapper = mount(TaskArtifactsPanel, {
      props: {
        taskId: 'task-1',
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
})
