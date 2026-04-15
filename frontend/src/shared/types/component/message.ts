export type MessageType = 'success' | 'error' | 'warning' | 'info'

export type MessageItem = {
  id: string
  type: MessageType
  text: string
  duration: number
  createdAt: number
  dedupeKey?: string
}

export type MessagePushPayload = {
  type: MessageType
  text: string
  duration?: number
  dedupeKey?: string
}

export type MessageOptions = {
  duration?: number
  dedupeKey?: string
}
