import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskPreviewPanel from '@features/tasks/detail/TaskPreviewPanel.vue'

describe('TaskPreviewPanel', () => {
  it('renders the runtime preview url from task environment', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: {
          status: 'ready',
          url: 'https://preview.example.com/p/task-1/',
        },
      },
    })

    expect(wrapper.text()).toContain('https://preview.example.com/p/task-1/')
    expect(wrapper.find('iframe').attributes('src')).toBe('https://preview.example.com/p/task-1/')
  })

  it('shows provisioning state when preview url is still being assigned', () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: {
          status: 'provisioning',
          url: null,
        },
      },
    })

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).toContain('容器预览生成中')
    expect(wrapper.text()).toContain('系统正在为当前任务分配预览地址')
  })

  it('shows task logs without exposing manual config or restart controls', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        preview: {
          status: 'ready',
          url: 'https://preview.example.com/p/task-1/',
        },
        logs: [
          {
            id: 'log-1',
            taskId: 'task-1',
            level: 'info',
            message: 'runner booted',
            createdAt: '2026-03-16T00:00:00.000Z',
          },
        ],
        formatDate: () => '2026/03/16 08:00:00',
      },
    })

    await wrapper.find('button[title="查看运行日志"]').trigger('click')

    expect(wrapper.find('button[title="配置启动命令和预览地址"]').exists()).toBe(false)
    expect(wrapper.find('button[title="重启服务"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('runner booted')
    expect(wrapper.text()).toContain('2026/03/16 08:00:00')
  })
})
