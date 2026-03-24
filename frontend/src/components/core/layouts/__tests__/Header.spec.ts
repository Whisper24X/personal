import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import Header from '@/components/core/layouts/Header.vue'
import { SidebarProvider } from '@/components/ui/sidebar'

const defaultHeaderProps = () => ({
  headerToolMenuItems: [],
  hasSelectedProject: false,
  selectedProjectId: '',
  isNavActive: () => false,
  userAvatarInitial: '?',
  userDisplayName: '用户',
})

const mountHeader = (props: Record<string, unknown>) => {
  return mount(
    {
      setup() {
        return () =>
          h(SidebarProvider, null, {
            default: () => h(Header, { ...defaultHeaderProps(), ...props } as never),
          })
      },
    },
    {},
  )
}

describe('Header', () => {
  it('renders page title and avatar initial', () => {
    const wrapper = mountHeader({
      pageTitle: '仪表盘',
      breadcrumbs: ['项目菜单', '仪表盘'],
    })

    expect(wrapper.text()).toContain('仪表盘')
    expect(wrapper.text()).toContain('?')
    expect(wrapper.find('[aria-label="账号头像"]').exists()).toBe(true)
  })
})
