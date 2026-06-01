import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { automationsApi } from '@/api/automations'
import { useAccessStore } from '@app/stores/modules/access'
import type {
  Automation,
  AutomationStatus,
  CreateAutomationPayload,
  UpdateAutomationPayload,
} from '@/types/api/automations'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { toErrorMessage } from '@api/shared/to-error-message'
import {
  AUTOMATION_PAGE_LIMIT,
  AUTOMATION_STATUS_FILTER_OPTIONS,
  AUTOMATION_WEEKDAY_OPTIONS,
  DEFAULT_AUTOMATION_TIME,
  DEFAULT_AUTOMATION_WEEKDAYS,
  type AutomationScheduleMode,
  type AutomationWeekday,
} from './automations-page.constants'

export type AutomationsPageContext = ReturnType<typeof useAutomationsPage>

export function useAutomationsPage() {
const route = useRoute()
const message = useMessage()
const accessStore = useAccessStore()

const automations = ref<Automation[]>([])
const automationLoading = ref(false)
const automationLoadingMore = ref(false)
const automationSubmitting = ref(false)
const automationDeletingId = ref('')
const automationDeleteModalOpen = ref(false)
const deletingAutomationTarget = ref<Automation | null>(null)
const automationEditingId = ref('')
const automationFormModalOpen = ref(false)
const automationKeyword = ref('')
const automationStatusFilter = ref<'all' | AutomationStatus>('all')
const automationPage = ref(1)
const automationHasNextPage = ref(false)
const validationMessage = ref('')
const automationScheduleMode = ref<AutomationScheduleMode>('daily')
const automationScheduleTime = ref(DEFAULT_AUTOMATION_TIME)
const automationScheduleDays = ref<AutomationWeekday[]>([...DEFAULT_AUTOMATION_WEEKDAYS])
const automationIntervalRrule = ref('')

const automationForm = reactive({
  name: '',
  prompt: '',
  rrule: '',
  cwdsText: '',
  status: 'active' as AutomationStatus,
})

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const resolveStoredProjectId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const activeProjectId = computed(() => {
  return normalizeRouteParam(route.query.projectId) || resolveStoredProjectId()
})

const hasProjectId = computed(() => Boolean(activeProjectId.value))
const canManageAutomations = computed(() => accessStore.hasCapability('project.automation.read'))
const totalAutomationCount = computed(() => automations.value.length)
const activeAutomationCount = computed(() => automations.value.filter((item) => item.status === 'active').length)
const pausedAutomationCount = computed(() => automations.value.filter((item) => item.status === 'paused').length)
const automationModalTitle = computed(() => (automationEditingId.value ? '编辑自动化计划' : '新建自动化计划'))
const automationModalSubmitLabel = computed(() => {
  if (automationSubmitting.value) {
    return automationEditingId.value ? '保存中...' : '创建中...'
  }

  return automationEditingId.value ? '保存修改' : '创建'
})
const resolvedAutomationRrule = computed(() => {
  if (automationScheduleMode.value === 'interval') {
    return automationIntervalRrule.value.trim()
  }

  return buildWeeklyRrule(automationScheduleDays.value, automationScheduleTime.value)
})

const automationStatusLabelMap: Record<AutomationStatus, string> = {
  active: '运行中',
  paused: '已暂停',
}

const automationStatusClassMap: Record<AutomationStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  paused: 'bg-muted text-muted-foreground',
}

const formatDate = (value?: string) => {
  if (!value) return '-'

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value

  return parsedDate.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const createDefaultAutomationWeekdays = () => [...DEFAULT_AUTOMATION_WEEKDAYS]

const isAutomationWeekday = (value: string): value is AutomationWeekday => {
  return AUTOMATION_WEEKDAY_OPTIONS.some((option) => option.value === value)
}

const normalizeScheduleTime = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    return DEFAULT_AUTOMATION_TIME
  }

  const hour = Number.parseInt(match[1] ?? '', 10)
  const minute = Number.parseInt(match[2] ?? '', 10)
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return DEFAULT_AUTOMATION_TIME
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const extractRrulePart = (rrule: string, key: string) => {
  const match = rrule.toUpperCase().match(new RegExp(`${key}=([^;]+)`))
  return match?.[1]?.trim() ?? ''
}

const buildWeeklyRrule = (days: AutomationWeekday[], time: string) => {
  const normalizedTime = normalizeScheduleTime(time)
  const [hourText, minuteText] = normalizedTime.split(':')
  const hour = Number.parseInt(hourText ?? '0', 10)
  const minute = Number.parseInt(minuteText ?? '0', 10)

  return `FREQ=WEEKLY;BYDAY=${days.join(',')};BYHOUR=${hour};BYMINUTE=${minute}`
}

const applyAutomationRruleToForm = (rrule: string) => {
  const normalizedRrule = rrule.trim()
  if (!normalizedRrule) {
    automationScheduleMode.value = 'daily'
    automationScheduleTime.value = DEFAULT_AUTOMATION_TIME
    automationScheduleDays.value = createDefaultAutomationWeekdays()
    automationIntervalRrule.value = ''
    return
  }

  const freq = extractRrulePart(normalizedRrule, 'FREQ')
  const byDay = extractRrulePart(normalizedRrule, 'BYDAY')
  const byHour = extractRrulePart(normalizedRrule, 'BYHOUR')
  const byMinute = extractRrulePart(normalizedRrule, 'BYMINUTE')

  const parsedDays = byDay
    .split(',')
    .map((item) => item.trim())
    .filter(isAutomationWeekday)
  const hasTime = byHour !== '' && byMinute !== ''

  if (hasTime && (parsedDays.length > 0 || freq === 'DAILY' || freq === 'WEEKLY')) {
    automationScheduleMode.value = 'daily'
    automationScheduleTime.value = normalizeScheduleTime(`${byHour.padStart(2, '0')}:${byMinute.padStart(2, '0')}`)
    automationScheduleDays.value = parsedDays.length > 0
      ? parsedDays
      : freq === 'DAILY'
        ? AUTOMATION_WEEKDAY_OPTIONS.map((item) => item.value)
        : createDefaultAutomationWeekdays()
    automationIntervalRrule.value = ''
    return
  }

  automationScheduleMode.value = 'interval'
  automationScheduleTime.value = DEFAULT_AUTOMATION_TIME
  automationScheduleDays.value = createDefaultAutomationWeekdays()
  automationIntervalRrule.value = normalizedRrule
}

const parseCwds = (value: string) => {
  if (!value.trim()) {
    return []
  }

  const parts = value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)

  return Array.from(new Set(parts))
}

const formatCwds = (cwds?: string[] | null) => {
  if (!cwds || cwds.length === 0) {
    return '默认工作目录'
  }

  return cwds.join('、')
}

const toggleAutomationScheduleDay = (day: AutomationWeekday) => {
  const nextDays = automationScheduleDays.value.includes(day)
    ? automationScheduleDays.value.filter((value) => value !== day)
    : [...automationScheduleDays.value, day]

  automationScheduleDays.value = AUTOMATION_WEEKDAY_OPTIONS
    .map((option) => option.value)
    .filter((value) => nextDays.includes(value))
}

const resetAutomationForm = () => {
  automationEditingId.value = ''
  automationForm.name = ''
  automationForm.prompt = ''
  automationForm.rrule = ''
  automationForm.cwdsText = ''
  automationForm.status = 'active'
  automationScheduleMode.value = 'daily'
  automationScheduleTime.value = DEFAULT_AUTOMATION_TIME
  automationScheduleDays.value = createDefaultAutomationWeekdays()
  automationIntervalRrule.value = ''
}

const openCreateAutomationModal = () => {
  resetAutomationForm()
  validationMessage.value = ''
  automationFormModalOpen.value = true
}

const closeAutomationFormModal = () => {
  automationFormModalOpen.value = false
  resetAutomationForm()
  validationMessage.value = ''
}

const startEditAutomation = (automation: Automation) => {
  automationEditingId.value = automation.id
  automationForm.name = automation.name
  automationForm.prompt = automation.prompt
  automationForm.rrule = automation.rrule
  automationForm.cwdsText = (automation.cwds ?? []).join(', ')
  automationForm.status = automation.status
  applyAutomationRruleToForm(automation.rrule)
  validationMessage.value = ''
  automationFormModalOpen.value = true
}

const resetAutomationList = () => {
  automations.value = []
  automationPage.value = 1
  automationHasNextPage.value = false
}

const loadAutomations = async (reset = true) => {
  const projectId = activeProjectId.value
  if (!projectId) {
    resetAutomationList()
    return
  }

  const nextPage = reset ? 1 : automationPage.value + 1

  if (reset) {
    automationLoading.value = true
  } else {
    automationLoadingMore.value = true
  }

  try {
    const response = await automationsApi.list({
      projectId,
      page: nextPage,
      limit: AUTOMATION_PAGE_LIMIT,
      keyword: automationKeyword.value.trim() || undefined,
      status: automationStatusFilter.value === 'all' ? undefined : automationStatusFilter.value,
    })

    if (reset) {
      automations.value = response.data
    } else {
      const existingIds = new Set(automations.value.map((item) => item.id))
      automations.value = automations.value.concat(
        response.data.filter((item) => !existingIds.has(item.id)),
      )
    }

    automationPage.value = nextPage
    automationHasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载自动化列表失败'))
  } finally {
    automationLoading.value = false
    automationLoadingMore.value = false
  }
}

const resetFilters = () => {
  automationKeyword.value = ''
  automationStatusFilter.value = 'all'
  void loadAutomations(true)
}

const submitAutomation = async () => {
  if (!canManageAutomations.value) {
    validationMessage.value = '当前账号暂无自动化管理权限'
    return
  }

  if (!activeProjectId.value) {
    validationMessage.value = '缺少 projectId，请先选择项目'
    return
  }

  if (automationScheduleMode.value === 'daily' && automationScheduleDays.value.length === 0) {
    validationMessage.value = '至少选择一个执行日期'
    return
  }

  const resolvedRrule = resolvedAutomationRrule.value.trim()
  if (!automationForm.name.trim() || !automationForm.prompt.trim() || !resolvedRrule) {
    validationMessage.value = '名称、执行提示 和执行计划为必填'
    return
  }

  automationSubmitting.value = true
  validationMessage.value = ''

  const cwds = parseCwds(automationForm.cwdsText)
  const payloadBase = {
    name: automationForm.name.trim(),
    prompt: automationForm.prompt.trim(),
    rrule: resolvedRrule,
    status: automationForm.status,
    ...(cwds.length > 0 ? { cwds } : {}),
  }

  try {
    if (automationEditingId.value) {
      const payload: UpdateAutomationPayload = payloadBase
      await automationsApi.update(automationEditingId.value, payload)
      message.success('保存自动化计划成功')
    } else {
      const payload: CreateAutomationPayload = {
        projectId: activeProjectId.value,
        ...payloadBase,
      }
      await automationsApi.create(payload)
      message.success('创建自动化计划成功')
    }

    closeAutomationFormModal()
    await loadAutomations(true)
  } catch (error) {
    message.error(toErrorMessage(error, '保存自动化失败'))
  } finally {
    automationSubmitting.value = false
  }
}

const toggleAutomationStatus = async (automation: Automation) => {
  if (!canManageAutomations.value) {
    validationMessage.value = '当前账号暂无自动化管理权限'
    return
  }

  try {
    await automationsApi.update(automation.id, {
      status: automation.status === 'active' ? 'paused' : 'active',
    })
    await loadAutomations(true)
    message.success('更新自动化状态成功')
  } catch (error) {
    message.error(toErrorMessage(error, '更新自动化状态失败'))
  }
}

const removeAutomation = async (automation: Automation) => {
  if (!canManageAutomations.value) {
    validationMessage.value = '当前账号暂无自动化管理权限'
    return
  }

  deletingAutomationTarget.value = automation
  automationDeleteModalOpen.value = true
}

const setAutomationDeleteModalOpen = (open: boolean) => {
  automationDeleteModalOpen.value = open

  if (!open) {
    deletingAutomationTarget.value = null
  }
}

const confirmRemoveAutomation = async () => {
  const automation = deletingAutomationTarget.value
  if (!automation) {
    return
  }

  automationDeletingId.value = automation.id

  try {
    await automationsApi.remove(automation.id)
    await loadAutomations(true)
    message.success('删除自动化成功')
    setAutomationDeleteModalOpen(false)
  } catch (error) {
    message.error(toErrorMessage(error, '删除自动化失败'))
  } finally {
    automationDeletingId.value = ''
  }
}

watch(
  activeProjectId,
  () => {
    validationMessage.value = ''
    void loadAutomations(true)
  },
  { immediate: true },
)

  return reactive({
    AUTOMATION_STATUS_FILTER_OPTIONS,
    AUTOMATION_WEEKDAY_OPTIONS,
    automationIntervalRrule,
    automationStatusClassMap,
    automationStatusLabelMap,
    createDefaultAutomationWeekdays,
    setAutomationDeleteModalOpen,
    toggleAutomationScheduleDay,
    automationModalSubmitLabel,
    applyAutomationRruleToForm,
    automationDeleteModalOpen,
    openCreateAutomationModal,
    deletingAutomationTarget,
    closeAutomationFormModal,
    automationFormModalOpen,
    resolvedAutomationRrule,
    confirmRemoveAutomation,
    automationStatusFilter,
    automationScheduleMode,
    automationScheduleTime,
    automationScheduleDays,
    resolveStoredProjectId,
    toggleAutomationStatus,
    automationLoadingMore,
    automationHasNextPage,
    activeAutomationCount,
    pausedAutomationCount,
    normalizeScheduleTime,
    automationSubmitting,
    automationDeletingId,
    canManageAutomations,
    totalAutomationCount,
    automationModalTitle,
    automationEditingId,
    normalizeRouteParam,
    isAutomationWeekday,
    resetAutomationForm,
    startEditAutomation,
    resetAutomationList,
    automationLoading,
    automationKeyword,
    validationMessage,
    extractRrulePart,
    buildWeeklyRrule,
    submitAutomation,
    removeAutomation,
    activeProjectId,
    loadAutomations,
    automationPage,
    automationForm,
    hasProjectId,
    resetFilters,
    accessStore,
    automations,
    formatDate,
    formatCwds,
    parseCwds,
    message,
    route,
  })
}
