import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsModal from '@/components/settings/SettingsModal.vue'

describe('SettingsModal', () => {
  it('renders and emits events for close/select actions', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        open: true,
        activeSection: 'account',
        sections: ['account', 'appearance', 'notifications'],
      },
      global: {
        stubs: {
          teleport: true,
          PersonalSettingsPanel: {
            template: '<div>PersonalSettingsPanel</div>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('账号')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    const sectionButtons = wrapper.findAll('aside nav button')
    expect(sectionButtons).toHaveLength(3)

    const closeButton = wrapper.find('button[aria-label="关闭设置"]')
    await closeButton.trigger('click')
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})
