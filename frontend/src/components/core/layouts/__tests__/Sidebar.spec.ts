import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { RouterLinkStub, mount } from '@vue/test-utils'
import Sidebar from '@/components/core/layouts/Sidebar.vue'
import { SidebarProvider } from '@/components/ui/sidebar'

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
    const wrapper = mountWithProvider({
      currentBusinessLineName: 'Retail',
      selectedProjectId: 'p1',
      projectItems: [
        {
          id: 'p1',
          name: 'AINative Workspace',
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

    expect(wrapper.text()).toContain('Retail')
    expect(wrapper.text()).toContain('AINative')
    expect(wrapper.text()).toContain('工作台')
    expect(wrapper.text()).toContain('新建任务')
    expect(wrapper.text()).toContain('知识库')
    expect(wrapper.text()).toContain('AINative Workspace')
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
    const wrapper = mountWithProvider({
      currentBusinessLineName: 'Retail',
      selectedProjectId: '',
      projectItems: [],
      hasSelectedProject: false,
      sidebarCoreTasksKnowledge: {
        tasks: { id: 'tasks', label: '新建任务', to: '/tasks' },
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
})
