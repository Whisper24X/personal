import { computed, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import BusinessLineManageView from '@pages/business-lines/manage.vue'
import { layoutWorkspaceKey } from '@features/layout/model/workspace.context'

describe('BusinessLineManageView', () => {
  it('renders the shared full-page management panel instead of the modal wrapper', () => {
    const selectBusinessLine = vi.fn(async () => undefined)
    const selectProject = vi.fn(async () => undefined)
    const refreshLayoutData = vi.fn(async () => undefined)

    const wrapper = mount(BusinessLineManageView, {
      global: {
        provide: {
          [layoutWorkspaceKey as symbol]: {
            hasAnyBusinessLine: computed(() => true),
            layoutDataLoading: ref(false),
            canCreateBusinessLine: computed(() => true),
            openBusinessLineModal: vi.fn(),
            businessLineItems: computed(() => [
              {
                id: 'line-1',
                name: 'Retail',
                owner: '-',
                projectCount: 1,
                description: 'Retail team',
              },
            ]),
            activeBusinessLineId: ref('line-1'),
            selectedProjectId: ref('project-1'),
            selectBusinessLine,
            selectProject,
            refreshLayoutData,
            projectItems: computed(() => []),
          },
        },
        stubs: {
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

    const panel = wrapper.findComponent({ name: 'BusinessLineManagementPanel' })
    expect(panel.exists()).toBe(true)
    expect(panel.props('mode')).toBe('page')
    expect(panel.props('activeBusinessLineId')).toBe('line-1')
    expect(wrapper.classes()).toContain('bg-background')
  })
})
