import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import TaskRightPanel from '../TaskRightPanel.vue'

describe('TaskRightPanel', () => {
  it('renders artifact tab first and selects it by default', () => {
    const wrapper = mount(TaskRightPanel, {
      props: {
        taskId: 'task-1',
        previewEnabled: true,
        terminalEnabled: true,
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
        previewEnabled: true,
        terminalEnabled: true,
        preview: {
          status: 'ready',
          url: 'https://preview.example.com/p/task-1/',
        },
        refreshToken: 3,
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskArtifactsPanel: true,
          TaskPreviewPanel: defineComponent({
            name: 'TaskDetailPreviewPanelStub',
            props: {
              preview: { type: Object, default: null },
              logs: { type: Array, default: () => [] },
              formatDate: { type: Function, required: true },
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
      preview: {
        status: 'ready',
        url: 'https://preview.example.com/p/task-1/',
      },
      logs: [],
      formatDate: expect.any(Function),
    })
  })

  it('passes artifact node context through to the artifacts panel', () => {
    const artifactProps: Array<Record<string, unknown>> = []

    mount(TaskRightPanel, {
      props: {
        taskId: 'task-1',
        artifactNodeId: 'node-2',
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskArtifactsPanel: defineComponent({
            name: 'TaskDetailArtifactsPanelStub',
            props: {
              taskId: { type: String, required: true },
              artifactNodeId: { type: String, default: null },
            },
            setup(props) {
              artifactProps.push({ ...props })
              return () => null
            },
          }),
          TaskPreviewPanel: true,
          TaskFilesPanel: true,
          TaskGitPanel: true,
          TaskTerminalPanel: true,
          TaskLogsPanel: true,
          TaskDeployPanel: true,
        },
      },
    })

    expect(artifactProps[artifactProps.length - 1]).toEqual({
      taskId: 'task-1',
      artifactNodeId: 'node-2',
    })
  })

  it('hides preview tab when runtime environment is not ready', () => {
    const wrapper = mount(TaskRightPanel, {
      props: {
        taskId: 'task-1',
        previewEnabled: false,
        terminalEnabled: true,
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskArtifactsPanel: true,
          TaskPreviewPanel: true,
          TaskFilesPanel: true,
          TaskGitPanel: true,
          TaskTerminalPanel: true,
          TaskLogsPanel: true,
          TaskDeployPanel: true,
        },
      },
    })

    const tabs = wrapper.findAll('button').map((node) => node.text().trim())

    expect(tabs).not.toContain('预览')
  })

  it('hides terminal tab when runtime environment is not ready', () => {
    const wrapper = mount(TaskRightPanel, {
      props: {
        taskId: 'task-1',
        terminalEnabled: false,
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskArtifactsPanel: true,
          TaskPreviewPanel: true,
          TaskFilesPanel: true,
          TaskGitPanel: true,
          TaskTerminalPanel: true,
          TaskLogsPanel: true,
          TaskDeployPanel: true,
        },
      },
    })

    const tabs = wrapper.findAll('button').map((node) => node.text().trim())

    expect(tabs).not.toContain('终端')
  })

  it('falls back to artifact tab when terminal becomes unavailable', async () => {
    const wrapper = mount(TaskRightPanel, {
      props: {
        taskId: 'task-1',
        terminalEnabled: true,
        formatDate: () => '',
      },
      global: {
        stubs: {
          TaskArtifactsPanel: {
            template: '<div data-test="artifacts-panel">artifacts</div>',
          },
          TaskPreviewPanel: true,
          TaskFilesPanel: true,
          TaskGitPanel: true,
          TaskTerminalPanel: {
            template: '<div data-test="terminal-panel">terminal</div>',
          },
          TaskLogsPanel: true,
          TaskDeployPanel: true,
        },
      },
    })

    const terminalTab = wrapper.findAll('button').find((node) => node.text().trim() === '终端')
    expect(terminalTab).toBeDefined()

    await terminalTab!.trigger('click')
    expect(wrapper.find('[data-test="terminal-panel"]').exists()).toBe(true)

    await wrapper.setProps({ terminalEnabled: false })

    expect(wrapper.find('[data-test="terminal-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="artifacts-panel"]').exists()).toBe(true)
  })
})
