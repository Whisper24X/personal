<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RotateCw } from 'lucide-vue-next'
import type { SelectOption } from '@shared/components/select'
import AppSelect from '@shared/components/select'
import type { TaskEnvironmentPreview, TaskLog } from '@/types/api/tasks'
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

type PreviewTab = {
  id: string
  url: string
  title?: string
}

const props = withDefaults(
  defineProps<{
    preview?: TaskEnvironmentPreview | null
    logs?: TaskLog[]
    formatDate?: (value?: string) => string
  }>(),
  {
    preview: null,
    logs: () => [],
    formatDate: undefined,
  },
)

const logOpen = ref(false)
const tabs = ref<PreviewTab[]>([])
const activeTabId = ref<string | null>(null)
const tabReloadNonce = ref<Record<string, number>>({})
let nextTabSeq = 0

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

/** 开发者在预览服务 HTML 中可引用的桥接脚本地址（与当前主应用同部署） */
const bridgeScriptUrl = computed(() => {
  if (typeof window === 'undefined') {
    return ''
  }
  return new URL('preview-iframe-bridge.js', new URL(import.meta.env.BASE_URL, window.location.origin)).href
})

const hasPreview = computed(
  () => props.preview?.status === 'ready' && Boolean(resolvedPreviewUrl.value),
)

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

/** 副标题：host + 路径，避免仅显示成「/x/」而误以为未带域名 */
const currentTabUrlSummary = computed(() => {
  const t = activeTab.value
  if (!t) {
    return ''
  }
  try {
    const u = new URL(t.url)
    const path = `${u.pathname}${u.search}${u.hash}`
    if (path.length > 0 && path !== '/') {
      return `${u.host} · ${path}`
    }
    return t.url
  } catch {
    return t.url
  }
})

const tabLabel = (tab: PreviewTab, index: number) => {
  if (tab.title?.trim()) {
    return tab.title.trim()!
  }
  return `预览 ${index + 1}`
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

const createTabLikeTerminal = () => {
  const url = activeTab.value?.url
  if (!url) {
    return
  }
  openTabWithUrl(url, undefined)
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
    const ready = props.preview?.status === 'ready' && Boolean(resolved)
    if (!ready) {
      nextTabSeq = 0
      tabs.value = []
      activeTabId.value = null
      tabReloadNonce.value = {}
      return
    }
    const id = 'p-0'
    nextTabSeq = 0
    tabs.value = [{ id, url: resolved, title: undefined }]
    activeTabId.value = id
    tabReloadNonce.value = { [id]: 0 }
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
            :title="tab.url"
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
          class="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          :disabled="!activeTab"
          type="button"
          title="使用当前地址新建预览标签"
          @click="createTabLikeTerminal"
        >
          新建标签
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

    <details
      v-if="hasPreview && bridgeScriptUrl"
      class="border-border/60 text-muted-foreground shrink-0 border-b px-3 py-1.5 text-[11px] leading-normal"
    >
      <summary class="cursor-pointer select-none text-xs">若链接仍打开浏览器新标签，请加载桥接脚本</summary>
      <p class="text-muted-foreground mt-1.5">
        当任务环境由 Runner 内 nginx 代理且部署已配置 <code>AINATIVE_PREVIEW_BRIDGE_*</code> 时，可自动注入，无需改仓库。
        否则将下列一行加入预览应用的 <code>index.html</code>（把地址换成你的 AINative 主应用即可）：
      </p>
      <p
        class="text-foreground mt-1 break-all font-mono text-[11px] select-text"
        :title="bridgeScriptUrl"
      >
        &lt;script src="{{ bridgeScriptUrl }}" defer&gt;&lt;/script&gt;
      </p>
    </details>

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

    <div class="flex min-h-0 flex-1 flex-col">
      <div v-if="hasPreview && tabs.length > 0" class="flex min-h-0 flex-1 flex-col">
        <div
          v-if="activeTab"
          class="text-muted-foreground border-border/40 shrink-0 space-y-0.5 border-b px-3 py-1"
        >
          <p class="text-xs leading-snug" :title="activeTab.url">
            <span class="block truncate">{{ currentTabUrlSummary || activeTab.url }}</span>
          </p>
          <p class="text-[10px] leading-tight text-muted-foreground/70">完整地址以悬停提示为准</p>
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
          系统正在为当前任务分配预览地址，地址就绪后会自动展示。
        </span>
        <span
          v-else-if="props.preview?.status === 'failed'"
          class="max-w-xs text-center text-xs text-destructive"
        >
          系统未能为当前任务生成可访问的预览地址，请刷新任务状态或重新启动环境。
        </span>
        <span v-else class="max-w-xs text-center text-xs">
          预览地址由系统统一分配和托管，不再从项目配置或容器端口直接读取。
        </span>
      </div>
    </div>
  </div>
</template>
