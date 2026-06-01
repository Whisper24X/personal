import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { MessageItem, MessageOptions, MessagePushPayload, MessageType } from '@shared/types/component/message'

const DEFAULT_MESSAGE_DURATION: Record<MessageType, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
}

const DEDUPE_WINDOW_MS = 2000

const nextMessageId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export const useMessageStore = defineStore('message', () => {
  const items = ref<MessageItem[]>([])
  const timerMap = new Map<string, ReturnType<typeof setTimeout>>()
  const dedupeMap = new Map<string, number>()

  const remove = (id: string) => {
    const timer = timerMap.get(id)
    if (timer) {
      clearTimeout(timer)
      timerMap.delete(id)
    }

    items.value = items.value.filter((item) => item.id !== id)
  }

  const clear = () => {
    for (const timer of timerMap.values()) {
      clearTimeout(timer)
    }

    timerMap.clear()
    items.value = []
  }

  const push = (payload: MessagePushPayload) => {
    const text = payload.text.trim()
    if (!text) {
      return ''
    }

    const dedupeKey = payload.dedupeKey?.trim() || `${payload.type}:${text}`
    const now = Date.now()
    const lastAt = dedupeMap.get(dedupeKey)

    if (lastAt && now - lastAt < DEDUPE_WINDOW_MS) {
      return ''
    }

    dedupeMap.set(dedupeKey, now)

    const id = nextMessageId()
    const duration = payload.duration ?? DEFAULT_MESSAGE_DURATION[payload.type]

    items.value.unshift({
      id,
      type: payload.type,
      text,
      duration,
      createdAt: now,
      dedupeKey,
    })

    if (duration > 0) {
      const timer = setTimeout(() => {
        remove(id)
      }, duration)

      timerMap.set(id, timer)
    }

    return id
  }

  const success = (text: string, options?: MessageOptions) => {
    return push({
      type: 'success',
      text,
      ...options,
    })
  }

  const error = (text: string, options?: MessageOptions) => {
    return push({
      type: 'error',
      text,
      ...options,
    })
  }

  const warning = (text: string, options?: MessageOptions) => {
    return push({
      type: 'warning',
      text,
      ...options,
    })
  }

  const info = (text: string, options?: MessageOptions) => {
    return push({
      type: 'info',
      text,
      ...options,
    })
  }

  return {
    items,
    push,
    success,
    error,
    warning,
    info,
    remove,
    clear,
  }
})
