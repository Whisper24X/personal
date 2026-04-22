import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { notificationsApi } from '@/api/notifications'
import { useAuth } from '@app/composables/useAuth'
import { useMessage } from '@app/composables/useMessage'
import { useUserStore } from '@app/stores/modules/user'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import type { UserInfo } from '@/types/api/auth'
import type { NotificationSetting } from '@/types/api/notifications'
import { toErrorMessage } from '@api/shared/to-error-message'
import { storage } from '@shared/utils/storage'
import {
  applyAppearanceMode,
  applyBackgroundStyle,
  applyThemeColor,
  loadUiPreferencesFromStorage,
  type AppearanceMode,
  type BackgroundStyle,
  type ThemeColor,
} from '@shared/utils/ui-preferences'

export type PersonalSettingsTab = 'appearance' | 'profile' | 'security' | 'notifications'
export type PanelType = 'account' | 'appearance' | 'notifications'
type BrowserPermissionState = NotificationPermission | 'unsupported'

export type PersonalSettingsPanelProps = {
  externalTab?: PersonalSettingsTab
}

export type PersonalSettingsPanelContext = ReturnType<typeof usePersonalSettingsPanel>

export function usePersonalSettingsPanel(props: PersonalSettingsPanelProps) {
const router = useRouter()
const userStore = useUserStore()
const themeColor = ref<ThemeColor>('mono')
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
const webhookModalOpen = ref(false)
const logoutConfirmOpen = ref(false)
const browserPermission = ref<BrowserPermissionState>('default')
const browserPermissionSaving = ref(false)
const logoutSubmitting = ref(false)
const profileServerError = ref('')
const passwordServerError = ref('')
const webhookServerError = ref('')
const webhookFieldError = ref('')

const profileFirstFieldRef = ref<HTMLInputElement | null>(null)
const passwordFirstFieldRef = ref<HTMLInputElement | null>(null)
const webhookFirstFieldRef = ref<HTMLInputElement | null>(null)
const logoutConfirmButtonRef = ref<HTMLButtonElement | null>(null)

const settingForm = reactive({
  webhookEnabled: false,
  webhookUrl: '',
  webhookSecret: '',
  browserEnabled: true,
})
const webhookDraft = reactive({
  url: '',
  secret: '',
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

const browserPermissionBadgeClass = computed(() => {
  if (browserPermission.value === 'granted') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (browserPermission.value === 'denied') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  if (browserPermission.value === 'unsupported') {
    return 'border-slate-200 bg-slate-100 text-slate-600'
  }

  return 'border-amber-200 bg-amber-50 text-amber-700'
})

const browserNotificationHint = computed(() => {
  if (browserPermission.value === 'unsupported') {
    return '当前浏览器不支持系统通知，无法弹出任务提醒。'
  }

  if (browserPermission.value === 'denied') {
    return '浏览器权限已被拒绝，即使开关已打开，也不会弹出系统通知。'
  }

  if (settingForm.browserEnabled && browserPermission.value === 'granted') {
    return '浏览器通知已开启且当前浏览器已授权，任务进入待完成或已完成时应能收到提醒。'
  }

  if (settingForm.browserEnabled) {
    return '服务端通知开关已打开，但当前浏览器尚未授权，因此不会弹出系统通知。'
  }

  if (browserPermission.value === 'granted') {
    return '当前浏览器已授权，但服务端通知开关尚未开启。'
  }

  return '浏览器通知尚未授权，开启时会先尝试请求浏览器权限。'
})

watch(
  () => props.externalTab,
  (externalTab) => {
    activeTab.value = externalTab ?? 'profile'
  },
  { immediate: true },
)

watch(activePanel, (panel) => {
  closeProfileModal()
  closePasswordModal()
  closeWebhookModal()
  closeLogoutConfirm()

  if (panel === 'notifications') {
    browserPermission.value = detectBrowserPermission()
  }
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

watch(webhookModalOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  webhookFirstFieldRef.value?.focus()
})

watch(logoutConfirmOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  logoutConfirmButtonRef.value?.focus()
})

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

const detectBrowserPermission = (): BrowserPermissionState => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

const refreshBrowserPermission = (): BrowserPermissionState => {
  const permission = detectBrowserPermission()
  browserPermission.value = permission
  return permission
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
  settingForm.webhookEnabled = setting.webhookEnabled
  settingForm.webhookUrl = setting.webhookUrl ?? ''
  settingForm.webhookSecret = setting.webhookSecret ?? ''
  settingForm.browserEnabled = setting.browserEnabled
}

const syncWebhookDraftFromForm = () => {
  webhookDraft.url = settingForm.webhookUrl
  webhookDraft.secret = settingForm.webhookSecret
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
  successMessage?: string
}) => {
  const normalizedWebhookUrl = settingForm.webhookUrl.trim()

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
      webhookEnabled: settingForm.webhookEnabled,
      webhookUrl: normalizedWebhookUrl || null,
      webhookSecret: settingForm.webhookSecret.trim() || null,
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

const toggleBrowserNotification = async () => {
  const previousValue = !settingForm.browserEnabled

  if (settingForm.browserEnabled) {
    const canEnable = await ensureBrowserNotificationPermission()
    if (!canEnable) {
      settingForm.browserEnabled = previousValue
      return
    }
  }

  const isSaved = await persistNotificationSetting({
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
      webhookEnabled: settingForm.webhookEnabled,
      webhookUrl: normalizedWebhookUrl || null,
      webhookSecret: webhookDraft.secret.trim() || null,
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

const requestBrowserNotificationPermission = async (options?: {
  silent?: boolean
}) => {
  if (refreshBrowserPermission() === 'unsupported' || typeof window === 'undefined' || !('Notification' in window)) {
    if (!options?.silent) {
      message.error('当前浏览器不支持系统通知')
    }

    return 'unsupported' as const
  }

  browserPermissionSaving.value = true

  try {
    const permission = await Notification.requestPermission()
    browserPermission.value = permission

    if (!options?.silent) {
      if (permission === 'granted') {
        message.success('浏览器通知已授权')
      } else if (permission === 'denied') {
        message.warning('浏览器通知权限已被拒绝，请在浏览器站点设置中手动开启。')
      } else {
        message.info('浏览器通知仍未授权')
      }
    }

    return permission
  } catch (error) {
    const fallbackMessage =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : '请求浏览器通知权限失败'

    if (!options?.silent) {
      message.error(fallbackMessage)
    }

    return refreshBrowserPermission()
  } finally {
    browserPermissionSaving.value = false
  }
}

const handleBrowserPermissionCheck = async () => {
  const currentPermission = refreshBrowserPermission()

  if (currentPermission === 'granted') {
    message.success('浏览器通知已授权')
    return
  }

  if (currentPermission === 'unsupported') {
    message.error('当前浏览器不支持系统通知')
    return
  }

  if (currentPermission === 'denied') {
    message.warning('浏览器通知权限已被拒绝，请在浏览器站点设置中手动开启。')
    return
  }

  await requestBrowserNotificationPermission()
}

const ensureBrowserNotificationPermission = async () => {
  const currentPermission = refreshBrowserPermission()

  if (currentPermission === 'granted') {
    return true
  }

  if (currentPermission === 'unsupported') {
    message.error('当前浏览器不支持系统通知')
    return false
  }

  if (currentPermission === 'denied') {
    message.warning('浏览器通知权限已被拒绝，请在浏览器站点设置中手动开启。')
    return false
  }

  const nextPermission = await requestBrowserNotificationPermission({
    silent: true,
  })

  if (nextPermission === 'granted') {
    message.success('浏览器通知已授权')
    return true
  }

  if (nextPermission === 'unsupported') {
    message.error('当前浏览器不支持系统通知')
  } else if (nextPermission === 'denied') {
    message.warning('浏览器通知权限已被拒绝，请在浏览器站点设置中手动开启。')
  } else {
    message.info('浏览器通知尚未授权，暂时无法开启该渠道。')
  }

  return false
}

const sendTestBrowserNotification = async () => {
  const canNotify = await ensureBrowserNotificationPermission()

  if (!canNotify || typeof window === 'undefined' || !('Notification' in window)) {
    return
  }

  try {
    const notification = new Notification('葱搭 测试通知', {
      body: '如果你看到了这条消息，说明当前浏览器通知链路已就绪。',
      icon: '/logo.svg',
      tag: `ainative-notification-test-${Date.now()}`,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    message.success('测试通知已发送，请检查浏览器或系统通知中心。')
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : '浏览器通知发送失败'

    message.error(errorMessage)
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
  applyAppearanceSetting(storedPreferences.appearanceMode)
  applyThemeColorSetting(storedPreferences.themeColor)
  applyBackgroundStyleSetting(storedPreferences.backgroundStyle)
  browserPermission.value = detectBrowserPermission()

  void loadPageData()
})


  return reactive({
    activePanel,
    activeTab,
    appearanceMode,
    applyAppearanceSetting,
    applyBackgroundStyleSetting,
    applyThemeColorSetting,
    backgroundStyle,
    browserNotificationHint,
    browserPermission,
    browserPermissionBadgeClass,
    browserPermissionLabel,
    browserPermissionSaving,
    clearPasswordErrors,
    clearPasswordForm,
    clearProfileErrors,
    clearWebhookErrors,
    closeLogoutConfirm,
    closePasswordModal,
    closeProfileModal,
    closeWebhookModal,
    confirmLogout,
    detectBrowserPermission,
    ensureBrowserNotificationPermission,
    handleBrowserPermissionCheck,
    isValidUrl,
    loadPageData,
    loading,
    logout,
    logoutConfirmButtonRef,
    logoutConfirmOpen,
    logoutSubmitting,
    message,
    normalizeOptionalText,
    notificationSaving,
    onLogout,
    openLogoutConfirm,
    openPasswordModal,
    openProfileModal,
    openWebhookModal,
    passwordFieldErrors,
    passwordFirstFieldRef,
    passwordForm,
    passwordModalOpen,
    passwordSaving,
    passwordServerError,
    persistNotificationSetting,
    profileAvatar,
    profileDisplayName,
    profileDraft,
    profileFieldErrors,
    profileFirstFieldRef,
    profileForm,
    profileInitial,
    profileModalOpen,
    profileSaving,
    profileServerError,
    refreshBrowserPermission,
    requestBrowserNotificationPermission,
    router,
    savePassword,
    saveProfile,
    saveWebhookSetting,
    sendTestBrowserNotification,
    settingForm,
    syncProfileDraftFromProfile,
    syncProfileForm,
    syncSettingForm,
    syncWebhookDraftFromForm,
    themeColor,
    toggleBrowserNotification,
    toggleWebhookNotification,
    userStore,
    webhookDraft,
    webhookFieldError,
    webhookFirstFieldRef,
    webhookModalOpen,
    webhookSaving,
    webhookServerError,
  })
}
