const SSE_RECONNECT_DELAY_MS = 5_000
const ERROR_DEDUP_WINDOW_MS = 60_000
const NOTIFICATION_ICON = '/logo.svg'

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

type NotificationEventPayload = {
  title?: string
  content?: string
  taskId?: string | null
  eventType?: string
  payload?: Record<string, unknown> | null
}

const PROJECT_PROVISIONING_EVENT_TYPES = new Set([
  'project.repository_provisioning.ready',
  'project.repository_provisioning.failed',
])

const asString = (value: unknown) => {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

const normalizeAuthToken = (value: unknown) => {
  const token = asString(value)
  if (!token) {
    return ''
  }

  return token.startsWith('Bearer ') ? token.slice('Bearer '.length).trim() : token
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
  notification.onshow = () => {
  }
  notification.onerror = () => {
  }
  notification.onclose = () => {
  }
}

function handleSseEvent(parsed: SseParsed) {
  if (parsed.event !== 'new_event') return

  try {
    const payload = JSON.parse(parsed.data) as NotificationEventPayload
    showNotification(
      payload.title ?? '新通知',
      payload.content ?? '',
      payload.taskId,
    )

    if (!payload.eventType || !PROJECT_PROVISIONING_EVENT_TYPES.has(payload.eventType)) {
      return
    }

    const provisioningPayload = payload.payload ?? {}
    const projectId = asString(provisioningPayload.projectId)
    const businessLineId = asString(provisioningPayload.businessLineId)
    const status = asString(provisioningPayload.status)

    if (!projectId || !businessLineId || (status !== 'ready' && status !== 'failed')) {
      return
    }

    self.postMessage({
      type: 'project_repository_provisioning_changed',
      eventId: parsed.id ?? null,
      eventType: payload.eventType ?? null,
      projectId,
      businessLineId,
      status,
      title: payload.title ?? '',
      content: payload.content ?? '',
      errorMessage:
        typeof provisioningPayload.errorMessage === 'string'
          ? provisioningPayload.errorMessage
          : null,
    })
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
    authToken = normalizeAuthToken(msg.authToken)
    connectSse()
  }

  if (msg.type === 'update_auth') {
    const nextToken = normalizeAuthToken(msg.authToken)
    if (!nextToken || nextToken === authToken) {
      return
    }
    authToken = nextToken
    connectSse()
  }

  if (msg.type === 'stop') {
    currentAbort?.abort()
    if (reconnectTimer) clearTimeout(reconnectTimer)
  }
}
