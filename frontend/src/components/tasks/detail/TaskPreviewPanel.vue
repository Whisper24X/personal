<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { projectsApi } from '@/api/projects'
import type { TaskLog } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'TaskDetailPreviewPanel',
})

type PreviewConfig = {
  runtimeUrl?: string
}

const props = withDefaults(
  defineProps<{
    taskId: string
    projectId?: string
    refreshToken?: number
    logs?: TaskLog[]
    formatDate?: (value?: string) => string
  }>(),
  {
    projectId: '',
    refreshToken: 0,
    logs: () => [],
    formatDate: undefined,
  },
)

const runtimePreviewUrl = ref('')
const iframeSrc = ref('')
const errorMessage = ref('')
const logOpen = ref(false)
const configLoaded = ref(false)

const MAX_LOG_LINES = 2000

const applyUrl = () => {
  const rawUrl = runtimePreviewUrl.value.trim()
  if (!rawUrl) {
    iframeSrc.value = ''
    return
  }

  iframeSrc.value =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `http://${rawUrl}`
}

const resetPreviewConfig = () => {
  runtimePreviewUrl.value = ''
  iframeSrc.value = ''
  errorMessage.value = ''
}

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

const loadConfig = async () => {
  if (!props.projectId) {
    resetPreviewConfig()
    configLoaded.value = true
    return
  }

  configLoaded.value = false

  try {
    const project = await projectsApi.detail(props.projectId)
    const configJson = (project.configJson ?? {}) as Record<string, unknown>
    const preview = (configJson.preview ?? null) as PreviewConfig | null

    runtimePreviewUrl.value = typeof preview?.runtimeUrl === 'string' ? preview.runtimeUrl : ''
    errorMessage.value = ''
    applyUrl()
  } catch (error) {
    resetPreviewConfig()
    errorMessage.value = toErrorMessage(error, '加载容器预览失败')
  } finally {
    configLoaded.value = true
  }
}

const refreshPreview = () => {
  if (!iframeSrc.value) {
    return
  }

  const currentSrc = iframeSrc.value
  iframeSrc.value = ''

  nextTick(() => {
    iframeSrc.value = currentSrc
  })
}

const toggleLog = () => {
  logOpen.value = !logOpen.value
}

watch(
  () => props.projectId,
  () => {
    void loadConfig()
  },
  { immediate: true },
)

watch(
  () => props.refreshToken,
  () => {
    void loadConfig()
  },
)
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header class="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span
          class="inline-flex h-2 w-2 shrink-0 rounded-full"
          :class="iframeSrc ? 'bg-green-500' : 'bg-muted-foreground/40'"
        />
        <span v-if="iframeSrc" class="text-foreground truncate text-xs">{{ iframeSrc }}</span>
        <span v-else-if="configLoaded" class="text-muted-foreground text-xs">容器预览尚未就绪</span>
        <span v-else class="text-muted-foreground text-xs">加载预览配置中...</span>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <button
          class="border-border bg-background text-foreground h-7 rounded-md border px-2.5 text-xs transition hover:bg-accent disabled:opacity-40"
          type="button"
          title="刷新页面"
          :disabled="!iframeSrc"
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

    <div v-if="logOpen" class="border-border/70 shrink-0 border-b" style="height: 180px">
      <div class="h-full overflow-auto bg-[#0f1115] px-3 py-2 font-mono text-xs leading-5 text-[#c7d2fe] select-text">
        <div v-if="visibleLogs.length === 0" class="text-muted-foreground italic">暂无任务日志</div>
        <div v-for="log in visibleLogs" :key="log.id" class="whitespace-pre-wrap break-all">
          [{{ log.createdAt }}] {{ log.level }} {{ log.message }}
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1">
      <iframe
        v-if="iframeSrc"
        :src="iframeSrc"
        class="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
      <div
        v-else
        class="text-muted-foreground flex h-full flex-col items-center justify-center gap-2"
      >
        <span class="text-sm">容器预览尚未就绪</span>
        <span class="max-w-xs text-center text-xs">
          预览地址由后端任务容器自动提供，不再手工配置页面和端口。
        </span>
        <span v-if="errorMessage" class="max-w-xs text-center text-xs text-destructive">
          {{ errorMessage }}
        </span>
      </div>
    </div>
  </div>
</template>
