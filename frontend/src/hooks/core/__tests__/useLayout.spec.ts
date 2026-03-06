import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLayout } from '@/hooks/core/useLayout'
import { STORAGE_KEYS } from '@/types/common/storage'

const { businessLinesApi, projectsApi, routeState, routerReplace, routerPush } = vi.hoisted(() => ({
  businessLinesApi: {
    list: vi.fn(),
  },
  projectsApi: {
    list: vi.fn(),
  },
  routeState: {
    name: 'dashboard',
    path: '/dashboard',
    fullPath: '/dashboard',
    params: {},
    query: {},
    meta: {},
  },
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    replace: routerReplace,
    push: routerPush,
  }),
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi,
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

describe('useLayout business line selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    routeState.name = 'dashboard'
    routeState.path = '/dashboard'
    routeState.fullPath = '/dashboard'
    routeState.params = {}
    routeState.query = {}
    routeState.meta = {}

    const storage = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem(key: string) {
          return storage.get(key) ?? null
        },
        setItem(key: string, value: string) {
          storage.set(key, String(value))
        },
        removeItem(key: string) {
          storage.delete(key)
        },
        clear() {
          storage.clear()
        },
      },
    })

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })

    businessLinesApi.list.mockResolvedValue({
      data: [
        { id: 'line-1', name: 'Line 1', description: '', owner: '-' },
        { id: 'line-2', name: 'Line 2', description: '', owner: '-' },
      ],
      hasNextPage: false,
    })

    projectsApi.list.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          name: 'Project 1',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p1.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'project-2',
          name: 'Project 2',
          businessLineId: 'line-2',
          description: '',
          gitUrl: 'https://git.example.com/p2.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      hasNextPage: false,
    })

    localStorage.setItem(STORAGE_KEYS.lastSelectedProjectId, 'project-1')
  })

  it('keeps manually selected business line and clears project until user reselects one', async () => {
    setActivePinia(createPinia())

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="active-line">{{ activeBusinessLineId }}</p>
          <p data-testid="selected-project">{{ selectedProjectId }}</p>
          <p data-testid="current-project">{{ currentProjectName }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    expect(wrapper.get('[data-testid="active-line"]').text()).toBe('line-1')
    expect(wrapper.get('[data-testid="selected-project"]').text()).toBe('project-1')
    expect(wrapper.get('[data-testid="current-project"]').text()).toBe('Project 1')

    ;(wrapper.vm as { selectBusinessLine: (businessLineId: string) => void }).selectBusinessLine('line-2')
    await nextTick()

    expect(wrapper.get('[data-testid="active-line"]').text()).toBe('line-2')
    expect(wrapper.get('[data-testid="selected-project"]').text()).toBe('')
    expect(wrapper.get('[data-testid="current-project"]').text()).toBe('未选择项目')
    expect(localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId)).toBeNull()
  })

  it('uses unique project short labels when names share the same prefix', async () => {
    setActivePinia(createPinia())

    projectsApi.list.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          name: 'test1',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p1.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'project-2',
          name: 'test2',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p2.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'project-3',
          name: 'test3',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p3.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      hasNextPage: false,
    })

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="project-shorts">{{ projectItems.map((item) => item.short).join(',') }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    expect(wrapper.get('[data-testid="project-shorts"]').text()).toBe('TES1,TES2,TES3')
  })

  it('includes git entry in sidebar menu items', async () => {
    setActivePinia(createPinia())

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="menu-paths">{{ menuItems.map((item) => item.to).join(',') }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    const menuPaths = wrapper.get('[data-testid="menu-paths"]').text().split(',')
    expect(menuPaths).toContain('/git')
  })

  it('hides project name before project data is ready and shows it after loading', async () => {
    setActivePinia(createPinia())

    let resolveBusinessLines: ((value: unknown) => void) | undefined
    let resolveProjects: ((value: unknown) => void) | undefined

    businessLinesApi.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBusinessLines = resolve
        }),
    )

    projectsApi.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProjects = resolve
        }),
    )

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="show-current-project">{{ showCurrentProjectName ? '1' : '0' }}</p>
          <p data-testid="current-project">{{ currentProjectName }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await nextTick()

    expect(wrapper.get('[data-testid="show-current-project"]').text()).toBe('0')

    if (typeof resolveBusinessLines !== 'function' || typeof resolveProjects !== 'function') {
      throw new Error('mock resolver not initialized')
    }

    resolveBusinessLines({
      data: [{ id: 'line-1', name: 'Line 1', description: '', owner: '-' }],
      hasNextPage: false,
    })

    resolveProjects({
      data: [
        {
          id: 'project-1',
          name: 'Project 1',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p1.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      hasNextPage: false,
    })

    await flushPromises()

    expect(wrapper.get('[data-testid="show-current-project"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="current-project"]').text()).toBe('Project 1')
  })

  it('does not auto select the first project when there is no route or stored project', async () => {
    setActivePinia(createPinia())
    localStorage.removeItem(STORAGE_KEYS.lastSelectedProjectId)

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="active-line">{{ activeBusinessLineId }}</p>
          <p data-testid="selected-project">{{ selectedProjectId }}</p>
          <p data-testid="has-selected-project">{{ hasSelectedProject ? '1' : '0' }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    expect(wrapper.get('[data-testid="active-line"]').text()).toBe('line-1')
    expect(wrapper.get('[data-testid="selected-project"]').text()).toBe('')
    expect(wrapper.get('[data-testid="has-selected-project"]').text()).toBe('0')
  })

  it('navigates to stored menu path when selecting project from non-menu route', async () => {
    setActivePinia(createPinia())
    routeState.path = '/settings'
    routeState.fullPath = '/settings'
    localStorage.setItem(STORAGE_KEYS.lastSelectedMenuPath, '/tasks')

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: '<div />',
    })

    const wrapper = mount(Harness)
    await flushPromises()

    ;(wrapper.vm as { selectProject: (projectId: string) => void }).selectProject('project-2')
    await nextTick()

    expect(routerPush).toHaveBeenCalledWith({
      path: '/tasks',
      query: {
        projectId: 'project-2',
      },
    })
    expect(localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId)).toBe('project-2')
    expect(localStorage.getItem(STORAGE_KEYS.lastSelectedMenuPath)).toBe('/tasks')
  })

  it('falls back to first menu when no previous menu is stored', async () => {
    setActivePinia(createPinia())
    routeState.path = '/settings'
    routeState.fullPath = '/settings'
    localStorage.removeItem(STORAGE_KEYS.lastSelectedMenuPath)

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: '<div />',
    })

    const wrapper = mount(Harness)
    await flushPromises()

    ;(wrapper.vm as { selectProject: (projectId: string) => void }).selectProject('project-1')
    await nextTick()

    expect(routerPush).toHaveBeenCalledWith({
      path: '/dashboard',
      query: {
        projectId: 'project-1',
      },
    })
    expect(localStorage.getItem(STORAGE_KEYS.lastSelectedMenuPath)).toBe('/dashboard')
  })

  it('should fallback to valid project when route query projectId is invalid', async () => {
    setActivePinia(createPinia())
    routeState.name = 'tasks'
    routeState.path = '/tasks'
    routeState.fullPath = '/tasks?projectId=invalid-task-id'
    routeState.query = {
      projectId: 'invalid-task-id',
    }

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="active-line">{{ activeBusinessLineId }}</p>
          <p data-testid="selected-project">{{ selectedProjectId }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    expect(wrapper.get('[data-testid="active-line"]').text()).toBe('line-1')
    expect(wrapper.get('[data-testid="selected-project"]').text()).toBe('project-1')
    expect(routerReplace).toHaveBeenCalledWith({
      path: '/tasks',
      query: {
        projectId: 'project-1',
      },
    })
  })

  it('keeps kanban menu active on task detail when opened from kanban', async () => {
    setActivePinia(createPinia())
    localStorage.setItem(STORAGE_KEYS.lastSelectedMenuPath, '/kanban')
    routeState.name = 'task-detail'
    routeState.path = '/task-detail/task-1'
    routeState.fullPath = '/task-detail/task-1?projectId=project-1'
    routeState.params = {
      id: 'task-1',
    }
    routeState.query = {
      projectId: 'project-1',
    }

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="kanban-class">{{ menuItemClass('/kanban') }}</p>
          <p data-testid="tasks-class">{{ menuItemClass('/tasks') }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    expect(wrapper.get('[data-testid="kanban-class"]').text()).toContain('text-sidebar-accent-foreground')
    expect(wrapper.get('[data-testid="tasks-class"]').text()).toContain('text-sidebar-foreground/75')
    expect(localStorage.getItem(STORAGE_KEYS.lastSelectedMenuPath)).toBe('/kanban')
  })

  it('navigates back to kanban when selecting project from task detail opened via kanban', async () => {
    setActivePinia(createPinia())
    localStorage.setItem(STORAGE_KEYS.lastSelectedMenuPath, '/kanban')
    routeState.name = 'task-detail'
    routeState.path = '/task-detail/task-1'
    routeState.fullPath = '/task-detail/task-1?projectId=project-1'
    routeState.params = {
      id: 'task-1',
    }
    routeState.query = {
      projectId: 'project-1',
    }

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: '<div />',
    })

    const wrapper = mount(Harness)
    await flushPromises()

    ;(wrapper.vm as { selectProject: (projectId: string) => void }).selectProject('project-2')
    await nextTick()

    expect(routerPush).toHaveBeenCalledWith({
      path: '/kanban',
      query: {
        projectId: 'project-2',
      },
    })
  })
})
