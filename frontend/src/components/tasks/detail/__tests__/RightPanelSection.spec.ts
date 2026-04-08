import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import RightPanelSection from '../RightPanelSection.vue'

describe('RightPanelSection', () => {
  it('enables terminal only when task environment is ready', () => {
    const receivedProps: Array<Record<string, unknown>> = []

    mount(RightPanelSection, {
      props: {
        taskId: 'task-1',
        environmentStatus: 'ready',
        environmentPreview: {
          status: 'unavailable',
        },
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskRightPanel: defineComponent({
            name: 'TaskRightPanelStub',
            props: {
              terminalEnabled: { type: Boolean, default: false },
              previewEnabled: { type: Boolean, default: false },
            },
            setup(props) {
              receivedProps.push({ ...props })
              return () => null
            },
          }),
        },
      },
    })

    expect(receivedProps[0]).toMatchObject({
      terminalEnabled: true,
      previewEnabled: false,
    })
  })

  it('disables terminal when task environment is not ready', () => {
    const receivedProps: Array<Record<string, unknown>> = []

    mount(RightPanelSection, {
      props: {
        taskId: 'task-1',
        environmentStatus: 'starting',
        environmentPreview: {
          status: 'ready',
          url: 'https://preview.example.com/p/task-1/',
        },
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskRightPanel: defineComponent({
            name: 'TaskRightPanelStub',
            props: {
              terminalEnabled: { type: Boolean, default: false },
              previewEnabled: { type: Boolean, default: false },
            },
            setup(props) {
              receivedProps.push({ ...props })
              return () => null
            },
          }),
        },
      },
    })

    expect(receivedProps[0]).toMatchObject({
      terminalEnabled: false,
      previewEnabled: true,
    })
  })
})
