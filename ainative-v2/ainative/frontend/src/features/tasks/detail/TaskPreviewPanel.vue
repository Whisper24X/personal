<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RotateCw } from 'lucide-vue-next'
import type { SelectOption } from '@shared/components/select'
import AppSelect from '@shared/components/select'
import { tasksApi } from '@/api/tasks'
import type {
  TaskEnvironmentPreview,
  TaskEnvironmentServiceStatus,
  TaskEnvironmentServicePhase,
  TaskLog,
} from '@/types/api/tasks'
import {
  getInitialPreviewViewportState,
  getPreviewViewportPreset,
  PREVIEW_FULL_VIEWPORT_ID,
  PREVIEW_VIEWPORT_PRESETS,
  PREVIEW_VIEWPORT_STORAGE_KEY,
  resolveFramePixelSize,
} from './task-preview-viewports'

defineOptions({
  name: 'TaskDetailPreviewPanel',
})

/** In preview iframe: `parent.postMessage({ type, url, title? }, <parent origin>)` */
const PREVIEW_OPEN_IN_TAB = 'ainative:preview:openInTab' as const
const PREVIEW_DIAGNOSTIC = 'ainative:preview:diagnostic' as const

type PreviewDiagnosticKind =
  | 'platform-hmr-rewritten'
  | 'platform-hmr-relay-failed'
  | 'workspace-runtime-error'

type ReportablePreviewDiagnosticKind = Exclude<PreviewDiagnosticKind, 'platform-hmr-rewritten'>

type PreviewDiagnosticEvent = {
  kind: PreviewDiagnosticKind
  detail?: Record<string, unknown> | null
}

type PreviewTab = {
  id: string
  url: string
  title?: string
}

const props = withDefaults(
  defineProps<{
    taskId?: string
    preview?: TaskEnvironmentPreview | null
    serviceStatuses?: TaskEnvironmentServiceStatus[] | null
    logs?: TaskLog[]
    formatDate?: (value?: string) => string
  }>(),
  {
    taskId: '',
    preview: null,
    serviceStatuses: () => [],
    logs: () => [],
    formatDate: undefined,
  },
)

const logOpen = ref(false)
const tabs = ref<PreviewTab[]>([])
const activeTabId = ref<string | null>(null)
const tabReloadNonce = ref<Record<string, number>>({})
let nextTabSeq = 0
const latestDiagnostic = ref<PreviewDiagnosticEvent | null>(null)
const reportedDiagnosticKeys = new Map<string, number>()
const DIAGNOSTIC_REPORT_WINDOW_MS = 60_000

const makeTabId = () => {
  nextTabSeq += 1
  return `p-${nextTabSeq}`
}

const MAX_LOG_LINES = 2000

const resolveLogMessage = (log: TaskLog) => {
  const payload = log.payload && typeof log.payload === 'object' ? log.payload : null
  if (
    (log.message === 'Agent CLI stdout chunk' || log.message === 'Agent CLI stderr chunk') &&
    payload &&
    typeof payload.text === 'string' &&
    payload.text.length > 0
  ) {
    return payload.text
  }

  return log.message
}

const visibleLogs = computed(() => {
  return props.logs.slice(-MAX_LOG_LINES).map((log) => ({
    id: log.id,
    level: log.level.toUpperCase(),
    createdAt: props.formatDate?.(log.createdAt) ?? log.createdAt,
    message: resolveLogMessage(log),
  }))
})

const resolvePreviewUrl = (raw?: string | null): string => {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    return ''
  }
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `http://${trimmed}`
}

const resolvedPreviewUrl = computed(() => resolvePreviewUrl(props.preview?.url))

const expectedMessageOrigin = computed(() => {
  const u = resolvedPreviewUrl.value
  if (!u) {
    return null
  }
  try {
    return new URL(u).origin
  } catch {
    return null
  }
})

const hasPreview = computed(() => Boolean(resolvedPreviewUrl.value))

const phaseLabelMap: Record<TaskEnvironmentServicePhase, string> = {
  pending: '等待启动',
  installing: '安装依赖中',
  starting: '启动中',
  listening: '已监听',
  failed: '启动失败',
  unknown: '状态未知',
}

const visibleServiceStatuses = computed(() =>
  (props.serviceStatuses ?? []).filter((item) => item?.isPrimaryPreview),
)

const primaryPreviewStatusSummary = computed(() => {
  const target = visibleServiceStatuses.value[0]
  if (!target) {
    return ''
  }
  const phase = phaseLabelMap[target.phase] ?? '状态未知'
  const portText = typeof target.port === 'number' ? `:${target.port}` : ''
  const detail = target.message?.trim() || ''
  return detail
    ? `${target.name}${portText} ${phase} · ${detail}`
    : `${target.name}${portText} ${phase}`
})

const initialViewport = getInitialPreviewViewportState()
const previewViewportId = ref(initialViewport.viewportId)
const previewViewportLandscape = ref(initialViewport.landscape)

const activePreviewViewportPreset = computed(() => {
  if (previewViewportId.value === PREVIEW_FULL_VIEWPORT_ID) {
    return null
  }
  return getPreviewViewportPreset(previewViewportId.value) ?? null
})

const usePresetPreviewLayout = computed(() => activePreviewViewportPreset.value != null)

const previewFrameBoxStyle = computed(() => {
  const p = activePreviewViewportPreset.value
  if (!p) {
    return {}
  }
  const { width, height } = resolveFramePixelSize(p, previewViewportLandscape.value)
  return { width: `${width}px`, height: `${height}px` }
})

const previewViewportOptions = computed<SelectOption[]>(() => [
  { label: '全宽 / 自适应', value: PREVIEW_FULL_VIEWPORT_ID },
  ...PREVIEW_VIEWPORT_PRESETS.map((preset) => ({
    label: preset.label,
    value: preset.id,
  })),
])

function togglePreviewViewportLandscape() {
  if (!usePresetPreviewLayout.value) {
    return
  }
  previewViewportLandscape.value = !previewViewportLandscape.value
}

function persistPreviewViewport() {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(
      PREVIEW_VIEWPORT_STORAGE_KEY,
      JSON.stringify({
        viewportId: previewViewportId.value,
        landscape: previewViewportLandscape.value,
      }),
    )
  } catch {
    /* 无存储权限等 */
  }
}

watch([previewViewportId, previewViewportLandscape], persistPreviewViewport)

const activeTab = computed(
  () => tabs.value.find((t) => t.id === activeTabId.value) ?? null,
)

const ensureReloadSlot = (id: string) => {
  if (tabReloadNonce.value[id] === undefined) {
    tabReloadNonce.value = { ...tabReloadNonce.value, [id]: 0 }
  }
}

const tabLabel = (tab: PreviewTab, index: number) => {
  if (tab.title?.trim()) {
    return tab.title.trim()!
  }
  return index === 0 ? '导航' : `预览 ${index + 1}`
}

const previewHint = computed(() => {
  if (props.preview?.status === 'provisioning') {
    return '容器预览生成中...'
  }

  if (props.preview?.status === 'failed') {
    return '容器预览生成失败'
  }

  return '容器预览尚未就绪'
})

const previewDiagnosticSummary = computed(() => {
  const diagnostic = latestDiagnostic.value
  if (!diagnostic) {
    return ''
  }
  if (diagnostic.kind === 'platform-hmr-relay-failed') {
    return '平台 HMR relay 建联失败，预览页可能仍在尝试连接错误的本地调试地址。'
  }
  if (diagnostic.kind === 'platform-hmr-rewritten') {
    const from = typeof diagnostic.detail?.from === 'string' ? diagnostic.detail.from : ''
    return from
      ? `平台已将 HMR 连接从 ${from} 改写到当前预览域名。`
      : '平台已接管并改写 HMR 连接到当前预览域名。'
  }
  const summary =
    typeof diagnostic.detail?.summary === 'string' ? diagnostic.detail.summary.trim() : ''
  return summary
    ? `子仓运行时发生异常：${summary}`
    : '子仓运行时发生未处理异常，请查看任务日志。'
})

const clampText = (value: string, maxLength: number) => {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLength - 1)}…`
}

const topStackFrame = (stack: string | null) => {
  if (!stack) {
    return ''
  }
  return (
    stack
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  )
}

const sanitizeDiagnosticDetail = (detail: Record<string, unknown> | null) => {
  if (!detail) {
    return null
  }
  const result: Record<string, unknown> = {}
  const allowedKeys = [
    'source',
    'message',
    'summary',
    'rawKind',
    'filename',
    'name',
    'code',
    'status',
    'errMsg',
    'from',
    'url',
    'path',
    'stack',
  ] as const
  for (const key of allowedKeys) {
    const value = detail[key]
    if (value === undefined || value === null) {
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value
      continue
    }
    if (typeof value === 'string') {
      result[key] = clampText(value, key === 'stack' ? 4000 : 1024)
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

const buildPreviewDiagnosticSummary = (
  kind: PreviewDiagnosticKind,
  detail: Record<string, unknown> | null,
) => {
  if (kind === 'platform-hmr-relay-failed') {
    return '平台 HMR relay 建联失败'
  }
  const summaryCandidates = [
    typeof detail?.summary === 'string' ? detail.summary : '',
    typeof detail?.message === 'string' ? detail.message : '',
    typeof detail?.errMsg === 'string' ? detail.errMsg : '',
  ]
  const hit = summaryCandidates.map((item) => item.trim()).find(Boolean)
  return hit ? clampText(hit, 1024) : '子仓运行时发生未处理异常'
}

const buildDiagnosticDedupeKey = (
  kind: PreviewDiagnosticKind,
  detail: Record<string, unknown> | null,
) => {
  const summary = buildPreviewDiagnosticSummary(kind, detail)
  const source = typeof detail?.source === 'string' ? detail.source.trim() : ''
  const filename = typeof detail?.filename === 'string' ? detail.filename.trim() : ''
  const stack = typeof detail?.stack === 'string' ? detail.stack : null
  return clampText(
    [kind, summary, source, filename, topStackFrame(stack)].filter(Boolean).join('|'),
    128,
  )
}

const shouldReportDiagnostic = (
  kind: PreviewDiagnosticKind,
  detail: Record<string, unknown> | null,
): kind is ReportablePreviewDiagnosticKind => {
  if (!props.taskId) {
    return false
  }
  if (kind !== 'workspace-runtime-error' && kind !== 'platform-hmr-relay-failed') {
    return false
  }
  const key = buildDiagnosticDedupeKey(kind, detail)
  const now = Date.now()
  const previous = reportedDiagnosticKeys.get(key) ?? 0
  if (now - previous < DIAGNOSTIC_REPORT_WINDOW_MS) {
    return false
  }
  reportedDiagnosticKeys.set(key, now)
  return true
}

const reportPreviewDiagnostic = (
  kind: PreviewDiagnosticKind,
  detail: Record<string, unknown> | null,
) => {
  if (!shouldReportDiagnostic(kind, detail)) {
    return
  }
  const sanitizedDetail = sanitizeDiagnosticDetail(detail)
  void tasksApi
    .reportPreviewDiagnostic(props.taskId, {
      kind,
      message: kind === 'platform-hmr-relay-failed' ? 'Preview HMR relay failure' : 'Preview runtime error',
      summary: buildPreviewDiagnosticSummary(kind, sanitizedDetail),
      dedupeKey: buildDiagnosticDedupeKey(kind, sanitizedDetail),
      detail: sanitizedDetail,
    })
    .catch(() => {
      /* ignore reporting failures */
    })
}

const validateOpenInTabUrl = (
  rawUrl: string,
  allowedOrigin: string | null,
  basePreviewUrl: string,
): string | null => {
  if (!allowedOrigin || !basePreviewUrl) {
    return null
  }
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return null
  }

  let parsed: URL

  const tryParseAbsolute = (): URL | null => {
    try {
      const u = new URL(trimmed)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u
      }
    } catch {
      /* 相对 path 或需结合 base 解析 */
    }
    return null
  }

  const direct = tryParseAbsolute()
  if (direct) {
    parsed = direct
  } else {
    try {
      parsed = new URL(trimmed, basePreviewUrl)
    } catch {
      return null
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }
  if (parsed.origin !== allowedOrigin) {
    return null
  }
  return parsed.href
}

const openTabWithUrl = (rawUrl: string, title?: string) => {
  const base = resolvedPreviewUrl.value
  if (!base) {
    return
  }
  const normalized = validateOpenInTabUrl(rawUrl, expectedMessageOrigin.value, base)
  if (!normalized) {
    return
  }
  const id = makeTabId()
  const next: PreviewTab = { id, url: normalized, title }
  tabs.value = [...tabs.value, next]
  activeTabId.value = id
  ensureReloadSlot(id)
}

const onPreviewMessage = (ev: MessageEvent) => {
  if (!hasPreview.value) {
    return
  }
  if (ev.origin !== expectedMessageOrigin.value) {
    return
  }
  const data = ev.data
  if (!data || typeof data !== 'object') {
    return
  }
  if ((data as { type?: string }).type !== PREVIEW_OPEN_IN_TAB) {
    if ((data as { type?: string }).type !== PREVIEW_DIAGNOSTIC) {
      return
    }
    const kind = (data as { kind?: unknown }).kind
    if (
      kind !== 'platform-hmr-rewritten' &&
      kind !== 'platform-hmr-relay-failed' &&
      kind !== 'workspace-runtime-error'
    ) {
      return
    }
    const detail = (data as { detail?: unknown }).detail
    latestDiagnostic.value = {
      kind,
      detail: detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null,
    }
    reportPreviewDiagnostic(
      kind,
      detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null,
    )
    return
  }
  const url = (data as { url?: unknown }).url
  if (typeof url !== 'string' || !url.trim()) {
    return
  }
  const titleRaw = (data as { title?: unknown }).title
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : undefined
  openTabWithUrl(url, title)
}

const refreshPreview = () => {
  const id = activeTabId.value
  if (!id) {
    return
  }
  ensureReloadSlot(id)
  const next = (tabReloadNonce.value[id] ?? 0) + 1
  tabReloadNonce.value = { ...tabReloadNonce.value, [id]: next }
}

const toggleLog = () => {
  logOpen.value = !logOpen.value
}

const closeTab = (tabId: string) => {
  if (tabs.value.length <= 1) {
    return
  }
  const next = tabs.value.filter((t) => t.id !== tabId)
  tabs.value = next
  const rest = { ...tabReloadNonce.value }
  delete rest[tabId]
  tabReloadNonce.value = rest
  if (activeTabId.value === tabId) {
    activeTabId.value = next[0]?.id ?? null
  }
}

watch(
  () => [props.preview?.status, props.preview?.url] as const,
  () => {
    const resolved = resolvedPreviewUrl.value
    const available = Boolean(resolved)
    if (!available) {
      nextTabSeq = 0
      tabs.value = []
      activeTabId.value = null
      tabReloadNonce.value = {}
      latestDiagnostic.value = null
      reportedDiagnosticKeys.clear()
      return
    }
    const id = 'p-0'
    nextTabSeq = 0
    tabs.value = [{ id, url: resolved, title: undefined }]
    activeTabId.value = id
    tabReloadNonce.value = { [id]: 0 }
    latestDiagnostic.value = null
    reportedDiagnosticKeys.clear()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('message', onPreviewMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onPreviewMessage)
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header
      v-if="hasPreview"
      class="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
    >
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          class="inline-flex h-2 w-2 shrink-0 rounded-full"
          :class="hasPreview ? 'bg-green-500' : 'bg-muted-foreground/40'"
        />
        <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <div
            v-for="(tab, index) in tabs"
            :key="tab.id"
            class="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs"
            :class="
              activeTabId === tab.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground'
            "
            role="button"
            tabindex="0"
            @click="activeTabId = tab.id"
            @keydown.enter="activeTabId = tab.id"
          >
            <span class="max-w-[10rem] truncate">{{ tabLabel(tab, index) }}</span>
            <button
              v-if="tabs.length > 1"
              class="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm opacity-80 transition-opacity hover:opacity-100"
              type="button"
              title="关闭此预览标签"
              @click.stop="closeTab(tab.id)"
            >
              &#x2715;
            </button>
          </div>
        </div>
      </div>

      <div class="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1">
        <AppSelect
          v-model="previewViewportId"
          aria-label="预览视口大小"
          :block="false"
          :options="previewViewportOptions"
          :panel-z-index="90"
          panel-placement="bottom"
          size="sm"
          trigger-class="h-7 min-w-[7.5rem] max-w-[11rem] rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground shadow-none"
        />
        <button
          v-show="usePresetPreviewLayout"
          class="border-border bg-background text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition hover:bg-accent"
          type="button"
          title="交换预览区域宽高（横/竖屏）"
          aria-label="横竖屏切换，交换预览宽高"
          @click="togglePreviewViewportLandscape"
        >
          <RotateCw class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          class="border-border bg-background text-foreground h-7 rounded-md border px-2.5 text-xs transition hover:bg-accent disabled:opacity-40"
          type="button"
          title="刷新当前标签页"
          :disabled="!activeTab"
          @click="refreshPreview"
        >
          刷新
        </button>
        <button
          class="h-7 rounded-md border px-2.5 text-xs transition"
          :class="logOpen ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-accent'"
          type="button"
          title="查看运行日志"
          @click="toggleLog"
        >
          日志
        </button>
      </div>
    </header>

    <header
      v-else
      class="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
    >
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span class="inline-flex h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
        <span class="text-muted-foreground text-xs">{{ previewHint }}</span>
      </div>
    </header>

    <div v-if="logOpen" class="border-border/70 shrink-0 border-b" style="height: 180px">
      <div
        class="h-full overflow-auto bg-[#0f1115] px-3 py-2 font-mono text-xs leading-5 text-[#c7d2fe] select-text"
      >
        <div v-if="visibleLogs.length === 0" class="text-muted-foreground italic">暂无任务日志</div>
        <div v-for="log in visibleLogs" :key="log.id" class="whitespace-pre-wrap break-all">
          [{{ log.createdAt }}] {{ log.level }} {{ log.message }}
        </div>
      </div>
    </div>

    <div
      v-if="primaryPreviewStatusSummary"
      class="text-muted-foreground border-border/60 shrink-0 border-b px-3 py-1.5 text-[11px]"
    >
      {{ primaryPreviewStatusSummary }}
    </div>

    <div
      v-if="previewDiagnosticSummary"
      class="text-amber-700 border-border/60 bg-amber-50 shrink-0 border-b px-3 py-2 text-[11px] leading-5"
      data-testid="task-preview-diagnostic"
    >
      {{ previewDiagnosticSummary }}
    </div>

    <div class="flex min-h-0 flex-1 flex-col">
      <div v-if="hasPreview && tabs.length > 0" class="flex min-h-0 flex-1 flex-col">
        <div
          v-if="activeTab"
          class="text-muted-foreground border-border/40 shrink-0 border-b px-3 py-1.5"
        >
          <p
            class="text-foreground break-all font-mono text-[11px] leading-normal select-text"
            data-testid="task-preview-active-url"
          >
            {{ activeTab.url }}
          </p>
        </div>
        <div v-if="!usePresetPreviewLayout" class="relative min-h-0 flex-1" data-testid="task-preview-iframe-surface--full">
          <template v-for="tab in tabs" :key="`${tab.id}-${tabReloadNonce[tab.id] ?? 0}`">
            <iframe
              v-show="activeTabId === tab.id"
              :src="tab.url"
              class="absolute inset-0 h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </template>
        </div>
        <div
          v-else
          class="min-h-0 flex-1 overflow-auto bg-muted/20 p-2"
          data-testid="task-preview-iframe-surface--preset"
        >
          <div
            v-if="activeTab"
            class="border-border relative mx-auto box-border shrink-0 overflow-hidden rounded-lg border bg-background shadow-sm"
            :style="previewFrameBoxStyle"
            data-testid="task-preview-viewport-frame"
          >
            <template v-for="tab in tabs" :key="`${tab.id}-${tabReloadNonce[tab.id] ?? 0}`">
              <iframe
                v-show="activeTabId === tab.id"
                :src="tab.url"
                class="absolute inset-0 h-full w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            </template>
          </div>
        </div>
      </div>
      <div
        v-else
        class="text-muted-foreground flex h-full flex-col items-center justify-center gap-2"
      >
        <span class="text-sm">{{ previewHint }}</span>
        <span v-if="props.preview?.status === 'provisioning'" class="max-w-xs text-center text-xs">
          预览服务正在启动，地址就绪后会自动展示。
        </span>
        <span
          v-else-if="props.preview?.status === 'failed'"
          class="max-w-xs text-center text-xs text-destructive"
        >
          系统未能为当前任务生成可访问的预览地址，请刷新任务状态或重新启动环境。
        </span>
        <span v-else class="max-w-xs text-center text-xs">
          请启动执行环境后查看容器预览。
        </span>
      </div>
    </div>
  </div>
</template>
