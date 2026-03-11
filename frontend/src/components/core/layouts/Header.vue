<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { notificationsApi } from '@/api/notifications'
import type { NotificationEvent } from '@/types/api/notifications'

defineOptions({
  name: 'AppHeaderBar',
})

const props = defineProps<{
  mobileNavOpen: boolean
  pageTitle: string
  currentProjectName: string
  showCurrentProjectName: boolean
  breadcrumbs: string[]
  toggleMobileNav: () => void
}>()

const notificationRootRef = ref<HTMLElement | null>(null)
const notificationOpen = ref(false)
const notificationLoading = ref(false)
const notificationError = ref('')
const notificationEvents = ref<NotificationEvent[]>([])
const badgeCount = ref(0)
const markingAllRead = ref(false)
const deletingRead = ref(false)

const unreadCount = computed(() => {
  return notificationEvents.value.filter((event) => !event.readAt).length
})

const hasReadEvents = computed(() => {
  return notificationEvents.value.some((event) => event.readAt)
})

const formatDate = (value: string) => {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const loadUnreadCount = async () => {
  try {
    const result = await notificationsApi.unreadCount()
    badgeCount.value = result.count
  } catch {
    badgeCount.value = 0
  }
}

const loadNotifications = async () => {
  notificationLoading.value = true
  notificationError.value = ''

  try {
    notificationEvents.value = await notificationsApi.events({ limit: 50 })
    badgeCount.value = unreadCount.value
  } catch (error) {
    notificationError.value = error instanceof Error ? error.message : '加载消息失败'
  } finally {
    notificationLoading.value = false
  }
}

const toggleNotifications = async () => {
  const nextOpen = !notificationOpen.value
  notificationOpen.value = nextOpen

  if (!nextOpen) {
    return
  }

  await loadNotifications()
}

const closeNotifications = () => {
  notificationOpen.value = false
}

const markRead = async (event: NotificationEvent) => {
  if (event.readAt) {
    return
  }

  try {
    await notificationsApi.markRead(event.id)
    event.readAt = new Date().toISOString()
    badgeCount.value = unreadCount.value
  } catch (error) {
    notificationError.value = error instanceof Error ? error.message : '标记已读失败'
  }
}

const markAllRead = async () => {
  if (markingAllRead.value || unreadCount.value === 0) {
    return
  }

  markingAllRead.value = true

  try {
    await notificationsApi.markAllRead()
    const now = new Date().toISOString()
    for (const event of notificationEvents.value) {
      if (!event.readAt) {
        event.readAt = now
      }
    }
    badgeCount.value = 0
  } catch (error) {
    notificationError.value = error instanceof Error ? error.message : '全部已读失败'
  } finally {
    markingAllRead.value = false
  }
}

const deleteReadEvents = async () => {
  if (deletingRead.value || !hasReadEvents.value) {
    return
  }

  deletingRead.value = true

  try {
    await notificationsApi.deleteRead()
    notificationEvents.value = notificationEvents.value.filter((event) => !event.readAt)
  } catch (error) {
    notificationError.value = error instanceof Error ? error.message : '清除已读失败'
  } finally {
    deletingRead.value = false
  }
}

const onWindowClick = (event: MouseEvent) => {
  if (!notificationOpen.value) {
    return
  }

  const target = event.target as Node | null
  if (target && notificationRootRef.value?.contains(target)) {
    return
  }

  closeNotifications()
}

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return
  }

  closeNotifications()
}

onMounted(() => {
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onWindowKeydown)
  void loadUnreadCount()
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <header class="border-b border-border bg-background/85 backdrop-blur">
    <div class="flex h-16 items-center justify-between px-4 md:px-6">
      <div class="flex items-center gap-3">
        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:shadow-sm 2xl:hidden"
          type="button"
          aria-controls="workspace-nav"
          :aria-expanded="props.mobileNavOpen"
          :aria-label="props.mobileNavOpen ? '收起导航' : '展开导航'"
          @click="props.toggleMobileNav"
        >
          <svg
            v-if="!props.mobileNavOpen"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        <div
          v-if="props.showCurrentProjectName"
          class="hidden h-9 max-w-[16rem] items-center justify-center rounded-lg bg-muted px-3 text-xs font-semibold text-muted-foreground sm:inline-flex"
          :title="props.currentProjectName"
        >
          <span class="truncate">{{ props.currentProjectName }}</span>
        </div>

        <div>
          <p class="text-sm font-semibold leading-none">{{ props.pageTitle }}</p>
        </div>
      </div>

      <div ref="notificationRootRef" class="relative">
        <button
          class="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:shadow-sm"
          type="button"
          aria-label="消息中心"
          :aria-expanded="notificationOpen"
          aria-haspopup="menu"
          @click.stop="toggleNotifications"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M10.268 21a2 2 0 0 0 3.464 0" />
            <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .738-1.674C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
          </svg>
          <span
            v-if="badgeCount > 0"
            class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-5 text-destructive-foreground"
          >
            {{ badgeCount > 99 ? '99+' : badgeCount }}
          </span>
        </button>

        <div
          v-if="notificationOpen"
          class="absolute right-0 top-12 z-40 w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        >
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <p class="text-sm font-semibold">消息中心</p>
            <div class="flex items-center gap-1.5">
              <button
                class="rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                :disabled="markingAllRead || unreadCount === 0"
                @click="markAllRead"
              >
                全部已读
              </button>
              <button
                class="rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                :disabled="deletingRead || !hasReadEvents"
                @click="deleteReadEvents"
              >
                清除已读
              </button>
              <button
                class="rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                :disabled="notificationLoading"
                @click="loadNotifications"
              >
                {{ notificationLoading ? '刷新中...' : '刷新' }}
              </button>
            </div>
          </div>

          <div class="max-h-96 overflow-auto p-2">
            <p v-if="notificationError" class="px-2 py-2 text-xs text-destructive">{{ notificationError }}</p>

            <p v-else-if="notificationLoading" class="px-2 py-2 text-xs text-muted-foreground">加载中...</p>

            <ul v-else-if="notificationEvents.length > 0" class="space-y-1">
              <li
                v-for="event in notificationEvents"
                :key="event.id"
                class="rounded-lg border border-border bg-card/40 px-3 py-2"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ event.title }}</p>
                    <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ event.content }}</p>
                    <p class="mt-1 text-[11px] text-muted-foreground">{{ formatDate(event.createdAt) }}</p>
                  </div>
                  <button
                    class="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(event.readAt)"
                    type="button"
                    @click="markRead(event)"
                  >
                    {{ event.readAt ? '已读' : '标记已读' }}
                  </button>
                </div>
              </li>
            </ul>

            <p v-else class="px-2 py-2 text-xs text-muted-foreground">暂无消息。</p>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
