<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import type { TaskTerminalSession } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { TerminalWsConnection } from '@/utils/ws/terminal-ws'

defineOptions({
  name: 'TaskDetailPreviewPanel',
})

type PreviewConfig = {
  command?: string
  url?: string
  runtimeUrl?: string
}

const props = withDefaults(
  defineProps<{
    taskId: string
    projectId?: string
    refreshToken?: number
  }>(),
  {
    projectId: '',
    refreshToken: 0,
  },
)

const command = ref('')
const previewUrl = ref('')
const runtimePreviewUrl = ref('')
const iframeSrc = ref('')
const errorMessage = ref('')
const running = ref(false)
const configOpen = ref(false)
const logOpen = ref(false)
const logLines = ref<string[]>([])
const configLoaded = ref(false)

const logContainerRef = ref<HTMLDivElement | null>(null)

let session: TaskTerminalSession | null = null
let wsConnection: TerminalWsConnection | null = null
let wsReady = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let commandStarted = false
let pendingCommand: string | null = null

const MAX_LOG_LINES = 2000
const ESC = String.fromCodePoint(0x1b)
const BEL = String.fromCodePoint(0x07)
const CTRL_RANGE = `${String.fromCodePoint(0x00)}-${String.fromCodePoint(0x08)}${String.fromCodePoint(0x0b)}${String.fromCodePoint(0x0c)}${String.fromCodePoint(0x0e)}-${String.fromCodePoint(0x1f)}${String.fromCodePoint(0x7f)}`

const stripAnsi = (text: string): string => {
  return text
    .replace(new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g'), '')
    .replace(new RegExp(`${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`, 'g'), '')
    .replace(new RegExp(`${ESC}[()#][A-Za-z0-9]`, 'g'), '')
    .replace(new RegExp(`${ESC}[A-Za-z]`, 'g'), '')
    .replace(new RegExp(`[${CTRL_RANGE}]`, 'g'), '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

const applyUrl = () => {
  const rawUrl = runtimePreviewUrl.value.trim() || previewUrl.value.trim()
  if (!rawUrl) {
    iframeSrc.value = ''
    return
  }

  iframeSrc.value =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `http://${rawUrl}`
}

const appendLog = (text: string) => {
  const cleaned = stripAnsi(text)
  const newLines = cleaned.split('\n').filter((line) => line.length > 0 || cleaned.endsWith('\n'))

  if (newLines.length === 0) {
    return
  }

  logLines.value = [...logLines.value, ...newLines].slice(-MAX_LOG_LINES)

  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

const clearLog = () => {
  logLines.value = []
}

const resetPreviewConfig = () => {
  command.value = ''
  previewUrl.value = ''
  runtimePreviewUrl.value = ''
  iframeSrc.value = ''
}

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

    command.value = typeof preview?.command === 'string' ? preview.command : ''
    previewUrl.value = typeof preview?.url === 'string' ? preview.url : ''
    runtimePreviewUrl.value = typeof preview?.runtimeUrl === 'string' ? preview.runtimeUrl : ''
    applyUrl()
  } catch {
    resetPreviewConfig()
  } finally {
    configLoaded.value = true
  }
}

const saveConfig = async () => {
  if (!props.projectId) {
    return
  }

  try {
    const project = await projectsApi.detail(props.projectId)
    const configJson = (project.configJson ?? {}) as Record<string, unknown>

    await projectsApi.update(props.projectId, {
      configJson: {
        ...configJson,
        preview: {
          command: command.value.trim(),
          url: previewUrl.value.trim(),
        },
      },
    })
  } catch {
    // Keep config editing non-blocking for the preview panel.
  }
}

const debouncedSave = () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    void saveConfig()
  }, 600)
}

const disconnectWs = () => {
  wsConnection?.dispose()
  wsConnection = null
  wsReady = false
}

const connectWs = () => {
  disconnectWs()

  wsConnection = new TerminalWsConnection({
    onMessage: (message) => {
      if (message.type === 'output') {
        if (commandStarted) {
          appendLog(message.data)
        }
        return
      }

      if (message.type === 'exit') {
        appendLog(`[进程已退出，退出码 ${message.code ?? 'null'}]`)
        running.value = false
        return
      }

      if (message.type === 'error') {
        appendLog(`[错误: ${message.message}]`)
        return
      }

      if (pendingCommand) {
        commandStarted = true
        wsConnection?.input(pendingCommand)
        pendingCommand = null
      }
    },
    onOpen: () => {
      wsReady = true

      if (session) {
        wsConnection?.attach(props.taskId, session.id)
      }
    },
    onClose: () => {
      wsReady = false
    },
  })

  wsConnection.connect()
}

const runCommand = async () => {
  const trimmedCommand = command.value.trim()
  if (!trimmedCommand) {
    return
  }

  errorMessage.value = ''
  clearLog()

  if (session) {
    try {
      await tasksApi.terminalRemove(props.taskId, session.id)
    } catch {
      // The previous session may already be gone.
    }

    wsConnection?.detach()
    session = null
  }

  try {
    commandStarted = false
    pendingCommand = `exec ${trimmedCommand}\n`
    session = await tasksApi.createTerminalSession(props.taskId, {
      cols: 120,
      rows: 30,
      shell: '/bin/sh',
    })
    running.value = true

    if (wsReady && wsConnection) {
      wsConnection.attach(props.taskId, session.id)
    }
  } catch (error) {
    pendingCommand = null
    errorMessage.value = toErrorMessage(error, '启动脚本失败')
    running.value = false
  }
}

const stopCommand = async () => {
  if (!session) {
    return
  }

  try {
    await tasksApi.terminalStop(props.taskId, session.id)
  } catch {
    // The session may already be stopped.
  }

  running.value = false
}

const restartCommand = async () => {
  await stopCommand()
  await nextTick()
  await runCommand()
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

const toggleConfig = () => {
  configOpen.value = !configOpen.value
}

const toggleLog = () => {
  logOpen.value = !logOpen.value
}

const onCommandInput = () => {
  debouncedSave()
}

const onUrlInput = () => {
  applyUrl()
  debouncedSave()
}

watch(
  () => props.taskId,
  () => {
    disconnectWs()
    session = null
    running.value = false
    clearLog()

    nextTick(() => {
      connectWs()
    })
  },
  { immediate: true },
)

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

onBeforeUnmount(() => {
  disconnectWs()

  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  if (session && running.value) {
    void tasksApi.terminalStop(props.taskId, session.id)
  }
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header class="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span
          class="inline-flex h-2 w-2 shrink-0 rounded-full"
          :class="running ? 'bg-green-500' : 'bg-muted-foreground/40'"
        />
        <span v-if="iframeSrc" class="text-foreground truncate text-xs">{{ iframeSrc }}</span>
        <span v-else-if="configLoaded" class="text-muted-foreground text-xs">未配置预览地址</span>
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
          class="border-border bg-background text-foreground h-7 rounded-md border px-2.5 text-xs transition hover:bg-accent disabled:opacity-40"
          type="button"
          title="重启服务"
          :disabled="!command.trim()"
          @click="restartCommand"
        >
          重启
        </button>
        <button
          class="h-7 rounded-md border px-2.5 text-xs font-semibold transition"
          :class="configOpen ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-accent'"
          type="button"
          title="配置启动命令和预览地址"
          @click="toggleConfig"
        >
          配置
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

    <div v-if="configOpen" class="border-border/70 shrink-0 border-b bg-muted/30 px-3 py-2.5">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <label class="text-muted-foreground w-16 shrink-0 text-xs">启动命令</label>
          <input
            v-model="command"
            type="text"
            placeholder="例如 npm run dev"
            class="border-border bg-background text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-md border px-2 text-xs outline-none focus:border-primary"
            @input="onCommandInput"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-muted-foreground w-16 shrink-0 text-xs">预览地址</label>
          <input
            v-model="previewUrl"
            type="text"
            placeholder="例如 http://localhost:3000"
            class="border-border bg-background text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-md border px-2 text-xs outline-none focus:border-primary"
            @input="onUrlInput"
          />
        </div>
      </div>
      <p v-if="errorMessage" class="mt-1.5 text-xs text-destructive">{{ errorMessage }}</p>
    </div>

    <div v-if="logOpen" class="border-border/70 shrink-0 border-b" style="height: 180px">
      <div
        ref="logContainerRef"
        class="h-full overflow-auto bg-[#0f1115] px-3 py-2 font-mono text-xs leading-5 text-[#c7d2fe] select-text"
      >
        <div v-if="logLines.length === 0" class="text-muted-foreground italic">暂无日志</div>
        <div v-for="(line, index) in logLines" :key="index" class="whitespace-pre-wrap break-all">
          {{ line }}
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
        <span class="text-sm">点击"配置"设置启动命令和预览地址</span>
      </div>
    </div>
  </div>
</template>
