import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import GitBranchManagementView from '@pages/git/index.vue'
import { gitApi } from '@/api/git'
import { useMessageStore } from '@app/stores/modules/message'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {
      projectId: 'project-1',
    },
  }),
}))

vi.mock('@/api/git', () => ({
  gitApi: {
    branchesDetail: vi.fn(),
    log: vi.fn(),
    pullBranch: vi.fn(),
    pushBranch: vi.fn(),
    deleteBranch: vi.fn(),
  },
}))

describe('GitBranchManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(gitApi.branchesDetail).mockResolvedValue({
      branches: [
        {
          name: 'main',
          type: 'both',
          isCurrent: true,
          tracking: 'origin/main',
          ahead: 0,
          behind: 2,
          lastCommit: {
            sha: '1111111',
            shortSha: '1111111',
            message: 'main commit',
            author: 'Alice',
            committedAt: '2026-03-19T08:00:00.000Z',
          },
        },
        {
          name: 'feature/demo',
          type: 'both',
          isCurrent: false,
          tracking: 'origin/feature/demo',
          ahead: 1,
          behind: 3,
          lastCommit: {
            sha: '2222222',
            shortSha: '2222222',
            message: 'feature commit',
            author: 'Bob',
            committedAt: '2026-03-19T09:00:00.000Z',
          },
        },
      ],
    })
    vi.mocked(gitApi.log).mockResolvedValue({
      commits: [],
    })
    vi.mocked(gitApi.pullBranch).mockResolvedValue({
      success: true,
      branch: 'main',
      output: 'Already up to date.',
    })
  })

  it('defaults to showing only the current branch and calls pull api for it', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(GitBranchManagementView, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    const buttons = wrapper.findAll('button')
    const pullButtons = buttons.filter((node) => node.text().includes('拉取'))

    expect(pullButtons).toHaveLength(1)
    expect(wrapper.text()).toContain('main')
    expect(wrapper.text()).not.toContain('feature/demo')

    await pullButtons[0]!.trigger('click')
    await flushPromises()

    expect(gitApi.pullBranch).toHaveBeenCalledWith('project-1', 'main')

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('success')
    expect(messageStore.items[0]?.text).toBe('已拉取分支 main')
  })

  it('does not render separator dots when commit metadata is missing', async () => {
    vi.mocked(gitApi.branchesDetail).mockResolvedValueOnce({
      branches: [
        {
          name: 'main',
          type: 'both',
          isCurrent: true,
          tracking: 'origin/main',
          ahead: 0,
          behind: 0,
          lastCommit: {
            sha: '',
            shortSha: '',
            message: 'main commit',
            author: '',
            committedAt: '',
          },
        },
      ],
    })

    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(GitBranchManagementView, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('main')
    expect(wrapper.text()).not.toMatch(/·\s*·/)
  })
})
