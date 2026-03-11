import { http } from '@/utils/http'
import { STORAGE_KEYS } from '@/types/common/storage'

const API_PREFIX = '/api/v1'

export type InfinityPaginationResponse<T> = {
  data: T[]
  hasNextPage: boolean
}

type QueryValue = string | number | boolean | null | undefined

const getApiBase = () => {
  const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (!configuredBase) {
    return window.location.origin
  }

  return configuredBase
}

export const buildUrl = (path: string, query?: Record<string, QueryValue>) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${API_PREFIX}${normalizedPath}`, getApiBase())

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue
      }

      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

export const apiHttp = {
  get<T>(path: string, query?: Record<string, QueryValue>) {
    return http.get<T>(buildUrl(path, query))
  },

  post<T>(path: string, body?: unknown) {
    return http.post<T>(buildUrl(path), body)
  },

  put<T>(path: string, body?: unknown) {
    return http.request<T>(buildUrl(path), {
      method: 'PUT',
      body,
    })
  },

  patch<T>(path: string, body?: unknown) {
    return http.request<T>(buildUrl(path), {
      method: 'PATCH',
      body,
    })
  },

  delete<T>(path: string) {
    return http.request<T>(buildUrl(path), {
      method: 'DELETE',
    })
  },
}

export type SseEvent = {
  id?: string
  event?: string
  data: string
}

export type SseCallbacks = {
  onEvent: (event: SseEvent) => void
  onError?: (error: Error) => void
  signal?: AbortSignal
}

export const openSseStream = async (
  path: string,
  query: Record<string, QueryValue> | undefined,
  callbacks: SseCallbacks,
) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken)

  const response = await fetch(buildUrl(path, query), {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: callbacks.signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const flushChunk = (chunk: string) => {
    const lines = chunk.split('\n')
    let eventId: string | undefined
    let eventType: string | undefined
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('id:')) {
        eventId = line.slice(3).trim()
      } else if (line.startsWith('event:')) {
        eventType = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }

    if (dataLines.length > 0) {
      callbacks.onEvent({
        id: eventId,
        event: eventType,
        data: dataLines.join('\n'),
      })
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let boundaryIndex = buffer.indexOf('\n\n')
      while (boundaryIndex !== -1) {
        const chunk = buffer.slice(0, boundaryIndex).trim()
        if (chunk) {
          flushChunk(chunk)
        }
        buffer = buffer.slice(boundaryIndex + 2)
        boundaryIndex = buffer.indexOf('\n\n')
      }
    }

    const remainChunk = buffer.trim()
    if (remainChunk) {
      flushChunk(remainChunk)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return
    }

    callbacks.onError?.(error instanceof Error ? error : new Error('Unknown SSE error'))
  } finally {
    reader.releaseLock()
  }
}
