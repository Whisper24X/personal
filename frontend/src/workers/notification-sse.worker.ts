const SSE_RECONNECT_DELAY_MS = 5_000
const ERROR_DEDUP_WINDOW_MS = 60_000
const NOTIFICATION_ICON = '/favicon.ico'

let currentAbort: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let sseUrl = ''
let authToken = ''
const lastErrorAtByCode = new Map<string, number>()

type SseParsed = {
  id?: string
  event?: string
  data: string
}

function reportNotificationError(code: string, message: string) {
  const now = Date.now()
  const lastErrorAt = lastErrorAtByCode.get(code)

  if (lastErrorAt && now - lastErrorAt < ERROR_DEDUP_WINDOW_MS) {
    return
  }

  lastErrorAtByCode.set(code, now)
  self.postMessage({
    type: 'notification_error',
    code,
    message,
  })
}

function parseSseChunk(chunk: string): SseParsed | null {
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

  if (dataLines.length === 0) return null

  return { id: eventId, event: eventType, data: dataLines.join('\n') }
}

function showNotification(title: string, body: string, taskId?: string | null) {
  if (typeof Notification === 'undefined') {
    reportNotificationError('unsupported', '当前浏览器不支持系统通知，无法展示任务提醒。')
    return
  }

  if (Notification.permission !== 'granted') {
    reportNotificationError(
      Notification.permission === 'denied' ? 'permission_denied' : 'permission_default',
      Notification.permission === 'denied'
        ? '浏览器通知权限已被拒绝，请在“设置 > 通知”中手动开启。'
        : '浏览器通知尚未授权，请在“设置 > 通知”中点击“检查授权”。',
    )
    return
  }

  let notification: Notification

  try {
    notification = new Notification(title, {
      body,
      icon: NOTIFICATION_ICON,
      tag: taskId ? `${taskId}-${Date.now()}` : undefined,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : '未知错误'

    reportNotificationError('show_failed', `浏览器通知发送失败：${errorMessage}`)
    return
  }

  if (taskId) {
    notification.onclick = () => {
      self.postMessage({ type: 'navigate', taskId })
      notification.close()
    }
  }
}

function handleSseEvent(parsed: SseParsed) {
  if (parsed.event !== 'new_event') return

  try {
    const payload = JSON.parse(parsed.data)
    showNotification(
      payload.title ?? '新通知',
      payload.content ?? '',
      payload.taskId,
    )
  } catch {
    // ignore
  }
}

async function connectSse() {
  currentAbort?.abort()
  currentAbort = new AbortController()

  try {
    const response = await fetch(sseUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      signal: currentAbort.signal,
    })

    if (!response.ok || !response.body) {
      throw new Error(`SSE ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let idx = buffer.indexOf('\n\n')
      while (idx !== -1) {
        const chunk = buffer.slice(0, idx).trim()
        if (chunk) {
          const parsed = parseSseChunk(chunk)
          if (parsed) handleSseEvent(parsed)
        }
        buffer = buffer.slice(idx + 2)
        idx = buffer.indexOf('\n\n')
      }
    }

    const remain = buffer.trim()
    if (remain) {
      const parsed = parseSseChunk(remain)
      if (parsed) handleSseEvent(parsed)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
  }

  scheduleReconnect()
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => connectSse(), SSE_RECONNECT_DELAY_MS)
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data

  if (msg.type === 'start') {
    sseUrl = msg.sseUrl
    authToken = msg.authToken ?? ''
    connectSse()
  }

  if (msg.type === 'stop') {
    currentAbort?.abort()
    if (reconnectTimer) clearTimeout(reconnectTimer)
  }
}
