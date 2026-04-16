import { onMounted, onUnmounted } from 'vue'
import { buildUrl } from '@api/http'
import { useMessage } from '@app/composables/useMessage'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { emitProjectRepositoryProvisioningChangedEvent } from '@shared/utils/project-repository-provisioning-event'
import {
  AUTH_SESSION_EVENT,
  type AuthSessionDetail,
} from '@shared/utils/auth-session-bridge'
import NotificationWorker from '@shared/workers/notification-sse.worker?worker'

let sharedWorker: Worker | null = null
let sharedMountCount = 0
let authSessionListenerBound = false
let activeWarningHandler: ((code: unknown, text: string) => void) | null = null
let activeProvisioningToastHandler:
  | ((payload: {
      status: 'ready' | 'failed'
      dedupeKey: string
      text: string
    }) => void)
  | null = null

const handleWorkerMessage = (e: MessageEvent) => {
  if (e.data?.type === 'navigate' && e.data.taskId) {
    window.focus()
    window.location.href = `/task-detail/${e.data.taskId}`
    return
  }

  if (e.data?.type === 'notification_error' && typeof e.data.message === 'string') {
    activeWarningHandler?.(e.data.code, e.data.message)
    return
  }

  if (
    e.data?.type === 'project_repository_provisioning_changed' &&
    typeof e.data.projectId === 'string' &&
    typeof e.data.businessLineId === 'string' &&
    (e.data.status === 'ready' || e.data.status === 'failed')
  ) {
    const dedupeKey = `project-provisioning-toast:${
      typeof e.data.eventId === 'string' && e.data.eventId.trim()
        ? e.data.eventId.trim()
        : `${e.data.projectId}:${e.data.status}`
    }`
    const toastText =
      typeof e.data.content === 'string' && e.data.content.trim()
        ? e.data.content.trim()
        : e.data.status === 'ready'
          ? '项目仓库已就绪'
          : `项目仓库准备失败${typeof e.data.errorMessage === 'string' && e.data.errorMessage.trim() ? `：${e.data.errorMessage.trim()}` : ''}`
    activeProvisioningToastHandler?.({
      status: e.data.status,
      dedupeKey,
      text: toastText,
    })
    emitProjectRepositoryProvisioningChangedEvent({
      projectId: e.data.projectId,
      businessLineId: e.data.businessLineId,
      status: e.data.status,
      errorMessage:
        typeof e.data.errorMessage === 'string' ? e.data.errorMessage : null,
    })
  }
}

const ensureWorker = () => {
  const authToken = localStorage.getItem(STORAGE_KEYS.authToken) ?? ''
  if (sharedWorker) {
    return
  }
  sharedWorker = new NotificationWorker()
  sharedWorker.onmessage = handleWorkerMessage
  sharedWorker.postMessage({
    type: 'start',
    sseUrl: buildUrl('/notifications/events/stream'),
    authToken,
  })
}

const handleAuthSessionChanged = (ev: Event) => {
  const detail = (ev as CustomEvent<AuthSessionDetail>).detail
  if (!sharedWorker || !detail) {
    return
  }

  if (detail.kind === 'token') {
    sharedWorker.postMessage({ type: 'update_auth', authToken: detail.token })
    return
  }

  if (detail.kind === 'clear') {
    sharedWorker.postMessage({ type: 'stop' })
  }
}

const ensureAuthSessionListener = () => {
  if (authSessionListenerBound) {
    return
  }
  window.addEventListener(AUTH_SESSION_EVENT, handleAuthSessionChanged as EventListener)
  authSessionListenerBound = true
}

const releaseAuthSessionListener = () => {
  if (!authSessionListenerBound) {
    return
  }
  window.removeEventListener(AUTH_SESSION_EVENT, handleAuthSessionChanged as EventListener)
  authSessionListenerBound = false
}

export function useBrowserNotification() {
  const message = useMessage()
  const warningHandler = (code: unknown, text: string) => {
    message.warning(text, {
      dedupeKey: `browser-notification:${String(code ?? text)}`,
    })
  }
  const provisioningToastHandler = (payload: {
    status: 'ready' | 'failed'
    dedupeKey: string
    text: string
  }) => {
    if (payload.status === 'ready') {
      const toastId = message.success(payload.text, {
        dedupeKey: payload.dedupeKey,
        duration: 8000,
      })
      void toastId
      return
    }
    const toastId = message.error(payload.text, {
      dedupeKey: payload.dedupeKey,
      duration: 10000,
    })
    void toastId
  }

  onMounted(() => {
    sharedMountCount += 1
    activeWarningHandler = warningHandler
    activeProvisioningToastHandler = provisioningToastHandler
    ensureAuthSessionListener()
    ensureWorker()
  })

  onUnmounted(() => {
    sharedMountCount = Math.max(0, sharedMountCount - 1)

    if (sharedMountCount === 0) {
      activeWarningHandler = null
      activeProvisioningToastHandler = null
      releaseAuthSessionListener()
      if (sharedWorker) {
        sharedWorker.postMessage({ type: 'stop' })
        sharedWorker.terminate()
        sharedWorker = null
      }
    }
  })
}
