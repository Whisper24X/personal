<template>
  <el-popover placement="bottom-start" :width="400" trigger="click" popper-class="notification-popover"
    @show="handlePopoverShow" v-model:visible="popoverVisible">
    <template #reference>
      <el-badge :is-dot="notificationStore.hasUnread" class="notification-badge">
        <el-button class="notification-btn" :icon="Bell" text />
      </el-badge>
    </template>

    <template #default>
      <div class="notification-header">
        <h3>消息通知</h3>
      </div>
      <div class="notification-list" v-loading="loading" @scroll="handleScroll" ref="listRef">
        <div v-for="item in messages" :key="item.id" class="message-item" @click="handleMessageClick(item)">
          <div class="message-content">
            <div class="message-title">
              {{ formatNotificationTitle(item) }}
            </div>
            <div class="message-time">{{ formatDateTime(item.createdAt) }}</div>
          </div>
          <div v-if="!item.isRead" class="unread-dot"></div>
        </div>
        <div v-if="loading" class="loading-more">加载中...</div>
        <el-empty v-if="!messages.length && !loading" description="暂无消息" />
        <div v-if="!hasMore && messages.length" class="no-more">没有更多了</div>
      </div>
    </template>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Bell } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/modules/userStore'
import { useNotificationStore } from '@/store/modules/notificationStore'
import dayjs from 'dayjs'
import {
  queryNotificationList,
  readNotification,
} from '@/service/notification.service'
import type { NotificationItem } from '@/service/notification.service'
import router from '@/routers'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const notificationStore = useNotificationStore()
const listRef = ref<HTMLElement>()
const currentPage = ref(1)
const pageSize = ref(8)
const hasMore = ref(true)
const loading = ref(false)
const messages = ref<NotificationItem[]>([])
const popoverVisible = ref(false)
const total = ref(0)

// 获取消息列表
const fetchMessages = async (isLoadMore = false) => {
  if (loading.value || (!isLoadMore && !hasMore.value)) return

  loading.value = true
  try {
    const res = await queryNotificationList({
      adminId: userStore.info?.id || '',
      page: currentPage.value,
      pageSize: pageSize.value,
    })

    if (isLoadMore) {
      messages.value = [...messages.value, ...res.list]
    } else {
      messages.value = res.list
    }

    total.value = res.total

    // 通过已加载的消息数量和总数来判断是否还有更多
    hasMore.value = messages.value.length < total.value

    if (hasMore.value) {
      currentPage.value++
    }
  } catch (error) {
    console.error('获取消息列表失败：', error)
  } finally {
    loading.value = false
  }
}

// 格式化消息标题
const formatNotificationTitle = (item: NotificationItem) => {
  if (item.notificationType === '下次跟进提醒') {
    return `今天是客户${item.contactUserName}的下次跟进时间`
  } else {
    return `${item.updatedByName}变更您为客户的伴学师`
  }
}

// 格式化时间
const formatDateTime = (dateString: string) => {
  return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss')
}

// 处理消息点击
const handleMessageClick = async (message: NotificationItem) => {
  if (!message.isRead) {
    try {
      await readNotification({ id: message.id })
      message.isRead = true
      notificationStore.checkNewNotifications()
    } catch (error) {
      console.error('标记消息已读失败：', error)
    }
  }

  // 关闭 popover
  popoverVisible.value = false

}

// 处理滚动事件
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const scrollBottom =
    target.scrollHeight - target.scrollTop - target.clientHeight

  // 当距离底部小于 50px 时加载更多
  if (scrollBottom < 50 && !loading.value && hasMore.value) {
    fetchMessages(true)
  }
}

// 重置列表状态
const resetList = () => {
  currentPage.value = 1
  hasMore.value = true
  messages.value = []
}

// Popover 显示时获取最新消息
const handlePopoverShow = () => {
  notificationStore.checkNewNotifications()
  resetList()
  fetchMessages()
}

// 组件挂载时检查新消息
onMounted(() => {
  // notificationStore.checkNewNotifications()
})
</script>

<style lang="scss" scoped>
.notification-header {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;

  h3 {
    margin: 0;
    font-size: 16px;
    color: #333;
  }
}

.notification-list {
  max-height: 400px;
  overflow-y: auto;

  // 添加滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #ddd;
    border-radius: 3px;

    &:hover {
      background-color: #ccc;
    }
  }

  .loading-more,
  .no-more {
    padding: 10px 0;
    text-align: center;
    color: #999;
    font-size: 12px;
  }

  .message-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;

    &:hover {
      background-color: #f5f7fa;
    }

    &:last-child {
      border-bottom: none;
    }

    .message-content {
      flex: 1;
      padding-right: 12px;

      .message-title {
        font-size: 13px;
        color: #333;
        margin-bottom: 4px;
        line-height: 1.4;
      }

      .message-time {
        font-size: 12px;
        color: #999;
      }
    }

    .unread-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #f56c6c;
      margin-top: 6px;
      flex-shrink: 0;
    }
  }
}

// 自定义 Popover 样式
:deep(.notification-popover) {
  padding: 0;
  border-radius: 4px;
}

// 调整红点角标的样式
.notification-badge {
  margin-right: auto;

  :deep(.el-badge__content.is-fixed.is-dot) {
    right: 12px;
    top: 10px;
  }

  .notification-btn {
    font-size: 22px;
    color: #666;
    height: auto;
    padding: 8px;

    &:hover,
    &:focus {
      color: #409eff;
      background-color: transparent;
    }

    &:active {
      color: #337ecc;
    }
  }
}
</style>
