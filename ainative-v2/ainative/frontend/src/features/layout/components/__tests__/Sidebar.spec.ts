import { describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'
import { RouterLinkStub, mount } from '@vue/test-utils'
import Sidebar from '@features/layout/components/Sidebar.vue'
import { SidebarProvider } from '@shared/ui/sidebar'

const { routeState } = vi.hoisted(() => ({
  routeState: {
    name: 'home' as string,
    params: {} as Record<string, unknown>,
  },
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()

  return {
    ...actual,
    useRoute: () => routeState,
  }
})

vi.mock('@app/stores/modules/access', () => ({
  useAccessStore: () => ({
    isPlatformAdmin: false,
  }),
}))

vi.mock('@features/layout/composables/useSidebarRecentTasks', () => ({
  useSidebarRecentTasks: () => ({
    tasks: ref([
      {
        id: 'task-1',
        title: '整理知识库目录',
        status: 'todo',
        projectId: 'p1',
        createdAt: '2026-03-27T07:00:00.000Z',
        updatedAt: '2026-03-27T08:00:00.000Z',
      },
      {
        id: 'task-2',
        title: '修复回复按钮样式',
        status: 'in_progress',
        projectId: 'p1',
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T10:00:00.000Z',
      },
      {
        id: 'task-3',
        title: '等待人工确认方案',
        status: 'in_review',
        projectId: 'p1',
        createdAt: '2026-03-27T11:00:00.000Z',
        updatedAt: '2026-03-27T12:00:00.000Z',
      },
      {
        id: 'task-4',
        title: '归档登录页配色优化',
        status: 'done',
        projectId: 'p1',
        createdAt: '2026-03-27T13:00:00.000Z',
        updatedAt: '2026-03-27T14:00:00.000Z',
      },
    ]),
    loading: ref(false),
    refresh: vi.fn(),
  }),
  taskStatusLabel: (status: string) => status,
  formatTaskShortTime: () => '03/27 18:00',
}))

const mountWithProvider = (sidebarProps: Record<string, unknown>) => {
  return mount(
    {
      setup() {
        return () =>
          h(SidebarProvider, null, {
            default: () => h(Sidebar, sidebarProps as never),
          })
      },
    },
    {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    },
  )
}

describe('Sidebar menu scope', () => {
  it('renders core nav and business line footer links to manage page', () => {
    routeState.name = 'home'
    routeState.params = {}

    const wrapper = mountWithProvider({
      currentBusinessLineName: 'Retail',
      selectedProjectId: 'p1',
      projectItems: [
        {
          id: 'p1',
          name: '葱搭 Workspace',
        },
      ],
      hasSelectedProject: true,
      sidebarCoreTasksKnowledge: {
        tasks: { id: 'tasks', label: '新建任务', to: '/tasks' },
        goals: { id: 'goals', label: '需求', to: '/projects/p1/goals' },
        knowledge: { id: 'knowledge', label: '知识库', to: '/knowledge-base' },
      },
      projectNavigationTo: (projectId: string) => ({ path: '/dashboard', query: { projectId } }),
      workbenchNavTo: { path: '/dashboard', query: { projectId: 'p1' } },
      isWorkbenchNavActive: () => false,
      isNavActive: () => false,
      isBusinessLineManageActive: false,
      isSettingsActive: false,
    })

    expect(wrapper.text()).toContain('Retail')
    expect(wrapper.text()).toContain('葱搭')
    expect(wrapper.text()).toContain('工作台')
      expect(wrapper.text()).toContain('需求')
    expect(wrapper.text()).toContain('新建任务')
    expect(wrapper.text()).toContain('知识库')
    expect(wrapper.text()).toContain('葱搭 Workspace')
    expect(wrapper.text()).not.toContain('新建项目')
    expect(wrapper.findAllComponents(RouterLinkStub)[0]?.props('to')).toBe('/home')

    const businessLineLink = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.props('to') === '/business-lines')
    expect(businessLineLink).toBeDefined()
    expect(businessLineLink?.text()).toContain('业务线')

    const settingsLink = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.props('to') === '/settings')
    expect(settingsLink).toBeDefined()
    expect(settingsLink?.text()).toContain('设置')
  })

  it('shows hint when no project is selected', () => {
    routeState.name = 'home'
    routeState.params = {}

    const wrapper = mountWithProvider({
      currentBusinessLineName: 'Retail',
      selectedProjectId: '',
      projectItems: [],
      hasSelectedProject: false,
      sidebarCoreTasksKnowledge: {
        tasks: { id: 'tasks', label: '新建任务', to: '/tasks' },
        goals: { id: 'goals', label: '需求', to: '/dashboard' },
        knowledge: { id: 'knowledge', label: '知识库', to: '/knowledge-base' },
      },
      projectNavigationTo: (projectId: string) => ({ path: '/dashboard', query: { projectId } }),
      workbenchNavTo: { path: '/home' },
      isWorkbenchNavActive: () => false,
      isNavActive: () => false,
      isBusinessLineManageActive: false,
      isSettingsActive: false,
    })

    expect(wrapper.text()).toContain('Retail')
    expect(wrapper.text()).toContain('请先选择项目')
    expect(wrapper.text()).not.toContain('仪表盘')
  })

  it('highlights the active recent task on task detail route', () => {
    routeState.name = 'task-detail'
    routeState.params = { id: 'task-2' }

    const wrapper = mountWithProvider({
      currentBusinessLineName: 'Retail',
      selectedProjectId: 'p1',
      projectItems: [
        {
          id: 'p1',
          name: '葱搭 Workspace',
        },
      ],
      hasSelectedProject: true,
      sidebarCoreTasksKnowledge: {
        tasks: { id: 'tasks', label: '新建任务', to: '/tasks' },
        knowledge: { id: 'knowledge', label: '知识库', to: '/knowledge-base' },
      },
      projectNavigationTo: (projectId: string) => ({ path: '/dashboard', query: { projectId } }),
      workbenchNavTo: { path: '/dashboard', query: { projectId: 'p1' } },
      isWorkbenchNavActive: () => false,
      isNavActive: () => false,
      isBusinessLineManageActive: false,
      isSettingsActive: false,
    })

    const activeLink = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.text().includes('修复回复按钮样式'))

    expect(activeLink?.attributes('aria-current')).toBe('page')
    expect(activeLink?.attributes('class')).toContain('bg-primary/10')
    expect(activeLink?.attributes('class')).toContain('text-foreground')
  })

  it('renders status dots and only animates in-progress tasks', () => {
    routeState.name = 'home'
    routeState.params = {}

    const wrapper = mountWithProvider({
      currentBusinessLineName: 'Retail',
      selectedProjectId: 'p1',
      projectItems: [
        {
          id: 'p1',
          name: '葱搭 Workspace',
        },
      ],
      hasSelectedProject: true,
      sidebarCoreTasksKnowledge: {
        tasks: { id: 'tasks', label: '新建任务', to: '/tasks' },
        knowledge: { id: 'knowledge', label: '知识库', to: '/knowledge-base' },
      },
      projectNavigationTo: (projectId: string) => ({ path: '/dashboard', query: { projectId } }),
      workbenchNavTo: { path: '/dashboard', query: { projectId: 'p1' } },
      isWorkbenchNavActive: () => false,
      isNavActive: () => false,
      isBusinessLineManageActive: false,
      isSettingsActive: false,
    })

    const todoDot = wrapper.get('[data-task-id="task-1"] .sidebar-task-status-dot')
    const inProgressDot = wrapper.get('[data-task-id="task-2"] .sidebar-task-status-dot')
    const inReviewDot = wrapper.get('[data-task-id="task-3"] .sidebar-task-status-dot')
    const doneDot = wrapper.get('[data-task-id="task-4"] .sidebar-task-status-dot')

    expect(todoDot.attributes('data-status')).toBe('todo')
    expect(todoDot.classes()).toContain('text-muted-foreground/45')
    expect(todoDot.classes()).not.toContain('sidebar-task-status-dot-running')

    expect(inProgressDot.attributes('data-status')).toBe('in_progress')
    expect(inProgressDot.classes()).toContain('text-sky-500')
    expect(inProgressDot.classes()).toContain('sidebar-task-status-dot-running')

    expect(inReviewDot.attributes('data-status')).toBe('in_review')
    expect(inReviewDot.classes()).toContain('text-amber-500')
    expect(inReviewDot.classes()).not.toContain('sidebar-task-status-dot-running')

    expect(doneDot.attributes('data-status')).toBe('done')
    expect(doneDot.classes()).toContain('text-emerald-500')
    expect(doneDot.classes()).not.toContain('sidebar-task-status-dot-running')
  })
})
