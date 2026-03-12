<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { automationsApi } from '@/api/automations'
import { useAccessStore } from '@/stores/modules/access'
import type {
  Automation,
  AutomationStatus,
  CreateAutomationPayload,
  UpdateAutomationPayload,
} from '@/types/api/automations'
import { STORAGE_KEYS } from '@/types/common/storage'
import ConfirmActionModal from '@/components/business/settings/modals/ConfirmActionModal.vue'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'AutomationsView',
})

const AUTOMATION_PAGE_LIMIT = 20

type AutomationScheduleMode = 'daily' | 'interval'
type AutomationWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

const AUTOMATION_WEEKDAY_OPTIONS: Array<{ label: string; value: AutomationWeekday }> = [
  { label: '一', value: 'MO' },
  { label: '二', value: 'TU' },
  { label: '三', value: 'WE' },
  { label: '四', value: 'TH' },
  { label: '五', value: 'FR' },
  { label: '六', value: 'SA' },
  { label: '日', value: 'SU' },
]

const DEFAULT_AUTOMATION_WEEKDAYS: AutomationWeekday[] = ['MO', 'TU', 'WE', 'TH', 'FR']
const DEFAULT_AUTOMATION_TIME = '09:00'

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
const automation间隔Rrule = ref('')

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
const canManageAutomations = computed(() => accessStore.hasCapability('project.automation.manage'))
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
    return automation间隔Rrule.value.trim()
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
    automation间隔Rrule.value = ''
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
    automation间隔Rrule.value = ''
    return
  }

  automationScheduleMode.value = 'interval'
  automationScheduleTime.value = DEFAULT_AUTOMATION_TIME
  automationScheduleDays.value = createDefaultAutomationWeekdays()
  automation间隔Rrule.value = normalizedRrule
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
  automation间隔Rrule.value = ''
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
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="panel-card overflow-hidden">
      <div class="space-y-4 border-b border-border px-5 py-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-1">
            <h1 class="text-2xl font-semibold tracking-tight">自动化计划</h1>
            <p class="text-xs text-muted-foreground">
              共 {{ totalAutomationCount }} 条，运行中 {{ activeAutomationCount }} 条，已暂停 {{ pausedAutomationCount }} 条
            </p>
          </div>

          <button
            v-if="canManageAutomations"
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            :disabled="!hasProjectId"
            type="button"
            @click="openCreateAutomationModal"
          >
            新增计划
          </button>
        </div>

        <form class="flex flex-col gap-3 xl:flex-row xl:items-center" @submit.prevent="loadAutomations(true)">
          <input
            v-model="automationKeyword"
            class="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 执行提示"
            type="search"
          />

          <select
            v-model="automationStatusFilter"
            class="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground xl:w-40"
          >
            <option value="all">全部状态</option>
            <option value="active">运行中</option>
            <option value="paused">已暂停</option>
          </select>

          <div class="flex flex-wrap items-center gap-2">
            <button
              class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="resetFilters"
            >
              重置
            </button>
            <button
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              type="submit"
            >
              搜索
            </button>
          </div>
        </form>

        <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>
      </div>

      <div v-if="automationLoading" class="p-6 text-sm text-muted-foreground">加载中...</div>

      <div
        v-else-if="!hasProjectId"
        class="p-6 text-center text-sm text-muted-foreground"
      >
        当前 URL 缺少 projectId，请先在侧栏选择项目，或通过 `?projectId=&lt;uuid&gt;` 访问。
      </div>

      <div
        v-else-if="automations.length === 0"
        class="p-6 text-center text-sm text-muted-foreground"
      >
        当前筛选条件下暂无自动化计划。
      </div>

      <div v-else class="space-y-3 p-4">
        <article
          v-for="automation in automations"
          :key="automation.id"
          class="rounded-2xl border border-border bg-background/60 p-4"
        >
          <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-semibold text-foreground md:text-base">{{ automation.name }}</h2>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  :class="automationStatusClassMap[automation.status]"
                >
                  {{ automationStatusLabelMap[automation.status] }}
                </span>
              </div>

              <p class="text-sm leading-6 text-muted-foreground break-words">
                {{ automation.prompt }}
              </p>

              <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  RRULE: {{ automation.rrule }}
                </span>
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  工作目录: {{ formatCwds(automation.cwds) }}
                </span>
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  最近执行: {{ formatDate(automation.lastRunAt ?? undefined) }}
                </span>
                <span class="rounded-lg border border-border bg-background px-2.5 py-1">
                  下次执行: {{ formatDate(automation.nextRunAt ?? undefined) }}
                </span>
              </div>
            </div>

            <div v-if="canManageAutomations" class="flex shrink-0 flex-wrap gap-2 xl:justify-end">
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="startEditAutomation(automation)"
              >
                编辑
              </button>
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="toggleAutomationStatus(automation)"
              >
                {{ automation.status === 'active' ? '暂停' : '启用' }}
              </button>
              <button
                class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="automationDeletingId === automation.id"
                type="button"
                @click="removeAutomation(automation)"
              >
                {{ automationDeletingId === automation.id ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-if="!automationLoading && automationHasNextPage" class="border-t border-border px-5 py-4">
        <button
          class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="automationLoadingMore"
          type="button"
          @click="loadAutomations(false)"
        >
          {{ automationLoadingMore ? '加载中...' : '加载更多计划' }}
        </button>
      </div>
    </section>

    <ConfirmActionModal
      :open="automationDeleteModalOpen"
      :confirming="automationDeletingId === (deletingAutomationTarget?.id ?? '')"
      title="删除自动化计划"
      :description="`确认删除自动化「${deletingAutomationTarget?.name ?? ''}」吗？`"
      confirm-text="删除"
      @update:open="setAutomationDeleteModalOpen"
      @confirm="confirmRemoveAutomation"
    />

    <Teleport to="body">
      <div v-if="automationFormModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="关闭自动化计划弹窗"
          class="absolute inset-0 bg-black/30 backdrop-blur-sm"
          @click="closeAutomationFormModal"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="automation-form-modal-title"
          class="relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
          tabindex="-1"
          @keydown.esc.prevent="closeAutomationFormModal"
        >
          <div class="max-h-[calc(100vh-2rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-2">
                <h2 id="automation-form-modal-title" class="text-[2rem] font-semibold tracking-tight text-foreground">
                  {{ automationModalTitle }}
                </h2>
                <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
                  自动在后台执行计划任务，当前版本沿用现有后端契约。
                </p>
              </div>

              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-base text-foreground/70 transition hover:bg-muted hover:text-foreground"
                @click="closeAutomationFormModal"
              >
                ×
              </button>
            </div>

            <form class="mt-6 space-y-6" @submit.prevent="submitAutomation">
              <section class="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
                <div class="flex gap-3">
                  <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-background text-xs font-semibold text-primary">
                    i
                  </span>
                  <div class="space-y-1 text-sm text-foreground/85">
                    <p>自动化会在后台按计划执行，并将结果写回当前系统。</p>
                    <p class="text-muted-foreground">
                      你可以填写名称、执行提示和执行计划；调度会自动转换成 RRULE 提交到现有接口。
                    </p>
                  </div>
                </div>
              </section>

              <label class="block space-y-2">
                <span class="text-sm font-semibold text-foreground">名称</span>
                <input
                  v-model="automationForm.name"
                  class="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  :disabled="!canManageAutomations"
                  placeholder="例如：检查 Sentry 异常"
                  type="text"
                />
              </label>
              <label class="block space-y-2">
                <span class="text-sm font-semibold text-foreground">执行提示</span>
                <textarea
                  v-model="automationForm.prompt"
                  class="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  :disabled="!canManageAutomations"
                  placeholder="例如：检查 Sentry 中的新崩溃"
                />
              </label>

              <section class="space-y-3">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span class="text-sm font-semibold text-foreground">执行计划</span>
                  <div class="inline-flex w-fit rounded-full bg-muted p-1">
                    <button
                      class="rounded-full px-4 py-1.5 text-sm font-medium transition"
                      :class="automationScheduleMode === 'daily'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground'"
                      type="button"
                      @click="automationScheduleMode = 'daily'"
                    >
                      按天
                    </button>
                    <button
                      class="rounded-full px-4 py-1.5 text-sm font-medium transition"
                      :class="automationScheduleMode === 'interval'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground'"
                      type="button"
                      @click="automationScheduleMode = 'interval'"
                    >
                      间隔
                    </button>
                  </div>
                </div>

                <div v-if="automationScheduleMode === 'daily'" class="grid gap-3 lg:grid-cols-[200px_1fr] lg:items-start">
                  <input
                    v-model="automationScheduleTime"
                    class="h-11 rounded-2xl border border-border bg-background px-4 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    :disabled="!canManageAutomations"
                    type="time"
                  />

                  <div class="space-y-3">
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="day in AUTOMATION_WEEKDAY_OPTIONS"
                        :key="day.value"
                        class="inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold transition"
                        :class="automationScheduleDays.includes(day.value)
                          ? 'bg-foreground text-background'
                          : 'border border-border bg-background text-muted-foreground hover:text-foreground'"
                        :disabled="!canManageAutomations"
                        type="button"
                        @click="toggleAutomationScheduleDay(day.value)"
                      >
                        {{ day.label }}
                      </button>
                    </div>

                    <p class="rounded-2xl border border-border bg-background/70 px-4 py-3 text-xs leading-6 text-muted-foreground">
                      <template v-if="automationScheduleDays.length > 0">
                        RRULE: <span class="font-mono text-foreground">{{ resolvedAutomationRrule }}</span>
                      </template>
                      <template v-else>
                        至少选择一个执行日期。
                      </template>
                    </p>
                  </div>
                </div>

                <div v-else class="space-y-2">
                  <input
                    v-model="automation间隔Rrule"
                    class="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    :disabled="!canManageAutomations"
                    placeholder="FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0"
                    type="text"
                  />
                  <p class="text-sm text-muted-foreground">高级模式直接填写 RRULE，适合每 N 小时或更复杂的执行周期。</p>
                </div>
              </section>

              <p v-if="validationMessage" class="text-sm text-destructive">{{ validationMessage }}</p>

              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  class="h-11 rounded-2xl px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  type="button"
                  @click="closeAutomationFormModal"
                >
                  取消
                </button>
                <button
                  class="h-11 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="automationSubmitting || !canManageAutomations"
                  type="submit"
                >
                  {{ automationModalSubmitLabel }}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
