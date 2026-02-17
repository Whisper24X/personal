<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { notificationsApi } from '@/api/notifications'
import { useAuth } from '@/hooks'
import type { NotificationEvent, NotificationSetting } from '@/types/api/notifications'

const router = useRouter()

const density = ref<'comfortable' | 'compact'>('comfortable')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const settingForm = reactive({
  emailEnabled: true,
  webhookEnabled: false,
  webhookUrl: '',
  inAppEnabled: true,
})

const events = ref<NotificationEvent[]>([])

const { logout } = useAuth()

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const syncSettingForm = (setting: NotificationSetting) => {
  settingForm.emailEnabled = setting.emailEnabled
  settingForm.webhookEnabled = setting.webhookEnabled
  settingForm.webhookUrl = setting.webhookUrl ?? ''
  settingForm.inAppEnabled = setting.inAppEnabled
}

const loadPageData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [settingResponse, eventResponse] = await Promise.all([
      notificationsApi.setting(),
      notificationsApi.events({ limit: 20 }),
    ])

    syncSettingForm(settingResponse)
    events.value = eventResponse
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载设置失败'
  } finally {
    loading.value = false
  }
}

const saveNotificationSetting = async () => {
  saving.value = true
  errorMessage.value = ''

  try {
    const setting = await notificationsApi.updateSetting({
      emailEnabled: settingForm.emailEnabled,
      webhookEnabled: settingForm.webhookEnabled,
      webhookUrl: settingForm.webhookUrl.trim() || undefined,
      inAppEnabled: settingForm.inAppEnabled,
    })

    syncSettingForm(setting)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存通知设置失败'
  } finally {
    saving.value = false
  }
}

const markRead = async (event: NotificationEvent) => {
  if (event.readAt) {
    return
  }

  try {
    await notificationsApi.markRead(event.id)
    await loadPageData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '标记已读失败'
  }
}

const onLogout = async () => {
  await logout()
  await router.push('/login')
}

onMounted(() => {
  void loadPageData()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作区</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">设置</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        管理界面偏好、通知配置与当前登录会话。
      </p>
      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <div class="panel-card p-5">
        <p class="text-sm font-semibold">界面密度</p>
        <p class="mt-2 text-xs text-muted-foreground">紧凑模式更适合表格密集和日志密集场景。</p>
        <div class="mt-4 flex gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="density = 'comfortable'"
          >
            舒适
          </button>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="density = 'compact'"
          >
            紧凑
          </button>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">当前模式：{{ density === 'comfortable' ? '舒适' : '紧凑' }}</p>
      </div>

      <div class="panel-card p-5">
        <p class="text-sm font-semibold">通知设置</p>

        <div v-if="loading" class="mt-3 text-xs text-muted-foreground">加载中...</div>

        <form v-else class="mt-4 space-y-3" @submit.prevent="saveNotificationSetting">
          <label class="flex items-center justify-between text-sm">
            邮件通知
            <input v-model="settingForm.emailEnabled" class="h-4 w-4" type="checkbox" />
          </label>

          <label class="flex items-center justify-between text-sm">
            应用内通知
            <input v-model="settingForm.inAppEnabled" class="h-4 w-4" type="checkbox" />
          </label>

          <label class="flex items-center justify-between text-sm">
            Webhook 通知
            <input v-model="settingForm.webhookEnabled" class="h-4 w-4" type="checkbox" />
          </label>

          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Webhook 地址</span>
            <input
              v-model="settingForm.webhookUrl"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="https://example.com/hook"
              type="text"
            />
          </label>

          <button
            class="h-9 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="saving"
            type="submit"
          >
            {{ saving ? '保存中...' : '保存通知设置' }}
          </button>
        </form>
      </div>
    </section>

    <section class="panel-card p-5">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">通知事件</p>
        <button
          class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
          type="button"
          @click="loadPageData"
        >
          刷新
        </button>
      </div>

      <ul class="mt-4 space-y-2">
        <li
          v-for="event in events"
          :key="event.id"
          class="rounded-xl border border-border bg-background/60 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ event.title }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ event.content }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ formatDate(event.createdAt) }}</p>
            </div>

            <button
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="Boolean(event.readAt)"
              type="button"
              @click="markRead(event)"
            >
              {{ event.readAt ? '已读' : '标记已读' }}
            </button>
          </div>
        </li>

        <li v-if="events.length === 0" class="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          暂无通知事件。
        </li>
      </ul>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-semibold">账号与会话</p>
          <p class="mt-1 text-xs text-muted-foreground">如需切换账号，可在此退出当前登录状态。</p>
        </div>
        <RouterLink
          to="/login"
          class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
          @click.prevent="onLogout"
        >
          退出登录
        </RouterLink>
      </div>
    </section>
  </div>
</template>
