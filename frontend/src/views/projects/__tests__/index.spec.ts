import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectsView from '@/views/projects/index.vue'
import { businessLinesApi } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'

vi.mock('@/hooks', () => ({
  useMessage: () => ({
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi: {
    list: vi.fn(),
  },
}))

vi.mock('@/api/projects', () => ({
  projectsApi: {
    list: vi.fn(),
  },
}))

vi.mock('@/utils/pagination', () => ({
  fetchAllPages: vi.fn(),
}))

import { fetchAllPages } from '@/utils/pagination'

describe('ProjectsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(fetchAllPages).mockResolvedValue([
      {
        id: 'line-1',
        name: 'Retail',
        description: 'Retail line',
      },
    ])

    vi.mocked(projectsApi.list).mockResolvedValue({
      data: [
        {
          id: 'project-1',
          businessLineId: 'line-1',
          name: 'AINative Workspace',
          description: 'Demo project',
          gitUrl: 'https://example.com/repo.git',
          defaultBranch: 'main',
          configJson: null,
          updatedAt: '2026-03-27T00:00:00.000Z',
        },
      ],
      hasNextPage: false,
    })
  })

  it('renders the projects list page and exposes the create project action', async () => {
    const wrapper = mount(ProjectsView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          Teleport: true,
        },
      },
    })

    await flushPromises()

    expect(fetchAllPages).toHaveBeenCalledTimes(1)
    expect(businessLinesApi.list).not.toHaveBeenCalled()
    expect(projectsApi.list).toHaveBeenCalledWith({ page: 1, limit: 50 })
    expect(wrapper.text()).toContain('业务线与项目')
    expect(wrapper.text()).toContain('项目筛选与操作')
    expect(wrapper.text()).toContain('新建项目')
    expect(wrapper.text()).toContain('AINative Workspace')
  })
})
