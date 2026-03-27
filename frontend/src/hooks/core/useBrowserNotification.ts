import { onMounted, onUnmounted } from 'vue'
import { buildUrl } from '@/api/http'
import { STORAGE_KEYS } from '@/types/common/storage'
import NotificationWorker from '@/workers/notification-sse.worker?worker'

export function useBrowserNotification() {
  let worker: Worker | null = null

  const requestPermission = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  const startWorker = () => {
    worker = new NotificationWorker()

    worker.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && e.data.taskId) {
        window.focus()
        window.location.href = `/task-detail/${e.data.taskId}`
      }
    }

    worker.postMessage({
      type: 'start',
      sseUrl: buildUrl('/notifications/events/stream'),
      authToken: localStorage.getItem(STORAGE_KEYS.authToken) ?? '',
    })
  }

  onMounted(async () => {
    await requestPermission()
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
