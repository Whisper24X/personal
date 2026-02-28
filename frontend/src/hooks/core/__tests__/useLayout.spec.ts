import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLayout } from '@/hooks/core/useLayout'
import { STORAGE_KEYS } from '@/types/common/storage'

const { businessLinesApi, projectsApi, routeState, routerReplace } = vi.hoisted(() => ({
  businessLinesApi: {
    list: vi.fn(),
  },
  projectsApi: {
    list: vi.fn(),
  },
  routeState: {
    name: 'dashboard',
    path: '/dashboard',
    fullPath: '/dashboard',
    params: {},
    query: {},
    meta: {},
  },
  routerReplace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    replace: routerReplace,
  }),
}))

vi.mock('@/api/business-lines', () => ({
  businessLinesApi,
}))

vi.mock('@/api/projects', () => ({
  projectsApi,
}))

describe('useLayout business line selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const storage = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem(key: string) {
          return storage.get(key) ?? null
        },
        setItem(key: string, value: string) {
          storage.set(key, String(value))
        },
        removeItem(key: string) {
          storage.delete(key)
        },
        clear() {
          storage.clear()
        },
      },
    })

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })

    businessLinesApi.list.mockResolvedValue({
      data: [
        { id: 'line-1', name: 'Line 1', description: '', owner: '-' },
        { id: 'line-2', name: 'Line 2', description: '', owner: '-' },
      ],
      hasNextPage: false,
    })

    projectsApi.list.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          name: 'Project 1',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p1.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'project-2',
          name: 'Project 2',
          businessLineId: 'line-2',
          description: '',
          gitUrl: 'https://git.example.com/p2.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      hasNextPage: false,
    })

    localStorage.setItem(STORAGE_KEYS.lastSelectedProjectId, 'project-1')
  })

  it('keeps manually selected business line instead of restoring line from previous selected project', async () => {
    setActivePinia(createPinia())

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="active-line">{{ activeBusinessLineId }}</p>
          <p data-testid="active-project">{{ projectItems[0]?.id ?? '' }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    expect(wrapper.get('[data-testid="active-line"]').text()).toBe('line-1')
    expect(wrapper.get('[data-testid="active-project"]').text()).toBe('project-1')

    ;(wrapper.vm as { selectBusinessLine: (businessLineId: string) => void }).selectBusinessLine('line-2')
    await nextTick()

    expect(wrapper.get('[data-testid="active-line"]').text()).toBe('line-2')
    expect(wrapper.get('[data-testid="active-project"]').text()).toBe('project-2')
    expect(localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId)).toBe('project-2')
  })

  it('uses unique project short labels when names share the same prefix', async () => {
    setActivePinia(createPinia())

    projectsApi.list.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          name: 'test1',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p1.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'project-2',
          name: 'test2',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p2.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'project-3',
          name: 'test3',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p3.git',
          defaultBranch: 'main',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      hasNextPage: false,
    })

    const Harness = defineComponent({
      setup() {
        return useLayout()
      },
      template: `
        <div>
          <p data-testid="project-shorts">{{ projectItems.map((item) => item.short).join(',') }}</p>
        </div>
      `,
    })

    const wrapper = mount(Harness)
    await flushPromises()

    expect(wrapper.get('[data-testid="project-shorts"]').text()).toBe('TES1,TES2,TES3')
  })
})
