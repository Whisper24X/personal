import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authGuard } from '@/router/guards/auth-guard'

const { loadMeMock, setTokenMock, setProfileMock, businessLinesListMock, storeState } = vi.hoisted(() => ({
  loadMeMock: vi.fn(),
  setTokenMock: vi.fn(),
  setProfileMock: vi.fn(),
  businessLinesListMock: vi.fn(),
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

vi.mock('@/api/business-lines', () => ({
  businessLinesApi: {
    list: businessLinesListMock,
  },
}))

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.token = 'token'
    storeState.profile = { id: 'user-1' }
    storeState.isLogin = true
    businessLinesListMock.mockResolvedValue({
      data: [
        {
          id: 'line-1',
          name: 'Line 1',
          description: '',
        },
      ],
      hasNextPage: false,
    })
  })

  it('redirects logged-in users away from login to home when no business line is available', async () => {
    businessLinesListMock.mockResolvedValue({
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

  it('merges top-level projectId into redirect when URL used a second ? (malformed)', async () => {
    const result = await authGuard.call(undefined, {
      path: '/login',
      fullPath:
        '/login?redirect=/task-detail/uuid-1?projectId=proj-1',
      query: {
        redirect: '/task-detail/uuid-1',
        projectId: 'proj-1',
      },
      meta: { requiresAuth: false },
    } as never, {} as never, undefined as never)

    expect(result).toBe('/task-detail/uuid-1?projectId=proj-1')
  })
})
