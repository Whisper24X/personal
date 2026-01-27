import { defineStore } from 'pinia'
import { queryIfHasNotification } from '@/service/notification.service'
import { useUserStore } from './userStore'

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    hasUnread: false,
  }),

  actions: {
    async checkNewNotifications() {
      try {
        const userStore = useUserStore()
        const res = await queryIfHasNotification(userStore.info?.id || '')
        this.hasUnread = res.hasClueNotification
      } catch (error) {
        console.error('检查新消息失败：', error)
      }
    },
  },
})
