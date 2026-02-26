import { HTTP_STATUS } from './status'
import { HttpError } from './error'
import { STORAGE_KEYS } from '@/types/common/storage'
import { useUserStore } from '@/stores/modules/user'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestConfig = {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: unknown
}

type RefreshTokenResponse = {
  token: string
  refreshToken: string
}

let refreshingTokenPromise: Promise<string | null> | null = null

const buildHeaders = (headers?: Record<string, string>, tokenOverride?: string | null) => {
  const token = tokenOverride ?? localStorage.getItem(STORAGE_KEYS.authToken)

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
}

const isJsonResponse = (response: Response) => {
  const contentType = response.headers.get('content-type')
  return contentType?.includes('application/json') ?? false
}

const clearAuthState = () => {
  const userStore = useUserStore()
  userStore.setToken(null)
  userStore.setProfile(null)
  localStorage.removeItem(STORAGE_KEYS.authToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
}

const refreshAccessToken = async (requestUrl: string): Promise<string | null> => {
  const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  if (!storedRefreshToken) {
    return null
  }

  if (!refreshingTokenPromise) {
    refreshingTokenPromise = (async () => {
      const refreshUrl = new URL('/api/v1/auth/refresh', requestUrl).toString()
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${storedRefreshToken}`,
        },
      })

      if (!response.ok || !isJsonResponse(response)) {
        return null
      }

      const payload = (await response.json()) as RefreshTokenResponse
      if (!payload.token || !payload.refreshToken) {
        return null
      }

      localStorage.setItem(STORAGE_KEYS.authToken, payload.token)
      localStorage.setItem(STORAGE_KEYS.refreshToken, payload.refreshToken)

      const userStore = useUserStore()
      userStore.setToken(payload.token)

      return payload.token
    })().finally(() => {
      refreshingTokenPromise = null
    })
  }

  return refreshingTokenPromise
}

const unwrapResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = `Request failed: ${response.status}`
    if (isJsonResponse(response)) {
      const body = (await response.json()) as { message?: string }
      message = body.message ?? message
    }

    throw new HttpError(message, response.status)
  }

  if (!isJsonResponse(response)) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const http = {
  async request<T>(url: string, config: RequestConfig = {}) {
    const method = config.method ?? 'GET'
    const body = config.body === undefined ? undefined : JSON.stringify(config.body)

    const sendRequest = (tokenOverride?: string | null) => {
      const headers = buildHeaders(config.headers, tokenOverride)
      return fetch(url, {
        method,
        headers,
        body,
      })
    }

    let response = await sendRequest()

    const shouldTryRefresh =
      response.status === HTTP_STATUS.unauthorized &&
      !url.includes('/auth/refresh') &&
      !url.includes('/auth/login')

    if (shouldTryRefresh) {
      const refreshedToken = await refreshAccessToken(url)
      if (refreshedToken) {
        response = await sendRequest(refreshedToken)
      } else {
        clearAuthState()
      }
    }

    if (response.status === HTTP_STATUS.unauthorized) {
      clearAuthState()
    }

    return unwrapResponse<T>(response)
  },

  get<T>(url: string, headers?: Record<string, string>) {
    return this.request<T>(url, { method: 'GET', headers })
  },

  post<T>(url: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(url, { method: 'POST', body, headers })
  },
}
