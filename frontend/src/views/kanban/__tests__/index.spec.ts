import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import KanbanView from '@/views/kanban/index.vue'

const { projectsApi, tasksApi } = vi.hoisted(() => ({
  projectsApi: {
    list: vi.fn(),
  },
  tasksApi: {
    list: vi.fn(),
  },
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

const createTask = (projectId: string) => ({
  id: `task-${projectId}`,
  projectId,
  mode: 'conversation' as const,
  title: `Task ${projectId}`,
  status: 'todo' as const,
  description: '',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
})

beforeEach(() => {
  vi.clearAllMocks()

  projectsApi.list.mockResolvedValue({
    data: [
      {
        id: 'project-1',
        businessLineId: 'line-1',
        name: 'Project 1',
        gitUrl: 'git@example.com:project-1.git',
        defaultBranch: 'main',
      },
    ],
    hasNextPage: false,
  })

  tasksApi.list.mockImplementation((params?: { projectId?: string }) => {
    const projectId = params?.projectId ?? ''
    return Promise.resolve({
      data: projectId ? [createTask(projectId)] : [],
      hasNextPage: false,
    })
  })
})

describe('KanbanView project switching', () => {
  it('reloads tasks after projectId query changes', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/kanban',
          component: KanbanView,
        },
        {
          path: '/tasks/:id',
          component: KanbanView,
        },
      ],
    })
    await router.push({ path: '/kanban', query: { projectId: 'project-1' } })
    await router.isReady()

    const wrapper = mount(KanbanView, {
      global: {
        plugins: [pinia, router],
      },
    })

    await flushPromises()

    expect(tasksApi.list).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      projectId: 'project-1',
    })
    expect(wrapper.text()).toContain('Task project-1')

    await router.push({ path: '/kanban', query: { projectId: 'project-2' } })
    await flushPromises()

    expect(tasksApi.list).toHaveBeenLastCalledWith({
      page: 1,
      limit: 50,
      projectId: 'project-2',
    })
    expect(wrapper.text()).toContain('Task project-2')
  })
})
