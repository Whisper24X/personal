import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskPreviewPanel from '@/components/tasks/detail/TaskPreviewPanel.vue'

const { projectsApi } = vi.hoisted(() => ({
  projectsApi: {
    detail: vi.fn(),
  },
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

describe('TaskPreviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    projectsApi.detail.mockResolvedValue({
      id: 'project-1',
      configJson: {
        keep: 'value',
        preview: {
          runtimeUrl: 'runtime.local:38080',
        },
      },
    })
  })

  it('renders runtime preview url from project settings', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(projectsApi.detail).toHaveBeenCalledWith('project-1')
    expect(wrapper.text()).toContain('http://runtime.local:38080')
    expect(wrapper.find('iframe').attributes('src')).toBe('http://runtime.local:38080')
  })

  it('waits for runtime preview even when legacy manual preview url exists', async () => {
    projectsApi.detail.mockResolvedValueOnce({
      id: 'project-1',
      configJson: {
        preview: {
          url: 'manual.local:3000',
        },
      },
    })

    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
      },
    })

    await flushPromises()

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).toContain('容器预览尚未就绪')
    expect(wrapper.text()).not.toContain('manual.local:3000')
  })

  it('shows task logs without exposing manual config or restart controls', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
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

    await flushPromises()
    await wrapper.find('button[title="查看运行日志"]').trigger('click')

    expect(wrapper.find('button[title="配置启动命令和预览地址"]').exists()).toBe(false)
    expect(wrapper.find('button[title="重启服务"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('runner booted')
    expect(wrapper.text()).toContain('2026/03/16 08:00:00')
  })

  it('reloads runtime preview config when refreshToken changes', async () => {
    const wrapper = mount(TaskPreviewPanel, {
      props: {
        taskId: 'task-1',
        projectId: 'project-1',
        refreshToken: 0,
      },
    })

    await flushPromises()
    expect(projectsApi.detail).toHaveBeenCalledTimes(1)

    projectsApi.detail.mockResolvedValueOnce({
      id: 'project-1',
      configJson: {
        preview: {
          runtimeUrl: 'runtime.local:48080',
        },
      },
    })

    await wrapper.setProps({
      refreshToken: 1,
    })
    await flushPromises()

    expect(projectsApi.detail).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('http://runtime.local:48080')
  })
})
