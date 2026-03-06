import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authGuard } from '@/router/guards/auth-guard'

const { loadMeMock, setTokenMock, setProfileMock, projectsListMock, storeState } = vi.hoisted(() => ({
  loadMeMock: vi.fn(),
  setTokenMock: vi.fn(),
  setProfileMock: vi.fn(),
  projectsListMock: vi.fn(),
  storeState: {
    token: 'token',
    profile: { id: 'user-1' },
    isLogin: true,
  },
}))

vi.mock('@/stores/modules/user', () => ({
  useUserStore: () => ({
    token: storeState.token,
    profile: storeState.profile,
    isLogin: storeState.isLogin,
    loadMe: loadMeMock,
    setToken: setTokenMock,
    setProfile: setProfileMock,
  }),
}))

vi.mock('@/api/projects', () => ({
  projectsApi: {
    list: projectsListMock,
  },
}))

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.token = 'token'
    storeState.profile = { id: 'user-1' }
    storeState.isLogin = true
    projectsListMock.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          name: 'Project 1',
          businessLineId: 'line-1',
          description: '',
          gitUrl: 'https://git.example.com/p1.git',
          defaultBranch: 'main',
        },
      ],
      hasNextPage: false,
    })
  })

  it('redirects logged-in users away from login to home when no project is available', async () => {
    projectsListMock.mockResolvedValue({
      data: [],
      hasNextPage: false,
    })

    const result = await authGuard.call(undefined, {
      path: '/login',
      fullPath: '/login',
      query: {},
      meta: { requiresAuth: false },
    } as never, {} as never, undefined as never)

    expect(result).toBe('/home')
  })

  it('keeps redirect target for logged-in users when project exists', async () => {
    const result = await authGuard.call(undefined, {
      path: '/login',
      fullPath: '/login?redirect=/tasks',
      query: { redirect: '/tasks' },
      meta: { requiresAuth: false },
    } as never, {} as never, undefined as never)

    expect(result).toBe('/tasks')
  })
})
