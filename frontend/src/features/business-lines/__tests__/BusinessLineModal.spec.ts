import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BusinessLineModal from '@features/business-lines/BusinessLineModal.vue'

describe('BusinessLineModal', () => {
  it('renders the modal shell and forwards modal mode to the shared panel', () => {
    const wrapper = mount(BusinessLineModal, {
      props: {
        open: true,
        canCreateBusinessLine: true,
        activeBusinessLineId: 'line-1',
        selectedProjectId: 'project-1',
        lines: [
          {
            id: 'line-1',
            name: 'Retail',
            description: 'Retail team',
            owner: '-',
            projectCount: 1,
          },
        ],
        projects: [],
      },
      global: {
        stubs: {
          teleport: true,
          BusinessLineManagementPanel: {
            name: 'BusinessLineManagementPanel',
            props: [
              'mode',
              'lines',
              'projects',
              'activeBusinessLineId',
              'selectedProjectId',
              'canCreateBusinessLine',
            ],
            template: '<div data-testid="management-panel" />',
          },
        },
      },
    })

    expect(wrapper.find('[aria-label="关闭业务线弹窗"]').exists()).toBe(true)

    const panel = wrapper.findComponent({ name: 'BusinessLineManagementPanel' })
    expect(panel.exists()).toBe(true)
    expect(panel.props('mode')).toBe('modal')
    expect(panel.props('activeBusinessLineId')).toBe('line-1')
  })

  it('closes when clicking the overlay', async () => {
    const wrapper = mount(BusinessLineModal, {
      props: {
        open: true,
        canCreateBusinessLine: true,
        activeBusinessLineId: 'line-1',
        selectedProjectId: '',
        lines: [],
        projects: [],
      },
      global: {
        stubs: {
          teleport: true,
          BusinessLineManagementPanel: true,
        },
      },
    })

    await wrapper.find('[aria-label="关闭业务线弹窗"]').trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})
