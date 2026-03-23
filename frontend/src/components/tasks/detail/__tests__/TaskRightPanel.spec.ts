import { mount } from '@vue/test-utils'
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

    expect(tabs).toEqual(['产物', '预览', '文件', 'Git', '终端', '日志'])
    expect(wrapper.find('[data-test="artifacts-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="preview-panel"]').exists()).toBe(false)
  })
})
