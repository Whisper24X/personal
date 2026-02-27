import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMessageStore } from '@/stores/modules/message'

describe('message store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pushes message and supports remove/clear', () => {
    const store = useMessageStore()

    const firstId = store.success('创建成功')
    const secondId = store.error('保存失败')

    expect(store.items).toHaveLength(2)
    expect(store.items[0]?.id).toBe(secondId)
    expect(store.items[1]?.id).toBe(firstId)

    store.remove(secondId)
    expect(store.items).toHaveLength(1)
    expect(store.items[0]?.id).toBe(firstId)

    store.clear()
    expect(store.items).toHaveLength(0)
  })

  it('auto dismisses by duration', () => {
    vi.useFakeTimers()

    const store = useMessageStore()
    store.success('短提示')

    expect(store.items).toHaveLength(1)

    vi.advanceTimersByTime(3001)
    expect(store.items).toHaveLength(0)
  })

  it('dedupes repeated messages in 2s window', () => {
    vi.useFakeTimers()

    const store = useMessageStore()
    store.error('重复错误')
    store.error('重复错误')

    expect(store.items).toHaveLength(1)

    vi.advanceTimersByTime(2001)
    store.error('重复错误')

    expect(store.items).toHaveLength(2)
  })
})
