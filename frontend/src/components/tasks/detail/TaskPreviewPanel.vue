<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import type { TaskTerminalSession } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { TerminalWsConnection } from '@/utils/ws/terminal-ws'

const props = defineProps<{
  taskId: string
  projectId?: string
}>()

const command = ref('')
const previewUrl = ref('')
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

const stripAnsi = (text: string): string => {
  return text
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')       // CSI sequences (colors, cursor, erase)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC sequences (window title, etc.)
    .replace(/\x1b[()#][A-Za-z0-9]/g, '')           // character set selection
    .replace(/\x1b[A-Za-z]/g, '')                    // two-char escape sequences
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // control chars (keep \t \n \r)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

const appendLog = (text: string) => {
  const cleaned = stripAnsi(text)
  const newLines = cleaned.split('\n').filter((l) => l.length > 0 || cleaned.endsWith('\n'))
  if (newLines.length === 0) return
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

const loadConfig = async () => {
  if (!props.projectId) return

  try {
    const project = await projectsApi.detail(props.projectId)
    const cfg = project.configJson as Record<string, unknown> | null | undefined
    const preview = cfg?.preview as Record<string, string> | undefined
    if (preview) {
      command.value = preview.command ?? ''
      previewUrl.value = preview.url ?? ''
      applyUrl()
    }
  } catch {
    // ignore load errors
  } finally {
    configLoaded.value = true
  }
}

const saveConfig = async () => {
  if (!props.projectId) return

  try {
    const project = await projectsApi.detail(props.projectId)
    const existingConfig = (project.configJson as Record<string, unknown>) ?? {}
    await projectsApi.update(props.projectId, {
      configJson: {
        ...existingConfig,
        preview: {
          command: command.value.trim(),
          url: previewUrl.value.trim(),
        },
      },
    })
  } catch {
    // silent save
  }
}

const debouncedSave = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveConfig()
  }, 600)
}

const connectWs = () => {
  disconnectWs()

  wsConnection = new TerminalWsConnection({
    onMessage: (message) => {
      if (message.type === 'output') {
        if (commandStarted) {
          appendLog(message.data)
        }
      } else if (message.type === 'exit') {
        appendLog(`[进程已退出，退出码 ${message.code ?? 'null'}]`)
        running.value = false
      } else if (message.type === 'error') {
        appendLog(`[错误: ${message.message}]`)
      } else if (message.type === 'attached') {
        if (pendingCommand) {
          commandStarted = true
          wsConnection?.input(pendingCommand)
          pendingCommand = null
        }
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

const disconnectWs = () => {
  wsConnection?.dispose()
  wsConnection = null
  wsReady = false
}

const runCommand = async () => {
  const cmd = command.value.trim()
  if (!cmd) return

  errorMessage.value = ''
  clearLog()

  if (session) {
    try {
      await tasksApi.terminalRemove(props.taskId, session.id)
    } catch {
      // session may already be removed
    }
    wsConnection?.detach()
    session = null
  }

  try {
    commandStarted = false
    pendingCommand = `exec ${cmd}\n`
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
  if (!session) return

  try {
    await tasksApi.terminalStop(props.taskId, session.id)
  } catch {
    // already stopped
  }
  running.value = false
}

const restartCommand = async () => {
  await stopCommand()
  await nextTick()
  await runCommand()
}

const applyUrl = () => {
  const url = previewUrl.value.trim()
  if (!url) {
    iframeSrc.value = ''
  } else {
    iframeSrc.value =
      url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`
  }
}

const refreshPreview = () => {
  if (!iframeSrc.value) return
  const current = iframeSrc.value
  iframeSrc.value = ''
  nextTick(() => {
    iframeSrc.value = current
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
    configLoaded.value = false
    void loadConfig()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disconnectWs()

  if (saveTimer) clearTimeout(saveTimer)

  if (session && running.value) {
    void tasksApi.terminalStop(props.taskId, session.id)
  }
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <!-- Header -->
    <header class="border-border/70 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span
          class="inline-flex h-2 w-2 shrink-0 rounded-full"
          :class="running ? 'bg-green-500' : 'bg-muted-foreground/40'"
        />
        <span v-if="iframeSrc" class="text-foreground truncate text-xs">{{ iframeSrc }}</span>
        <span v-else class="text-muted-foreground text-xs">未配置预览地址</span>
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

    <!-- Config panel (collapsible) -->
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

    <!-- Log panel (collapsible, read-only) -->
    <div
      v-if="logOpen"
      class="border-border/70 shrink-0 border-b"
      style="height: 180px"
    >
      <div
        ref="logContainerRef"
        class="h-full overflow-auto bg-[#0f1115] px-3 py-2 font-mono text-xs leading-5 text-[#c7d2fe] select-text"
      >
        <div v-if="logLines.length === 0" class="text-muted-foreground italic">暂无日志</div>
        <div v-for="(line, i) in logLines" :key="i" class="whitespace-pre-wrap break-all">{{ line }}</div>
      </div>
    </div>

    <!-- Body: iframe preview -->
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
