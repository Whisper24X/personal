<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { notificationsApi } from '@/api/notifications'
import { useAuth } from '@/hooks'
import { useUserStore } from '@/stores/modules/user'
import { STORAGE_KEYS } from '@/types/common/storage'
import type { UserInfo } from '@/types/api/auth'
import type { NotificationEvent, NotificationSetting } from '@/types/api/notifications'
import { storage } from '@/utils/storage'

const router = useRouter()
const userStore = useUserStore()

defineOptions({
  name: 'PersonalSettingsPanel',
})

type UiDensity = 'comfortable' | 'compact'

const density = ref<UiDensity>('comfortable')
const loading = ref(false)
const saving = ref(false)
const profileSaving = ref(false)
const passwordSaving = ref(false)
const deletingAccount = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const settingForm = reactive({
  emailEnabled: true,
  webhookEnabled: false,
  webhookUrl: '',
  inAppEnabled: true,
})

const profileForm = reactive({
  username: '',
  email: '',
  nickname: '',
  avatar: '',
})

const passwordForm = reactive({
  oldPassword: '',
  password: '',
  confirmPassword: '',
})

const events = ref<NotificationEvent[]>([])

const { logout } = useAuth()

const profileDisplayName = computed(() => {
  return profileForm.nickname.trim() || profileForm.username.trim() || '-'
})

const applyDensity = (nextDensity: UiDensity) => {
  density.value = nextDensity
  storage.set(STORAGE_KEYS.uiDensity, nextDensity)
  document.documentElement.setAttribute('data-ui-density', nextDensity)
}

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

const syncProfileForm = (profile: UserInfo) => {
  profileForm.username = profile.username ?? ''
  profileForm.email = profile.email ?? ''
  profileForm.nickname = profile.nickname ?? ''
  profileForm.avatar = profile.avatar ?? ''
}

const normalizeOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const clearPasswordForm = () => {
  passwordForm.oldPassword = ''
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
}

const loadPageData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [profileResponse, settingResponse, eventResponse] = await Promise.all([
      authApi.me(),
      notificationsApi.setting(),
      notificationsApi.events({ limit: 20 }),
    ])

    syncProfileForm(profileResponse)
    syncSettingForm(settingResponse)
    events.value = eventResponse
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载设置失败'
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  if (!profileForm.username.trim()) {
    errorMessage.value = '用户名不能为空'
    return
  }

  profileSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updatedProfile = await authApi.updateMe({
      username: profileForm.username.trim(),
      email: normalizeOptionalText(profileForm.email),
      nickname: normalizeOptionalText(profileForm.nickname),
      avatar: normalizeOptionalText(profileForm.avatar),
    })

    syncProfileForm(updatedProfile)
    userStore.setProfile(userStore.mapUserToProfile(updatedProfile))
    successMessage.value = '个人资料已更新'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存个人资料失败'
  } finally {
    profileSaving.value = false
  }
}

const savePassword = async () => {
  const oldPassword = passwordForm.oldPassword.trim()
  const newPassword = passwordForm.password.trim()
  const confirmPassword = passwordForm.confirmPassword.trim()

  if (!oldPassword || !newPassword || !confirmPassword) {
    errorMessage.value = '请填写旧密码、新密码和确认密码'
    return
  }

  if (newPassword.length < 6) {
    errorMessage.value = '新密码至少 6 位'
    return
  }

  if (newPassword !== confirmPassword) {
    errorMessage.value = '两次输入的新密码不一致'
    return
  }

  passwordSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updatedProfile = await authApi.updateMe({
      oldPassword,
      password: newPassword,
    })

    syncProfileForm(updatedProfile)
    userStore.setProfile(userStore.mapUserToProfile(updatedProfile))
    clearPasswordForm()
    successMessage.value = '密码已更新'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '修改密码失败'
  } finally {
    passwordSaving.value = false
  }
}

const saveNotificationSetting = async () => {
  if (settingForm.webhookEnabled && !settingForm.webhookUrl.trim()) {
    errorMessage.value = '启用 Webhook 时必须填写回调地址'
    return
  }

  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const setting = await notificationsApi.updateSetting({
      emailEnabled: settingForm.emailEnabled,
      webhookEnabled: settingForm.webhookEnabled,
      webhookUrl: settingForm.webhookUrl.trim() || undefined,
      inAppEnabled: settingForm.inAppEnabled,
    })

    syncSettingForm(setting)
    successMessage.value = '通知设置已更新'
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
  try {
    await logout()
  } finally {
    await router.push('/login')
  }
}

const deleteAccount = async () => {
  if (!window.confirm('确认注销当前账号吗？该操作不可恢复。')) {
    return
  }

  deletingAccount.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await authApi.deleteMe()
    userStore.setToken(null)
    userStore.setProfile(null)
    await router.push('/login')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '注销账号失败'
  } finally {
    deletingAccount.value = false
  }
}

onMounted(() => {
  const storedDensity = storage.get<UiDensity>(STORAGE_KEYS.uiDensity)
  if (storedDensity === 'compact' || storedDensity === 'comfortable') {
    applyDensity(storedDensity)
  } else {
    applyDensity('comfortable')
  }

  void loadPageData()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作区</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">设置</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        管理界面偏好、个人资料、密码与通知配置。
      </p>
      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-sm text-emerald-600 dark:text-emerald-300">{{ successMessage }}</p>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <article class="panel-card p-5">
        <p class="text-sm font-semibold">界面密度</p>
        <p class="mt-2 text-xs text-muted-foreground">紧凑模式更适合表格密集和日志密集场景。</p>
        <div class="mt-4 flex gap-2">
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="applyDensity('comfortable')"
          >
            舒适
          </button>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="applyDensity('compact')"
          >
            紧凑
          </button>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">当前模式：{{ density === 'comfortable' ? '舒适' : '紧凑' }}</p>
      </article>

      <article class="panel-card p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">个人资料</p>
            <p class="mt-1 text-xs text-muted-foreground">当前账号：{{ profileDisplayName }}</p>
          </div>
          <button
            class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadPageData"
          >
            刷新
          </button>
        </div>

        <div v-if="loading" class="mt-3 text-xs text-muted-foreground">加载中...</div>

        <form v-else class="mt-4 grid gap-3" @submit.prevent="saveProfile">
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">用户名</span>
            <input
              v-model="profileForm.username"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              type="text"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">邮箱</span>
            <input
              v-model="profileForm.email"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="user@example.com"
              type="email"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">昵称</span>
            <input
              v-model="profileForm.nickname"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              type="text"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">头像链接</span>
            <input
              v-model="profileForm.avatar"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="https://example.com/avatar.png"
              type="text"
            />
          </label>

          <button
            class="h-9 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="profileSaving"
            type="submit"
          >
            {{ profileSaving ? '保存中...' : '保存个人资料' }}
          </button>
        </form>
      </article>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <article class="panel-card p-5">
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
      </article>

      <article class="panel-card p-5">
        <p class="text-sm font-semibold">修改密码</p>
        <p class="mt-1 text-xs text-muted-foreground">修改密码需要输入当前密码。</p>

        <form class="mt-4 space-y-3" @submit.prevent="savePassword">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">当前密码</span>
            <input
              v-model="passwordForm.oldPassword"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              type="password"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">新密码</span>
            <input
              v-model="passwordForm.password"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              type="password"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">确认新密码</span>
            <input
              v-model="passwordForm.confirmPassword"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              type="password"
            />
          </label>

          <button
            class="h-9 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="passwordSaving"
            type="submit"
          >
            {{ passwordSaving ? '保存中...' : '更新密码' }}
          </button>
        </form>
      </article>
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

        <li
          v-if="events.length === 0"
          class="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground"
        >
          暂无通知事件。
        </li>
      </ul>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-semibold">账号与会话</p>
          <p class="mt-1 text-xs text-muted-foreground">可退出当前会话，或注销当前账号。</p>
        </div>
        <div class="flex gap-2">
          <button
            class="inline-flex h-10 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deletingAccount"
            type="button"
            @click="deleteAccount"
          >
            {{ deletingAccount ? '注销中...' : '注销账号' }}
          </button>
          <RouterLink
            to="/login"
            class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            @click.prevent="onLogout"
          >
            退出登录
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
