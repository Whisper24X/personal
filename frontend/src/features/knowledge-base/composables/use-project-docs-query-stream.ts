import { onBeforeUnmount, ref, shallowRef } from 'vue'
import type { ProjectDocCitation, QueryProjectDocsPayload } from '@/types/api/project-docs'
import { projectsApi } from '@/api/projects'
import { toErrorMessage } from '@api/shared/to-error-message'
import {
  PROJECT_DOCS_QUERY_STREAM_CHARS_PER_TICK,
  PROJECT_DOCS_QUERY_STREAM_TICK_MS,
} from '@shared/constants/project-docs-query-stream'

export type ProjectDocsQueryStreamMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: ProjectDocCitation[]
  isStreaming?: boolean
}

export type RunProjectDocsQueryStreamParams = {
  projectId: string
  payload: QueryProjectDocsPayload
  method: 'get' | 'post'
  assistantMessage: ProjectDocsQueryStreamMessage
  /** Shown in toErrorMessage fallback */
  errorLabel: string
}

export function useProjectDocsQueryStream() {
  const queryLoading = ref(false)
  const queryError = ref('')
  const queryAbortController = ref<AbortController | null>(null)
  const streamTextBuffer = ref('')
  const activeAssistantMessage = shallowRef<ProjectDocsQueryStreamMessage | null>(null)
  let streamRenderTimer: ReturnType<typeof setInterval> | null = null

  const stopStreamRenderer = () => {
    if (streamRenderTimer) {
      clearInterval(streamRenderTimer)
      streamRenderTimer = null
    }
  }

  const flushStreamBuffer = () => {
    if (activeAssistantMessage.value && streamTextBuffer.value) {
      activeAssistantMessage.value.content += streamTextBuffer.value
    }
    streamTextBuffer.value = ''
  }

  const ensureStreamRenderer = () => {
    if (streamRenderTimer) return
    streamRenderTimer = setInterval(() => {
      if (!activeAssistantMessage.value || !streamTextBuffer.value) {
        return
      }

      const nextDelta = streamTextBuffer.value.slice(
        0,
        PROJECT_DOCS_QUERY_STREAM_CHARS_PER_TICK,
      )
      streamTextBuffer.value = streamTextBuffer.value.slice(
        PROJECT_DOCS_QUERY_STREAM_CHARS_PER_TICK,
      )
      activeAssistantMessage.value.content += nextDelta
    }, PROJECT_DOCS_QUERY_STREAM_TICK_MS)
  }

  const runDocsQueryStream = async (params: RunProjectDocsQueryStreamParams) => {
    queryAbortController.value?.abort()
    queryAbortController.value = new AbortController()
    queryLoading.value = true
    queryError.value = ''

    const assistantMessage = params.assistantMessage
    activeAssistantMessage.value = assistantMessage
    streamTextBuffer.value = ''
    ensureStreamRenderer()

    try {
      await projectsApi.queryDocsStream(
        params.projectId,
        params.payload,
        {
          signal: queryAbortController.value.signal,
          onEvent: (event) => {
            if (event.event === 'chunk') {
              try {
                const payload = JSON.parse(event.data) as { delta?: string }
                if (payload.delta) {
                  streamTextBuffer.value += payload.delta
                }
              } catch {
                /* ignore invalid chunk payload */
              }
              return
            }

            if (event.event === 'citations') {
              try {
                const payload = JSON.parse(event.data) as { citations?: ProjectDocCitation[] }
                assistantMessage.citations = payload.citations ?? []
              } catch {
                assistantMessage.citations = []
              }
              return
            }

            if (event.event === 'error') {
              try {
                const payload = JSON.parse(event.data) as { message?: string }
                queryError.value = payload.message || params.errorLabel
              } catch {
                queryError.value = params.errorLabel
              }
              assistantMessage.isStreaming = false
              flushStreamBuffer()
              return
            }

            if (event.event === 'done') {
              flushStreamBuffer()
              assistantMessage.isStreaming = false
              queryLoading.value = false
            }
          },
          onError: (error) => {
            flushStreamBuffer()
            assistantMessage.isStreaming = false
            queryLoading.value = false
            queryError.value = toErrorMessage(error, params.errorLabel)
          },
        },
        params.method,
      )
    } catch (error) {
      flushStreamBuffer()
      assistantMessage.isStreaming = false
      queryLoading.value = false
      queryError.value = toErrorMessage(error, params.errorLabel)
      if (!assistantMessage.content.trim()) {
        assistantMessage.content = '本次请求失败，请稍后重试。'
      }
    } finally {
      flushStreamBuffer()
      assistantMessage.isStreaming = false
      queryLoading.value = false
      queryAbortController.value = null
      activeAssistantMessage.value = null
      stopStreamRenderer()
    }
  }

  const abortDocsQueryStream = () => {
    queryAbortController.value?.abort()
  }

  onBeforeUnmount(() => {
    queryAbortController.value?.abort()
    stopStreamRenderer()
  })

  return {
    queryLoading,
    queryError,
    runDocsQueryStream,
    abortDocsQueryStream,
  }
}
