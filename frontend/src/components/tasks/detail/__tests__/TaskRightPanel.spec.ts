import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import TaskRightPanel from '../TaskRightPanel.vue'

describe('TaskRightPanel', () => {
  it('renders artifact tab first and selects it by default', () => {
    const wrapper = mount(TaskRightPanel, {
      props: {
        taskId: 'task-1',
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskArtifactsPanel: {
            name: 'TaskDetailArtifactsPanel',
            template: '<div data-test="artifacts-panel">artifacts</div>',
          },
          TaskPreviewPanel: {
            template: '<div data-test="preview-panel">preview</div>',
          },
          TaskFilesPanel: {
            template: '<div data-test="files-panel">files</div>',
          },
          TaskGitPanel: {
            template: '<div data-test="git-panel">git</div>',
          },
          TaskTerminalPanel: {
            template: '<div data-test="terminal-panel">terminal</div>',
          },
          TaskLogsPanel: {
            template: '<div data-test="logs-panel">logs</div>',
          },
        },
      },
    })

    const tabs = wrapper.findAll('button').map((node) => node.text().trim())

    expect(tabs).toContain('产物')
    expect(tabs).toContain('预览')
    expect(tabs).toContain('文件')
    expect(tabs).toContain('Git')
    expect(tabs).toContain('终端')
    expect(tabs).toContain('日志')
    expect(tabs).toContain('部署')
    expect(wrapper.find('[data-test="artifacts-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="preview-panel"]').exists()).toBe(false)
  })

  it('passes refreshToken to the preview panel', async () => {
    const previewProps: Array<Record<string, unknown>> = []
    const wrapper = mount(TaskRightPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
        refreshToken: 3,
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskArtifactsPanel: true,
          TaskPreviewPanel: defineComponent({
            name: 'TaskDetailPreviewPanelStub',
            props: {
              taskId: { type: String, required: true },
              projectId: { type: String, default: '' },
              refreshToken: { type: Number, default: 0 },
            },
            setup(props) {
              previewProps.push({ ...props })
              return () => null
            },
          }),
          TaskFilesPanel: true,
          TaskGitPanel: true,
          TaskTerminalPanel: true,
          TaskLogsPanel: true,
          TaskDeployPanel: true,
        },
      },
    })

    await wrapper.findAll('button')[1]?.trigger('click')

    expect(previewProps[previewProps.length - 1]).toEqual({
      taskId: 'task-1',
      projectId: 'project-1',
      refreshToken: 3,
    })
  })
})
