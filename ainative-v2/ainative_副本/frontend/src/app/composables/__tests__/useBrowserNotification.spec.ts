import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBrowserNotification } from '../useBrowserNotification'
import { useMessageStore } from '@app/stores/modules/message'
import { STORAGE_KEYS } from '@shared/types/common/storage'

const { MockNotificationWorker, workerInstances, requestPermissionMock } = vi.hoisted(() => {
  const workerInstances: Array<{
    onmessage: ((event: MessageEvent) => void) | null
    postMessage: ReturnType<typeof vi.fn>
    terminate: ReturnType<typeof vi.fn>
  }> = []

  class MockNotificationWorker {
    onmessage: ((event: MessageEvent) => void) | null = null
    postMessage = vi.fn()
    terminate = vi.fn()

    constructor() {
      workerInstances.push(this)
    }
  }

  return {
    MockNotificationWorker,
    workerInstances,
    requestPermissionMock: vi.fn(),
  }
})

vi.mock('@shared/workers/notification-sse.worker?worker', () => ({
  default: MockNotificationWorker,
}))

describe('useBrowserNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workerInstances.length = 0

    localStorage.setItem(STORAGE_KEYS.authToken, 'token-1')

    class MockNotification {
      static permission: NotificationPermission = 'default'
      static requestPermission = requestPermissionMock
    }

    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: MockNotification,
    })
  })

  it('starts the worker without requesting notification permission on mount', () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const Harness = defineComponent({
      setup() {
        useBrowserNotification()
        return () => 'browser-notification'
      },
    })

    const wrapper = mount(Harness, {
      global: {
        plugins: [pinia],
      },
    })

    expect(workerInstances).toHaveLength(1)
    expect(requestPermissionMock).not.toHaveBeenCalled()
    expect(workerInstances[0]!.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'start',
        authToken: 'token-1',
      }),
    )

    const startPayload = workerInstances[0]!.postMessage.mock.calls[0]?.[0]
    expect(startPayload?.sseUrl).toContain('/api/v1/notifications/events/stream')

    wrapper.unmount()

    expect(workerInstances[0]!.postMessage).toHaveBeenCalledWith({
      type: 'stop',
    })
    expect(workerInstances[0]!.terminate).toHaveBeenCalledTimes(1)
  })

  it('shows a warning toast when the worker reports notification errors', () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const Harness = defineComponent({
      setup() {
        useBrowserNotification()
        return () => 'browser-notification'
      },
    })

    mount(Harness, {
      global: {
        plugins: [pinia],
      },
    })

    workerInstances[0]!.onmessage?.({
      data: {
        type: 'notification_error',
        code: 'permission_denied',
        message: '浏览器通知权限已被拒绝',
      },
    } as MessageEvent)

    const messageStore = useMessageStore()
    expect(messageStore.items[0]?.type).toBe('warning')
    expect(messageStore.items[0]?.text).toBe('浏览器通知权限已被拒绝')
  })
})
