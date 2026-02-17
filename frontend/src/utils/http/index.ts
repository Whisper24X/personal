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

const buildHeaders = (headers?: Record<string, string>) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken)

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

const unwrapResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    if (response.status === HTTP_STATUS.unauthorized) {
      clearAuthState()
    }

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
    const headers = buildHeaders(config.headers)
    const body = config.body === undefined ? undefined : JSON.stringify(config.body)

    const response = await fetch(url, {
      method,
      headers,
      body,
    })

    return unwrapResponse<T>(response)
  },

  get<T>(url: string, headers?: Record<string, string>) {
    return this.request<T>(url, { method: 'GET', headers })
  },

  post<T>(url: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(url, { method: 'POST', body, headers })
  },
}
