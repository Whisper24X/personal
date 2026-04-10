<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TaskEnvironmentPreview, TaskLog } from '@/types/api/tasks'

defineOptions({
  name: 'TaskDetailPreviewPanel',
})

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
const iframeReloadNonce = ref(0)

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

const iframeSrc = computed(() => {
  const rawUrl = props.preview?.url?.trim()
  if (!rawUrl) {
    return ''
  }

  return rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `http://${rawUrl}`
})

const previewHint = computed(() => {
  if (props.preview?.status === 'provisioning') {
    return '容器预览生成中...'
  }

  if (props.preview?.status === 'failed') {
    return '容器预览生成失败'
  }

  return '容器预览尚未就绪'
})

const refreshPreview = () => {
  if (!iframeSrc.value) {
    return
  }

  iframeReloadNonce.value += 1
}

const toggleLog = () => {
  logOpen.value = !logOpen.value
}
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
        <span v-else class="text-muted-foreground text-xs">{{ previewHint }}</span>
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
        :key="iframeReloadNonce"
        :src="iframeSrc"
        class="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
      <div
        v-else
        class="text-muted-foreground flex h-full flex-col items-center justify-center gap-2"
      >
        <span class="text-sm">{{ previewHint }}</span>
        <span v-if="props.preview?.status === 'provisioning'" class="max-w-xs text-center text-xs">
          系统正在为当前任务分配预览地址，地址就绪后会自动展示。
        </span>
        <span v-else-if="props.preview?.status === 'failed'" class="max-w-xs text-center text-xs text-destructive">
          系统未能为当前任务生成可访问的预览地址，请刷新任务状态或重新启动环境。
        </span>
        <span v-else class="max-w-xs text-center text-xs">
          预览地址由系统统一分配和托管，不再从项目配置或容器端口直接读取。
        </span>
      </div>
    </div>
  </div>
</template>
