export type NotificationSetting = {
  id: string
  userId: string
  webhookEnabled: boolean
  webhookUrl?: string | null
  webhookSecret?: string | null
  browserEnabled: boolean
}

export type NotificationEvent = {
  id: string
  userId: string
  taskId?: string | null
  eventType: string
  title: string
  content: string
  payload?: Record<string, unknown> | null
  readAt?: string | null
  createdAt: string
}

export type UpdateNotificationSettingPayload = Partial<{
  webhookEnabled: boolean
  webhookUrl: string | null
  webhookSecret: string | null
  browserEnabled: boolean
}>
