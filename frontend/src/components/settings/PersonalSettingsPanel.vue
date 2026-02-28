<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { notificationsApi } from '@/api/notifications'
import { useAuth, useMessage } from '@/hooks'
import { useUserStore } from '@/stores/modules/user'
import { STORAGE_KEYS } from '@/types/common/storage'
import type { UserInfo } from '@/types/api/auth'
import type { NotificationSetting } from '@/types/api/notifications'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { storage } from '@/utils/storage'
import {
  applyAppearanceMode,
  applyBackgroundStyle,
  applyThemeColor,
  applyUiLocale,
  loadUiPreferencesFromStorage,
  type AppearanceMode,
  type BackgroundStyle,
  type ThemeColor,
  type UiLocale,
} from '@/utils/ui-preferences'

const router = useRouter()
const userStore = useUserStore()

defineOptions({
  name: 'PersonalSettingsPanel',
})

type PersonalSettingsTab = 'appearance' | 'profile' | 'security' | 'notifications'
type PanelType = 'account' | 'appearance' | 'notifications'
type BrowserPermissionState = NotificationPermission | 'unsupported'

const LANGUAGE_OPTIONS: Array<{ value: UiLocale; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
]

const THEME_COLOR_OPTIONS: Array<{ value: ThemeColor; label: string }> = [
  { value: 'amber', label: '琥珀' },
  { value: 'ocean', label: '海蓝' },
  { value: 'forest', label: '森绿' },
]

const APPEARANCE_OPTIONS: Array<{ value: AppearanceMode; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

const BACKGROUND_STYLE_OPTIONS: Array<{ value: BackgroundStyle; label: string }> = [
  { value: 'grid', label: '网格光斑' },
  { value: 'plain', label: '纯色' },
  { value: 'glow', label: '柔光' },
]

const props = defineProps<{
  externalTab?: PersonalSettingsTab
}>()

const locale = ref<UiLocale>('zh-CN')
const themeColor = ref<ThemeColor>('amber')
const appearanceMode = ref<AppearanceMode>('light')
const backgroundStyle = ref<BackgroundStyle>('grid')
const activeTab = ref<PersonalSettingsTab>('profile')
const loading = ref(false)
const notificationSaving = ref(false)
const profileSaving = ref(false)
const passwordSaving = ref(false)
const webhookSaving = ref(false)
const profileModalOpen = ref(false)
const passwordModalOpen = ref(false)
const emailModalOpen = ref(false)
const webhookModalOpen = ref(false)
const browserModalOpen = ref(false)
const logoutConfirmOpen = ref(false)
const browserPermission = ref<BrowserPermissionState>('default')
const browserPermissionSaving = ref(false)
const logoutSubmitting = ref(false)
const profileServerError = ref('')
const passwordServerError = ref('')
const emailServerError = ref('')
const emailFieldError = ref('')
const webhookServerError = ref('')
const webhookFieldError = ref('')

const profileFirstFieldRef = ref<HTMLInputElement | null>(null)
const passwordFirstFieldRef = ref<HTMLInputElement | null>(null)
const emailFirstFieldRef = ref<HTMLInputElement | null>(null)
const webhookFirstFieldRef = ref<HTMLInputElement | null>(null)
const browserFirstFieldRef = ref<HTMLButtonElement | null>(null)
const logoutConfirmButtonRef = ref<HTMLButtonElement | null>(null)

const settingForm = reactive({
  emailEnabled: false,
  emailAddress: '',
  webhookEnabled: false,
  webhookUrl: '',
  browserEnabled: true,
})
const webhookDraft = reactive({
  url: '',
})
const emailDraft = reactive({
  address: '',
})

const profileForm = reactive({
  username: '',
  nickname: '',
  avatar: '',
})

const profileDraft = reactive({
  username: '',
  nickname: '',
  avatar: '',
})

const passwordForm = reactive({
  oldPassword: '',
  password: '',
  confirmPassword: '',
})

const profileFieldErrors = reactive({
  username: '',
  avatar: '',
})

const passwordFieldErrors = reactive({
  oldPassword: '',
  password: '',
  confirmPassword: '',
})

const { logout } = useAuth()
const message = useMessage()

const profileDisplayName = computed(() => {
  return profileForm.nickname.trim() || profileForm.username.trim() || '-'
})

const profileAvatar = computed(() => {
  const avatar = profileForm.avatar.trim()
  return avatar.length > 0 ? avatar : ''
})

const profileInitial = computed(() => {
  const displayName = profileDisplayName.value.trim()
  if (!displayName || displayName === '-') {
    return 'U'
  }

  return displayName[0]?.toUpperCase() ?? 'U'
})

const activePanel = computed<PanelType>(() => {
  if (activeTab.value === 'appearance') {
    return 'appearance'
  }

  if (activeTab.value === 'notifications') {
    return 'notifications'
  }

  return 'account'
})

const browserPermissionLabel = computed(() => {
  if (browserPermission.value === 'granted') {
    return '已授权'
  }

  if (browserPermission.value === 'denied') {
    return '已拒绝'
  }

  if (browserPermission.value === 'unsupported') {
    return '当前浏览器不支持'
  }

  return '未设置'
})

watch(
  () => props.externalTab,
  (externalTab) => {
    activeTab.value = externalTab ?? 'profile'
  },
  { immediate: true },
)

watch(activePanel, () => {
  closeProfileModal()
  closePasswordModal()
  closeEmailModal()
  closeWebhookModal()
  closeBrowserModal()
  closeLogoutConfirm()
})

watch(profileModalOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  profileFirstFieldRef.value?.focus()
})

watch(passwordModalOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  passwordFirstFieldRef.value?.focus()
})

watch(emailModalOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  emailFirstFieldRef.value?.focus()
})

watch(webhookModalOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  webhookFirstFieldRef.value?.focus()
})

watch(browserModalOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  browserFirstFieldRef.value?.focus()
})

watch(logoutConfirmOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  logoutConfirmButtonRef.value?.focus()
})

const applyLocaleSetting = (nextLocale: UiLocale) => {
  locale.value = nextLocale
  storage.set(STORAGE_KEYS.locale, nextLocale)
  applyUiLocale(nextLocale)
}

const applyThemeColorSetting = (nextThemeColor: ThemeColor) => {
  themeColor.value = nextThemeColor
  storage.set(STORAGE_KEYS.themeColor, nextThemeColor)
  applyThemeColor(nextThemeColor)
}

const applyAppearanceSetting = (nextAppearanceMode: AppearanceMode) => {
  appearanceMode.value = nextAppearanceMode
  storage.set(STORAGE_KEYS.theme, nextAppearanceMode)
  applyAppearanceMode(nextAppearanceMode)
}

const applyBackgroundStyleSetting = (nextBackgroundStyle: BackgroundStyle) => {
  backgroundStyle.value = nextBackgroundStyle
  storage.set(STORAGE_KEYS.backgroundStyle, nextBackgroundStyle)
  applyBackgroundStyle(nextBackgroundStyle)
}

const optionButtonClass = (active: boolean) => {
  return active
    ? 'border-primary bg-primary text-primary-foreground'
    : 'border-border bg-background text-foreground hover:shadow-md'
}

const clearProfileErrors = () => {
  profileFieldErrors.username = ''
  profileFieldErrors.avatar = ''
  profileServerError.value = ''
}

const clearPasswordErrors = () => {
  passwordFieldErrors.oldPassword = ''
  passwordFieldErrors.password = ''
  passwordFieldErrors.confirmPassword = ''
  passwordServerError.value = ''
}

const clearWebhookErrors = () => {
  webhookServerError.value = ''
  webhookFieldError.value = ''
}

const clearEmailErrors = () => {
  emailServerError.value = ''
  emailFieldError.value = ''
}

const detectBrowserPermission = (): BrowserPermissionState => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const isValidUrl = (url: string) => {
  try {
    const normalized = new URL(url)
    return normalized.protocol === 'http:' || normalized.protocol === 'https:'
  } catch {
    return false
  }
}

const syncSettingForm = (setting: NotificationSetting) => {
  settingForm.emailEnabled = setting.emailEnabled
  settingForm.emailAddress = setting.emailAddress ?? ''
  settingForm.webhookEnabled = setting.webhookEnabled
  settingForm.webhookUrl = setting.webhookUrl ?? ''
  settingForm.browserEnabled = setting.browserEnabled
}

const syncWebhookDraftFromForm = () => {
  webhookDraft.url = settingForm.webhookUrl
}

const syncEmailDraftFromForm = () => {
  emailDraft.address = settingForm.emailAddress
}

const syncProfileForm = (profile: UserInfo) => {
  profileForm.username = profile.username ?? ''
  profileForm.nickname = profile.nickname ?? ''
  profileForm.avatar = profile.avatar ?? ''
}

const syncProfileDraftFromProfile = () => {
  profileDraft.username = profileForm.username
  profileDraft.nickname = profileForm.nickname
  profileDraft.avatar = profileForm.avatar
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

const openProfileModal = () => {
  clearProfileErrors()
  syncProfileDraftFromProfile()
  profileModalOpen.value = true
}

const closeProfileModal = () => {
  profileModalOpen.value = false
  clearProfileErrors()
}

const openPasswordModal = () => {
  clearPasswordErrors()
  clearPasswordForm()
  passwordModalOpen.value = true
}

const closePasswordModal = () => {
  passwordModalOpen.value = false
  clearPasswordErrors()
  clearPasswordForm()
}

const openWebhookModal = () => {
  clearWebhookErrors()
  syncWebhookDraftFromForm()
  webhookModalOpen.value = true
}

const closeWebhookModal = () => {
  webhookModalOpen.value = false
  clearWebhookErrors()
}

const openEmailModal = () => {
  clearEmailErrors()
  syncEmailDraftFromForm()
  emailModalOpen.value = true
}

const closeEmailModal = () => {
  emailModalOpen.value = false
  clearEmailErrors()
}

const openBrowserModal = () => {
  browserPermission.value = detectBrowserPermission()
  browserModalOpen.value = true
}

const closeBrowserModal = () => {
  browserModalOpen.value = false
}

const openLogoutConfirm = () => {
  logoutConfirmOpen.value = true
}

const closeLogoutConfirm = () => {
  if (logoutSubmitting.value) {
    return
  }

  logoutConfirmOpen.value = false
}

const loadPageData = async () => {
  loading.value = true

  try {
    const [profileResponse, settingResponse] = await Promise.all([
      authApi.me(),
      notificationsApi.setting(),
    ])

    syncProfileForm(profileResponse)
    syncSettingForm(settingResponse)
  } catch (error) {
    message.error(toErrorMessage(error, '加载设置失败'))
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  clearProfileErrors()

  const username = profileDraft.username.trim()
  const avatar = profileDraft.avatar.trim()

  let hasError = false

  if (!username) {
    profileFieldErrors.username = '用户名不能为空'
    hasError = true
  }

  if (avatar && !isValidUrl(avatar)) {
    profileFieldErrors.avatar = '头像链接需为 http(s) 地址'
    hasError = true
  }

  if (hasError) {
    return
  }

  profileSaving.value = true

  try {
    const updatedProfile = await authApi.updateMe({
      username,
      nickname: normalizeOptionalText(profileDraft.nickname),
      avatar: normalizeOptionalText(profileDraft.avatar),
    })

    syncProfileForm(updatedProfile)
    userStore.setProfile(userStore.mapUserToProfile(updatedProfile))
    profileModalOpen.value = false
    message.success('个人资料已更新')
  } catch (error) {
    profileServerError.value = toErrorMessage(error, '保存个人资料失败')
  } finally {
    profileSaving.value = false
  }
}

const savePassword = async () => {
  clearPasswordErrors()

  const oldPassword = passwordForm.oldPassword.trim()
  const newPassword = passwordForm.password.trim()
  const confirmPassword = passwordForm.confirmPassword.trim()

  let hasError = false

  if (!oldPassword) {
    passwordFieldErrors.oldPassword = '请输入当前密码'
    hasError = true
  }

  if (!newPassword) {
    passwordFieldErrors.password = '请输入新密码'
    hasError = true
  } else if (newPassword.length < 6) {
    passwordFieldErrors.password = '新密码至少 6 位'
    hasError = true
  }

  if (!confirmPassword) {
    passwordFieldErrors.confirmPassword = '请再次输入新密码'
    hasError = true
  } else if (newPassword && newPassword !== confirmPassword) {
    passwordFieldErrors.confirmPassword = '两次输入的新密码不一致'
    hasError = true
  }

  if (hasError) {
    return
  }

  passwordSaving.value = true

  try {
    const updatedProfile = await authApi.updateMe({
      oldPassword,
      password: newPassword,
    })

    syncProfileForm(updatedProfile)
    userStore.setProfile(userStore.mapUserToProfile(updatedProfile))
    closePasswordModal()
    message.success('密码已更新')
  } catch (error) {
    passwordServerError.value = toErrorMessage(error, '修改密码失败')
  } finally {
    passwordSaving.value = false
  }
}

const persistNotificationSetting = async (options?: {
  skipWebhookValidation?: boolean
  skipEmailValidation?: boolean
  successMessage?: string
}) => {
  const normalizedEmailAddress = settingForm.emailAddress.trim()
  const normalizedWebhookUrl = settingForm.webhookUrl.trim()
  if (!options?.skipEmailValidation && settingForm.emailEnabled && !normalizedEmailAddress) {
    message.error('邮件通知已启用，请先填写通知邮箱')
    return false
  }

  if (!options?.skipEmailValidation && normalizedEmailAddress && !isValidEmail(normalizedEmailAddress)) {
    message.error('通知邮箱格式不正确')
    return false
  }

  if (!options?.skipWebhookValidation && settingForm.webhookEnabled && !normalizedWebhookUrl) {
    message.error('Webhook 已启用，请先通过“配置 Webhook”填写回调地址')
    return false
  }

  if (!options?.skipWebhookValidation && settingForm.webhookEnabled && !isValidUrl(normalizedWebhookUrl)) {
    message.error('Webhook 地址需为 http(s) 链接')
    return false
  }

  notificationSaving.value = true

  try {
    const setting = await notificationsApi.updateSetting({
      emailEnabled: settingForm.emailEnabled,
      emailAddress: normalizedEmailAddress || null,
      webhookEnabled: settingForm.webhookEnabled,
      webhookUrl: normalizedWebhookUrl || null,
      browserEnabled: settingForm.browserEnabled,
    })

    syncSettingForm(setting)
    message.success(options?.successMessage ?? '通知渠道已更新')
    return true
  } catch (error) {
    message.error(toErrorMessage(error, '保存通知渠道失败'))
    return false
  } finally {
    notificationSaving.value = false
  }
}

const toggleEmailNotification = async () => {
  const previousValue = !settingForm.emailEnabled
  if (settingForm.emailEnabled && !settingForm.emailAddress.trim()) {
    settingForm.emailEnabled = false
    openEmailModal()
    message.warning('请先在弹窗中填写通知邮箱，再启用邮件通知')
    return
  }

  const isSaved = await persistNotificationSetting({
    skipWebhookValidation: true,
    successMessage: '邮件通知已更新',
  })

  if (!isSaved) {
    settingForm.emailEnabled = previousValue
  }
}

const toggleBrowserNotification = async () => {
  const previousValue = !settingForm.browserEnabled
  const isSaved = await persistNotificationSetting({
    skipEmailValidation: true,
    skipWebhookValidation: true,
    successMessage: '浏览器通知已更新',
  })

  if (!isSaved) {
    settingForm.browserEnabled = previousValue
  }
}

const toggleWebhookNotification = async () => {
  const previousValue = !settingForm.webhookEnabled
  if (settingForm.webhookEnabled && !settingForm.webhookUrl.trim()) {
    settingForm.webhookEnabled = false
    openWebhookModal()
    message.warning('请先在弹窗中填写 Webhook 地址，再启用通知')
    return
  }

  const isSaved = await persistNotificationSetting({
    skipEmailValidation: true,
    skipWebhookValidation: false,
    successMessage: 'Webhook 通知状态已更新',
  })

  if (!isSaved) {
    settingForm.webhookEnabled = previousValue
  }
}

const saveWebhookSetting = async () => {
  clearWebhookErrors()

  const normalizedWebhookUrl = webhookDraft.url.trim()
  if (settingForm.webhookEnabled && !normalizedWebhookUrl) {
    webhookFieldError.value = '启用 Webhook 时必须填写回调地址'
    return
  }

  if (normalizedWebhookUrl && !isValidUrl(normalizedWebhookUrl)) {
    webhookFieldError.value = 'Webhook 地址需为 http(s) 链接'
    return
  }

  webhookSaving.value = true

  try {
    const setting = await notificationsApi.updateSetting({
      emailEnabled: settingForm.emailEnabled,
      emailAddress: settingForm.emailAddress.trim() || null,
      webhookEnabled: settingForm.webhookEnabled,
      webhookUrl: normalizedWebhookUrl || null,
      browserEnabled: settingForm.browserEnabled,
    })

    syncSettingForm(setting)
    closeWebhookModal()
    message.success('Webhook 设置已更新')
  } catch (error) {
    webhookServerError.value = toErrorMessage(error, '保存 Webhook 设置失败')
  } finally {
    webhookSaving.value = false
  }
}

const saveEmailAddress = async () => {
  clearEmailErrors()
  const normalizedEmailAddress = emailDraft.address.trim()

  if (!normalizedEmailAddress) {
    emailFieldError.value = '通知邮箱不能为空'
    return
  }

  if (!isValidEmail(normalizedEmailAddress)) {
    emailFieldError.value = '通知邮箱格式不正确'
    return
  }

  notificationSaving.value = true

  try {
    const setting = await notificationsApi.updateSetting({
      emailEnabled: settingForm.emailEnabled,
      emailAddress: normalizedEmailAddress,
      webhookEnabled: settingForm.webhookEnabled,
      webhookUrl: settingForm.webhookUrl.trim() || null,
      browserEnabled: settingForm.browserEnabled,
    })
    syncSettingForm(setting)
    closeEmailModal()
    message.success('通知邮箱已更新')
  } catch (error) {
    emailServerError.value = toErrorMessage(error, '保存通知邮箱失败')
    return
  } finally {
    notificationSaving.value = false
  }
}

const requestBrowserNotificationPermission = async () => {
  if (browserPermission.value === 'unsupported' || typeof window === 'undefined' || !('Notification' in window)) {
    return
  }

  browserPermissionSaving.value = true

  try {
    const permission = await Notification.requestPermission()
    browserPermission.value = permission
  } finally {
    browserPermissionSaving.value = false
  }
}

const onLogout = async () => {
  openLogoutConfirm()
}

const confirmLogout = async () => {
  logoutSubmitting.value = true
  try {
    await logout()
  } finally {
    logoutSubmitting.value = false
    logoutConfirmOpen.value = false
    await router.push('/login')
  }
}

onMounted(() => {
  const storedPreferences = loadUiPreferencesFromStorage()
  applyLocaleSetting(storedPreferences.locale)
  applyAppearanceSetting(storedPreferences.appearanceMode)
  applyThemeColorSetting(storedPreferences.themeColor)
  applyBackgroundStyleSetting(storedPreferences.backgroundStyle)
  browserPermission.value = detectBrowserPermission()

  void loadPageData()
})
</script>

<template>
  <div class="fade-up space-y-4">
    <section class="space-y-4">
      <section v-if="activePanel === 'account'" class="space-y-4">
        <article class="rounded-xl border border-border bg-card/40 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">个人资料</p>
              <p class="mt-1 text-xs text-muted-foreground">查看账号信息，并通过弹窗更新资料或密码。</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:shadow-sm"
                type="button"
                @click="openProfileModal"
              >
                编辑资料
              </button>
              <button
                class="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:shadow-sm"
                type="button"
                @click="openPasswordModal"
              >
                修改密码
              </button>
            </div>
          </div>

          <div class="mt-4 flex items-start gap-3">
            <div class="relative h-12 w-12 overflow-hidden rounded-full border border-border bg-muted">
              <img v-if="profileAvatar" :src="profileAvatar" alt="用户头像" class="h-full w-full object-cover" />
              <span v-else class="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                {{ profileInitial }}
              </span>
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <dl class="grid grid-cols-[72px_1fr] items-center gap-y-1 text-xs">
                <dt class="text-muted-foreground">昵称</dt>
                <dd class="truncate text-foreground">{{ profileDisplayName }}</dd>
                <dt class="text-muted-foreground">用户名</dt>
                <dd class="truncate text-foreground">{{ profileForm.username || '-' }}</dd>
              </dl>
            </div>
          </div>
        </article>

        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">账号与会话</p>
          <p class="mt-1 text-xs text-muted-foreground">退出登录不会删除数据。</p>
          <div class="mt-3">
            <button
              class="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="onLogout"
            >
              退出登录
            </button>
          </div>
        </article>
      </section>

      <section v-else-if="activePanel === 'appearance'" class="space-y-3">
        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">语言</p>
          <p class="mt-2 text-xs text-muted-foreground">仅切换界面语言偏好，当前支持中英两种语言。</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="option in LANGUAGE_OPTIONS"
              :key="option.value"
              class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
              :class="optionButtonClass(locale === option.value)"
              type="button"
              @click="applyLocaleSetting(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </article>

        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">主题色</p>
          <p class="mt-2 text-xs text-muted-foreground">调整全局强调色与交互高亮风格。</p>
          <div class="mt-4 flex flex-wrap gap-4">
            <button
              v-for="option in THEME_COLOR_OPTIONS"
              :key="option.value"
              class="group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition"
              :class="
                themeColor === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background text-foreground hover:shadow-sm'
              "
              type="button"
              @click="applyThemeColorSetting(option.value)"
            >
              <span
                class="h-3.5 w-3.5 rounded-full"
                :class="
                  option.value === 'amber'
                    ? 'bg-amber-500'
                    : option.value === 'ocean'
                      ? 'bg-sky-500'
                      : 'bg-emerald-500'
                "
              />
              {{ option.label }}
            </button>
          </div>
        </article>

        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">外观</p>
          <p class="mt-2 text-xs text-muted-foreground">选择浅色或深色模式。</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              v-for="option in APPEARANCE_OPTIONS"
              :key="option.value"
              class="group flex flex-col items-center gap-2 rounded-lg border p-2 transition"
              :class="
                appearanceMode === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/40'
              "
              type="button"
              @click="applyAppearanceSetting(option.value)"
            >
              <div
                class="flex h-16 w-24 items-center justify-center rounded-md border"
                :class="option.value === 'light' ? 'border-gray-200 bg-white' : 'border-gray-700 bg-slate-900'"
              >
                <div
                  class="h-9 w-16 rounded border"
                  :class="option.value === 'light' ? 'border-gray-300 bg-gray-100' : 'border-gray-600 bg-slate-800'"
                />
              </div>
              <span
                class="text-xs"
                :class="appearanceMode === option.value ? 'font-semibold text-foreground' : 'text-muted-foreground'"
              >
                {{ option.label }}
              </span>
            </button>
          </div>
        </article>

        <article class="rounded-xl border border-border bg-card/40 p-4">
          <p class="text-sm font-semibold">背景风格</p>
          <p class="mt-2 text-xs text-muted-foreground">调整工作区背景纹理，减少视觉疲劳。</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              v-for="option in BACKGROUND_STYLE_OPTIONS"
              :key="option.value"
              class="group flex flex-col items-center gap-2 rounded-lg border p-2 transition"
              :class="
                backgroundStyle === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/40'
              "
              type="button"
              @click="applyBackgroundStyleSetting(option.value)"
            >
              <div
                class="h-16 w-24 rounded-md border"
                :class="
                  option.value === 'grid'
                    ? 'border-slate-200 bg-[linear-gradient(0deg,rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.1)_1px,transparent_1px)] bg-[size:12px_12px]'
                    : option.value === 'plain'
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-violet-200 bg-gradient-to-br from-fuchsia-50 to-violet-100'
                "
              />
              <span
                class="text-xs"
                :class="backgroundStyle === option.value ? 'font-semibold text-foreground' : 'text-muted-foreground'"
              >
                {{ option.label }}
              </span>
            </button>
          </div>
        </article>
      </section>

      <section v-else class="space-y-3">
        <div v-if="loading" class="text-xs text-muted-foreground">加载中...</div>

        <template v-else>
          <article class="rounded-xl border border-border bg-card/40 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">邮件通知</p>
                <p class="mt-1 text-xs text-muted-foreground">任务状态和关键事件通过邮件发送到你配置的通知邮箱。</p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="notificationSaving"
                  type="button"
                  @click="openEmailModal"
                >
                  编辑
                </button>
                <label
                  class="inline-flex items-center"
                  :class="notificationSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
                >
                  <input
                    v-model="settingForm.emailEnabled"
                    aria-label="切换邮件通知"
                    class="peer sr-only"
                    :disabled="notificationSaving"
                    type="checkbox"
                    @change="toggleEmailNotification"
                  />
                  <span
                    class="relative h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
                  />
                </label>
              </div>
            </div>

            <dl class="mt-4 grid grid-cols-[72px_1fr] items-start gap-y-2 text-xs">
              <dt class="text-muted-foreground">投递邮箱</dt>
              <dd class="break-all text-foreground">{{ settingForm.emailAddress || '未设置邮箱' }}</dd>
            </dl>
          </article>

          <article class="rounded-xl border border-border bg-card/40 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">浏览器通知</p>
                <p class="mt-1 text-xs text-muted-foreground">在浏览器中接收系统提醒，可在弹窗内检查授权状态。</p>
              </div>

              <div class="flex items-center">
                <label
                  class="inline-flex items-center"
                  :class="notificationSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
                >
                  <input
                    v-model="settingForm.browserEnabled"
                    aria-label="切换浏览器通知"
                    class="peer sr-only"
                    :disabled="notificationSaving"
                    type="checkbox"
                    @change="toggleBrowserNotification"
                  />
                  <span
                    class="relative h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
                  />
                </label>
              </div>
            </div>
          </article>

          <article class="rounded-xl border border-border bg-card/40 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">Webhook 通知</p>
                <p class="mt-1 text-xs text-muted-foreground">通过回调地址接收系统事件，配置与保存在弹窗中完成。</p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  class="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:shadow-sm"
                  type="button"
                  @click="openWebhookModal"
                >
                  编辑
                </button>
                <label
                  class="inline-flex items-center"
                  :class="notificationSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
                >
                  <input
                    v-model="settingForm.webhookEnabled"
                    aria-label="切换 Webhook 通知"
                    class="peer sr-only"
                    :disabled="notificationSaving"
                    type="checkbox"
                    @change="toggleWebhookNotification"
                  />
                  <span
                    class="relative h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
                  />
                </label>
              </div>
            </div>

            <dl class="mt-4 grid grid-cols-[72px_1fr] items-start gap-y-2 text-xs">
              <dt class="text-muted-foreground">回调地址</dt>
              <dd class="break-all text-foreground">{{ settingForm.webhookUrl || '-' }}</dd>
            </dl>
          </article>
        </template>
      </section>
    </section>
  </div>

  <Teleport to="body">
    <div
      v-if="profileModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="closeProfileModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="closeProfileModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(560px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">编辑个人资料</h3>
          <button
            aria-label="关闭编辑个人资料弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="closeProfileModal"
          >
            ×
          </button>
        </div>

        <form class="mt-4 flex max-h-[calc(85vh-6rem)] flex-col" @submit.prevent="saveProfile">
          <div class="space-y-3 overflow-y-auto pr-1">
            <p v-if="profileServerError" class="text-sm text-destructive">{{ profileServerError }}</p>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">用户名</span>
              <input
                ref="profileFirstFieldRef"
                v-model="profileDraft.username"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="profileFieldErrors.username ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="text"
              />
              <p v-if="profileFieldErrors.username" class="text-xs text-destructive">{{ profileFieldErrors.username }}</p>
            </label>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">昵称</span>
              <input
                v-model="profileDraft.nickname"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                type="text"
              />
            </label>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">头像链接</span>
              <input
                v-model="profileDraft.avatar"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="profileFieldErrors.avatar ? 'border-destructive ring-1 ring-destructive/20' : ''"
                placeholder="https://example.com/avatar.png"
                type="text"
              />
              <p v-if="profileFieldErrors.avatar" class="text-xs text-destructive">{{ profileFieldErrors.avatar }}</p>
            </label>
          </div>

          <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="closeProfileModal"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="profileSaving"
              type="submit"
            >
              {{ profileSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="passwordModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="closePasswordModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="closePasswordModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(520px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">修改密码</h3>
          <button
            aria-label="关闭修改密码弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="closePasswordModal"
          >
            ×
          </button>
        </div>

        <form class="mt-4 flex max-h-[calc(85vh-6rem)] flex-col" @submit.prevent="savePassword">
          <div class="space-y-3 overflow-y-auto pr-1">
            <p v-if="passwordServerError" class="text-sm text-destructive">{{ passwordServerError }}</p>

            <label class="block space-y-1">
              <span class="text-xs text-muted-foreground">当前密码</span>
              <input
                ref="passwordFirstFieldRef"
                v-model="passwordForm.oldPassword"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="passwordFieldErrors.oldPassword ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="password"
              />
              <p v-if="passwordFieldErrors.oldPassword" class="text-xs text-destructive">{{ passwordFieldErrors.oldPassword }}</p>
            </label>

            <label class="block space-y-1">
              <span class="text-xs text-muted-foreground">新密码</span>
              <input
                v-model="passwordForm.password"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="passwordFieldErrors.password ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="password"
              />
              <p v-if="passwordFieldErrors.password" class="text-xs text-destructive">{{ passwordFieldErrors.password }}</p>
            </label>

            <label class="block space-y-1">
              <span class="text-xs text-muted-foreground">确认新密码</span>
              <input
                v-model="passwordForm.confirmPassword"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="passwordFieldErrors.confirmPassword ? 'border-destructive ring-1 ring-destructive/20' : ''"
                type="password"
              />
              <p v-if="passwordFieldErrors.confirmPassword" class="text-xs text-destructive">{{ passwordFieldErrors.confirmPassword }}</p>
            </label>
          </div>

          <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="closePasswordModal"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="passwordSaving"
              type="submit"
            >
              {{ passwordSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="emailModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="closeEmailModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="closeEmailModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(520px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">编辑通知邮箱</h3>
          <button
            aria-label="关闭通知邮箱弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="closeEmailModal"
          >
            ×
          </button>
        </div>

        <form class="mt-4 flex max-h-[calc(85vh-6rem)] flex-col" @submit.prevent="saveEmailAddress">
          <div class="space-y-3 overflow-y-auto pr-1">
            <p v-if="emailServerError" class="text-sm text-destructive">{{ emailServerError }}</p>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">通知邮箱</span>
              <input
                ref="emailFirstFieldRef"
                v-model="emailDraft.address"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="emailFieldError ? 'border-destructive ring-1 ring-destructive/20' : ''"
                placeholder="user@example.com"
                type="email"
              />
              <p v-if="emailFieldError" class="text-xs text-destructive">{{ emailFieldError }}</p>
            </label>

            <p class="text-xs text-muted-foreground">开启邮件通知时，该邮箱将作为唯一投递地址。</p>
          </div>

          <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="closeEmailModal"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="notificationSaving"
              type="submit"
            >
              {{ notificationSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="logoutConfirmOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="closeLogoutConfirm"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="closeLogoutConfirm" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(440px,96vw)] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="space-y-2">
          <h3 class="text-base font-semibold">确认退出登录</h3>
          <p class="text-sm text-muted-foreground">退出后将返回登录页。</p>
        </div>

        <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <button
            class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="logoutSubmitting"
            type="button"
            @click="closeLogoutConfirm"
          >
            取消
          </button>
          <button
            ref="logoutConfirmButtonRef"
            class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="logoutSubmitting"
            type="button"
            @click="confirmLogout"
          >
            {{ logoutSubmitting ? '退出中...' : '确认退出' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="browserModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="closeBrowserModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="closeBrowserModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(480px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">浏览器通知设置</h3>
          <button
            aria-label="关闭浏览器通知设置弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="closeBrowserModal"
          >
            ×
          </button>
        </div>

        <div class="mt-4 space-y-3">
          <div class="rounded-lg border border-border bg-card/40 p-3">
            <p class="text-sm font-medium">当前权限状态</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ browserPermissionLabel }}</p>
          </div>

          <p class="text-xs text-muted-foreground">
            {{ browserPermission === 'denied' ? '你已拒绝通知权限，请在浏览器站点设置中手动开启。' : '点击下方按钮可重新请求浏览器通知权限。' }}
          </p>
        </div>

        <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <button
            class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="closeBrowserModal"
          >
            关闭
          </button>
          <button
            ref="browserFirstFieldRef"
            class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="browserPermissionSaving || browserPermission === 'unsupported'"
            type="button"
            @click="requestBrowserNotificationPermission"
          >
            {{ browserPermissionSaving ? '请求中...' : '请求权限' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="webhookModalOpen"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      @keydown.esc.prevent.stop="closeWebhookModal"
    >
      <button class="absolute inset-0 bg-black/45" type="button" @click="closeWebhookModal" />
      <section
        aria-modal="true"
        class="relative z-10 w-[min(520px,96vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xl"
        role="dialog"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">配置 Webhook</h3>
          <button
            aria-label="关闭 Webhook 配置弹窗"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
            type="button"
            @click="closeWebhookModal"
          >
            ×
          </button>
        </div>

        <form class="mt-4 flex max-h-[calc(85vh-6rem)] flex-col" @submit.prevent="saveWebhookSetting">
          <div class="space-y-3 overflow-y-auto pr-1">
            <p v-if="webhookServerError" class="text-sm text-destructive">{{ webhookServerError }}</p>

            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">Webhook 地址</span>
              <input
                ref="webhookFirstFieldRef"
                v-model="webhookDraft.url"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                :class="webhookFieldError ? 'border-destructive ring-1 ring-destructive/20' : ''"
                placeholder="https://example.com/hook"
                type="text"
              />
              <p v-if="webhookFieldError" class="text-xs text-destructive">{{ webhookFieldError }}</p>
            </label>
          </div>

          <div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button
              class="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="closeWebhookModal"
            >
              取消
            </button>
            <button
              class="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="webhookSaving"
              type="submit"
            >
              {{ webhookSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
