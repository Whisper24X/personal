import { onMounted, onUnmounted } from 'vue'
import { buildUrl } from '@api/http'
import { useMessage } from '@app/composables/useMessage'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import NotificationWorker from '@shared/workers/notification-sse.worker?worker'

export function useBrowserNotification() {
  const message = useMessage()
  let worker: Worker | null = null

  const startWorker = () => {
    worker = new NotificationWorker()

    worker.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && e.data.taskId) {
        window.focus()
        window.location.href = `/task-detail/${e.data.taskId}`
        return
      }

      if (e.data?.type === 'notification_error' && typeof e.data.message === 'string') {
        message.warning(e.data.message, {
          dedupeKey: `browser-notification:${String(e.data.code ?? e.data.message)}`,
        })
      }
    }

    worker.postMessage({
      type: 'start',
      sseUrl: buildUrl('/notifications/events/stream'),
      authToken: localStorage.getItem(STORAGE_KEYS.authToken) ?? '',
    })
  }

  onMounted(() => {
    startWorker()
  })

  onUnmounted(() => {
    if (worker) {
      worker.postMessage({ type: 'stop' })
      worker.terminate()
      worker = null
    }
  })
}
