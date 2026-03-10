<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { tasksApi } from '@/api/tasks'
import type { TaskTerminalSession } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { TerminalWsConnection } from '@/utils/ws/terminal-ws'

const props = defineProps<{
  taskId: string
}>()

const command = ref('')
const previewUrl = ref('')
const iframeSrc = ref('')
const errorMessage = ref('')
const running = ref(false)
const configOpen = ref(false)
const logOpen = ref(false)

const terminalContainerRef = ref<HTMLDivElement | null>(null)

let session: TaskTerminalSession | null = null
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let wsConnection: TerminalWsConnection | null = null
let wsReady = false

const initTerminal = () => {
  if (terminal) return

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#0f1115',
      foreground: '#c7d2fe',
      cursor: '#c7d2fe',
      selectionBackground: '#364154',
    },
    scrollback: 5000,
    convertEol: true,
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  if (terminalContainerRef.value) {
    terminal.open(terminalContainerRef.value)
    fitAddon.fit()
  }

  terminal.onData((data: string) => {
    wsConnection?.input(data)
  })

  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
    if (terminal && wsConnection?.isOpen) {
      wsConnection.resize(terminal.cols, terminal.rows)
    }
  })

  if (terminalContainerRef.value) {
    resizeObserver.observe(terminalContainerRef.value)
  }
}

const disposeTerminal = () => {
  resizeObserver?.disconnect()
  resizeObserver = null
  terminal?.dispose()
  terminal = null
  fitAddon = null
}

const connectWs = () => {
  disconnectWs()

  wsConnection = new TerminalWsConnection({
    onMessage: (message) => {
      if (message.type === 'output') {
        terminal?.write(message.data)
      } else if (message.type === 'exit') {
        terminal?.write(
          `\r\n\x1b[90m[Process exited with code ${message.code ?? 'null'}]\x1b[0m\r\n`,
        )
        running.value = false
      } else if (message.type === 'error') {
        terminal?.write(`\r\n\x1b[31m[Error: ${message.message}]\x1b[0m\r\n`)
      } else if (message.type === 'attached') {
        if (terminal && wsConnection?.isOpen) {
          wsConnection.resize(terminal.cols, terminal.rows)
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
  terminal?.clear()

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
    const cols = terminal?.cols ?? 80
    const rows = terminal?.rows ?? 24
    session = await tasksApi.createTerminalSession(props.taskId, { cols, rows })
    running.value = true

    if (wsReady && wsConnection) {
      wsConnection.attach(props.taskId, session.id)
    }

    await nextTick()
    wsConnection?.input(cmd + '\n')
  } catch (error) {
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

const applyConfig = () => {
  const url = previewUrl.value.trim()
  if (!url) {
    iframeSrc.value = ''
  } else {
    iframeSrc.value =
      url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`
  }
  configOpen.value = false
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
  if (configOpen.value) {
    nextTick(() => {
      initTerminal()
    })
  }
}

const toggleLog = () => {
  logOpen.value = !logOpen.value
  if (logOpen.value) {
    nextTick(() => {
      initTerminal()
      fitAddon?.fit()
    })
  }
}

watch(
  () => props.taskId,
  () => {
    disconnectWs()
    session = null
    running.value = false
    terminal?.clear()
    nextTick(() => {
      connectWs()
      if (configOpen.value || logOpen.value) {
        initTerminal()
      }
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disconnectWs()
  disposeTerminal()

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
            @keydown.enter="applyConfig"
          />
          <button
            v-if="!running"
            class="bg-primary text-primary-foreground h-7 shrink-0 rounded-md px-3 text-xs font-semibold disabled:opacity-40"
            type="button"
            :disabled="!command.trim()"
            @click="runCommand"
          >
            运行
          </button>
          <button
            v-else
            class="bg-destructive text-destructive-foreground h-7 shrink-0 rounded-md px-3 text-xs font-semibold"
            type="button"
            @click="stopCommand"
          >
            停止
          </button>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-muted-foreground w-16 shrink-0 text-xs">预览地址</label>
          <input
            v-model="previewUrl"
            type="text"
            placeholder="例如 http://localhost:3000"
            class="border-border bg-background text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-md border px-2 text-xs outline-none focus:border-primary"
            @keydown.enter="applyConfig"
          />
          <button
            class="bg-primary text-primary-foreground h-7 shrink-0 rounded-md px-3 text-xs font-semibold"
            type="button"
            @click="applyConfig"
          >
            应用
          </button>
        </div>
      </div>
      <p v-if="errorMessage" class="mt-1.5 text-xs text-destructive">{{ errorMessage }}</p>
    </div>

    <!-- Log panel (collapsible) -->
    <div
      v-show="logOpen"
      class="border-border/70 shrink-0 border-b"
      style="height: 180px"
    >
      <div ref="terminalContainerRef" class="h-full bg-[#0f1115] p-1" />
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
