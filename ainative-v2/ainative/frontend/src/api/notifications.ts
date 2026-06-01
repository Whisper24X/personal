import type {
  NotificationEvent,
  NotificationSetting,
  UpdateNotificationSettingPayload,
} from '@/types/api/notifications'
import { apiHttp } from './http'

export const notificationsApi = {
  setting() {
    return apiHttp.get<NotificationSetting>('/notifications/settings')
  },

  updateSetting(payload: UpdateNotificationSettingPayload) {
    return apiHttp.patch<NotificationSetting>('/notifications/settings', payload)
  },

  events(params?: { unreadOnly?: boolean; limit?: number }) {
    return apiHttp.get<NotificationEvent[]>('/notifications/events', {
      unreadOnly: params?.unreadOnly,
      limit: params?.limit,
    })
  },

  markRead(eventId: string) {
    return apiHttp.post<NotificationEvent>(`/notifications/events/${eventId}/read`)
  },

  markAllRead() {
    return apiHttp.post<{ affected: number }>('/notifications/events/read-all')
  },

  deleteRead() {
    return apiHttp.delete<{ affected: number }>('/notifications/events/read')
  },

  unreadCount() {
    return apiHttp.get<{ count: number }>('/notifications/events/unread-count')
  },
}
