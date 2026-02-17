export type NotificationSetting = {
  id: string
  userId: string
  emailEnabled: boolean
  webhookEnabled: boolean
  webhookUrl?: string | null
  inAppEnabled: boolean
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
  emailEnabled: boolean
  webhookEnabled: boolean
  webhookUrl: string
  inAppEnabled: boolean
}>
