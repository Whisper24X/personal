import request from './axios.interceptor'
const BASE_URL = '/shadow/v1/'

export interface NotificationQueryParams {
  adminId: string
  page?: number
  pageSize?: number
}

export interface NotificationItem {
  id: string
  adminId: string
  notificationType: string
  nextContactTime: string
  contactUserName: string
  clueId: string
  updatedByName: string
  isRead: boolean
  contactRecordId: string
  createdAt: string
  updatedAt: string
}

export interface NotificationListResponse {
  total: number
  list: NotificationItem[]
}

export interface HasNotificationResponse {
  hasClueNotification: boolean
}

export interface ReadNotificationParams {
  id: string
}

export interface ReadNotificationResponse {
  isSucceed: boolean
}

// 查询是否有新消息
export const queryIfHasNotification = (adminId: string) => {
  return request.get<HasNotificationResponse>(
    `${BASE_URL}queryIfHasClueNotification`,
    { adminId },
  )
}

// 获取消息列表
export const queryNotificationList = (params: NotificationQueryParams) => {
  return request.post<NotificationListResponse>(
    `${BASE_URL}queryClueNotificationList`,
    params,
  )
}

// 标记消息已读
export const readNotification = (params: ReadNotificationParams) => {
  return request.post<ReadNotificationResponse>(
    `${BASE_URL}readNotification`,
    params,
  )
}
