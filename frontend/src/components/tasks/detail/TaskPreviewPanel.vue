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

const terminalContainerRef = ref<HTMLDivElement | null>(null)
const splitContainerRef = ref<HTMLDivElement | null>(null)
const topPanelRef = ref<HTMLDivElement | null>(null)

const splitRatio = ref(50)

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
    fontSize: 13,
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

const navigatePreview = () => {
  const url = previewUrl.value.trim()
  if (!url) {
    iframeSrc.value = ''
    return
  }
  iframeSrc.value = url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`
}

const refreshPreview = () => {
  if (!iframeSrc.value) return
  const current = iframeSrc.value
  iframeSrc.value = ''
  nextTick(() => {
    iframeSrc.value = current
  })
}

let isDragging = false

const onDividerMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  isDragging = true
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging || !splitContainerRef.value) return
  const rect = splitContainerRef.value.getBoundingClientRect()
  const offset = e.clientY - rect.top
  const ratio = Math.min(Math.max((offset / rect.height) * 100, 15), 85)
  splitRatio.value = ratio
}

const onMouseUp = () => {
  isDragging = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  fitAddon?.fit()
}

watch(
  () => props.taskId,
  async () => {
    disconnectWs()
    session = null
    running.value = false
    terminal?.clear()
    await nextTick()
    initTerminal()
    connectWs()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disconnectWs()
  disposeTerminal()

  if (session && running.value) {
    void tasksApi.terminalStop(props.taskId, session.id)
  }

  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div ref="splitContainerRef" class="flex h-full min-w-0 flex-col">
    <!-- Top: Terminal -->
    <div ref="topPanelRef" class="flex min-h-0 flex-col" :style="{ flexBasis: splitRatio + '%', flexGrow: 0, flexShrink: 0 }">
      <header class="border-border/70 flex items-center gap-2 border-b px-3 py-2">
        <input
          v-model="command"
          type="text"
          placeholder="输入命令，如 npm run dev"
          class="border-border bg-background text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-md border px-2 text-xs outline-none focus:border-primary"
          @keydown.enter="runCommand"
        />
        <button
          v-if="!running"
          class="bg-primary text-primary-foreground h-7 shrink-0 rounded-md px-3 text-xs font-semibold"
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
      </header>

      <p v-if="errorMessage" class="px-3 py-1 text-xs text-destructive">{{ errorMessage }}</p>

      <div ref="terminalContainerRef" class="min-h-0 flex-1 bg-[#0f1115] p-1" />
    </div>

    <!-- Draggable divider -->
    <div
      class="border-border/70 hover:bg-primary/30 flex h-1.5 shrink-0 cursor-row-resize items-center justify-center border-y transition-colors"
      @mousedown="onDividerMouseDown"
    >
      <div class="bg-muted-foreground/40 h-0.5 w-8 rounded-full" />
    </div>

    <!-- Bottom: Preview iframe -->
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="border-border/70 flex items-center gap-2 border-b px-3 py-2">
        <input
          v-model="previewUrl"
          type="text"
          placeholder="输入预览地址，如 http://localhost:3000"
          class="border-border bg-background text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-md border px-2 text-xs outline-none focus:border-primary"
          @keydown.enter="navigatePreview"
        />
        <button
          class="bg-primary text-primary-foreground h-7 shrink-0 rounded-md px-3 text-xs font-semibold"
          type="button"
          @click="navigatePreview"
        >
          前往
        </button>
        <button
          v-if="iframeSrc"
          class="border-border bg-background text-foreground h-7 shrink-0 rounded-md border px-3 text-xs"
          type="button"
          @click="refreshPreview"
        >
          刷新
        </button>
      </header>

      <div class="min-h-0 flex-1">
        <iframe
          v-if="iframeSrc"
          :src="iframeSrc"
          class="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
        <div
          v-else
          class="text-muted-foreground flex h-full items-center justify-center text-sm"
        >
          输入地址并点击"前往"以预览页面
        </div>
      </div>
    </div>
  </div>
</template>
