import { STORAGE_KEYS } from '@shared/types/common/storage'

export type TerminalWsMessage =
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number | null; signal: string | null }
  | { type: 'error'; message: string }
  | { type: 'attached'; sessionId: string }

export type TerminalWsCallbacks = {
  onMessage: (message: TerminalWsMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
}

function buildWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const token = localStorage.getItem(STORAGE_KEYS.authToken) ?? ''
  return `${protocol}//${host}/ws/terminal?token=${encodeURIComponent(token)}`
}

export class TerminalWsConnection {
  private ws: WebSocket | null = null
  private disposed = false

  constructor(private readonly callbacks: TerminalWsCallbacks) {}

  connect(): void {
    if (this.disposed) {
      return
    }

    const url = buildWsUrl()
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.callbacks.onOpen?.()
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(String(event.data)) as TerminalWsMessage
        this.callbacks.onMessage(message)
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.callbacks.onClose?.()
    }

    this.ws.onerror = (event: Event) => {
      this.callbacks.onError?.(event)
    }
  }

  attach(taskId: string, sessionId: string): void {
    this.send({ type: 'attach', taskId, sessionId })
  }

  detach(): void {
    this.send({ type: 'detach' })
  }

  input(data: string): void {
    this.send({ type: 'input', data })
  }

  resize(cols: number, rows: number): void {
    this.send({ type: 'resize', cols, rows })
  }

  dispose(): void {
    this.disposed = true
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }
}
