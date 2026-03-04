import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import TaskDetailView from '@/views/tasks/detail.vue'
import { useMessageStore } from '@/stores/modules/message'

const { tasksApi, artifactsApi, openSseStream } = vi.hoisted(() => ({
  tasksApi: {
    detailWithNodes: vi.fn(),
    logs: vi.fn(),
    messages: vi.fn(),
    artifacts: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    execute: vi.fn(),
    reply: vi.fn(),
    cancel: vi.fn(),
    cleanupWorktree: vi.fn(),
    retry: vi.fn(),
    approve: vi.fn(),
    createArtifact: vi.fn(),
  },
  artifactsApi: {
    download: vi.fn(),
    preview: vi.fn(),
  },
  openSseStream: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    template: '<a><slot /></a>',
  },
  useRoute: () => ({
    params: {
      id: 'task-1',
    },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/api/tasks', () => ({
  tasksApi,
}))

vi.mock('@/api/artifacts', () => ({
  artifactsApi,
}))

vi.mock('@/api/http', () => ({
  openSseStream,
}))

beforeEach(() => {
  vi.clearAllMocks()

  tasksApi.detailWithNodes.mockResolvedValue({
    task: {
      id: 'task-1',
      projectId: 'project-1',
      mode: 'conversation',
      title: 'Demo task',
      status: 'todo',
      createdAt: '2026-02-27T10:00:00.000Z',
      updatedAt: '2026-02-27T10:00:00.000Z',
    },
    nodes: [],
  })

  tasksApi.logs.mockResolvedValue([])
  tasksApi.messages.mockResolvedValue([])
  tasksApi.artifacts.mockResolvedValue([])
  tasksApi.execute.mockRejectedValue(new Error('执行异常'))
  openSseStream.mockResolvedValue(undefined)
})

describe('TaskDetailView toasts', () => {
  it('shows error toast when execute API fails', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(TaskDetailView, {
      global: {
        plugins: [pinia],
        stubs: {
          RightPanelSection: {
            template: '<div />',
          },
          TaskDialogs: {
            template: '<div />',
          },
        },
      },
    })

    await flushPromises()

    const executeButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === '执行')

    expect(executeButton).toBeDefined()
    await executeButton!.trigger('click')
    await flushPromises()

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('error')
    expect(messageStore.items[0]?.text).toBe('执行异常')
    expect(wrapper.text()).not.toContain('执行异常')
  })
})
