<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { tasksApi } from '@/api/tasks'
import { STORAGE_KEYS } from '@/types/common/storage'
import type { TaskTerminalSession } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { TerminalWsConnection } from '@/utils/ws/terminal-ws'

const props = defineProps<{
  taskId: string
}>()

const sessions = ref<TaskTerminalSession[]>([])
const loading = ref(false)
const errorMessage = ref('')
const creating = ref(false)
const activeSessionId = ref<string | null>(null)

const terminalContainerRef = ref<HTMLDivElement | null>(null)

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let wsConnection: TerminalWsConnection | null = null
let wsReady = false
let attachedSessionId: string | null = null

const getTaskTerminalSessionStorageKey = (taskId: string) => {
  return `${STORAGE_KEYS.taskDetailTerminalSessionId}:${taskId}`
}

const persistActiveSessionId = (taskId: string, sessionId: string | null) => {
  const storageKey = getTaskTerminalSessionStorageKey(taskId)
  if (sessionId) {
    sessionStorage.setItem(storageKey, sessionId)
    return
  }

  sessionStorage.removeItem(storageKey)
}

const restoreActiveSessionId = (taskId: string) => {
  return sessionStorage.getItem(getTaskTerminalSessionStorageKey(taskId))
}

const initTerminal = () => {
  if (terminal) {
    return
  }

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
        terminal?.write(`\r\n\x1b[90m[Process exited with code ${message.code ?? 'null'}]\x1b[0m\r\n`)
        void loadSessions()
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
      if (activeSessionId.value) {
        attachToSession(activeSessionId.value)
      }
    },
    onClose: () => {
      wsReady = false
      attachedSessionId = null
    },
  })

  wsConnection.connect()
}

const disconnectWs = () => {
  wsConnection?.dispose()
  wsConnection = null
  wsReady = false
  attachedSessionId = null
}

const resetTerminalDisplay = () => {
  terminal?.reset()
}

const attachToSession = (sessionId: string) => {
  if (!wsReady || !wsConnection || attachedSessionId === sessionId) {
    return
  }

  resetTerminalDisplay()
  wsConnection.attach(props.taskId, sessionId)
  attachedSessionId = sessionId
}

const loadSessions = async ({ autoCreate = false } = {}) => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await tasksApi.listTerminalSessions(props.taskId)
    sessions.value = response.sessions
    const firstSession = response.sessions[0] ?? null
    const persistedSessionId = restoreActiveSessionId(props.taskId)

    if (!activeSessionId.value && persistedSessionId) {
      activeSessionId.value = persistedSessionId
    }

    if (!activeSessionId.value && firstSession) {
      activeSessionId.value = firstSession.id
    }

    if (
      activeSessionId.value &&
      !response.sessions.some((session) => session.id === activeSessionId.value)
    ) {
      activeSessionId.value = firstSession?.id || null
    }

    persistActiveSessionId(props.taskId, activeSessionId.value)

    if (autoCreate && sessions.value.length === 0) {
      loading.value = false
      await createSession()
      return
    }
  } catch (error) {
    sessions.value = []
    errorMessage.value = toErrorMessage(error, '加载终端会话失败')
  } finally {
    loading.value = false
  }
}

const createSession = async () => {
  creating.value = true

  try {
    const cols = terminal?.cols ?? 80
    const rows = terminal?.rows ?? 24
    const session = await tasksApi.createTerminalSession(props.taskId, { cols, rows })
    sessions.value = [...sessions.value, session]
    activeSessionId.value = session.id
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '创建终端会话失败')
  } finally {
    creating.value = false
  }
}

const closeSession = async (sessionId: string) => {
  try {
    await tasksApi.terminalRemove(props.taskId, sessionId)
  } catch {
    // session may already be removed
  }

  sessions.value = sessions.value.filter((s) => s.id !== sessionId)

  if (activeSessionId.value === sessionId) {
    activeSessionId.value = sessions.value[0]?.id ?? null
  }

  persistActiveSessionId(props.taskId, activeSessionId.value)
}

watch(
  () => props.taskId,
  async () => {
    disconnectWs()
    activeSessionId.value = null
    await loadSessions({ autoCreate: true })
    await nextTick()
    initTerminal()
    connectWs()
  },
  { immediate: true },
)

watch(
  () => activeSessionId.value,
  (sessionId) => {
    persistActiveSessionId(props.taskId, sessionId)

    if (!sessionId) {
      wsConnection?.detach()
      attachedSessionId = null
      resetTerminalDisplay()
      return
    }

    attachToSession(sessionId)
  },
)

onBeforeUnmount(() => {
  disconnectWs()
  disposeTerminal()
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header class="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-2">
      <div class="flex items-center gap-1 overflow-x-auto">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs"
          :class="activeSessionId === session.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'"
          role="button"
          tabindex="0"
          @click="activeSessionId = session.id"
          @keydown.enter="activeSessionId = session.id"
        >
          <span>终端 {{ sessions.indexOf(session) + 1 }}</span>
          <button
            class="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm opacity-60 transition-opacity hover:opacity-100"
            type="button"
            title="关闭会话"
            @click.stop="closeSession(session.id)"
          >
            &#x2715;
          </button>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          class="h-7 rounded-md border border-border bg-background px-2 text-xs"
          :disabled="creating"
          type="button"
          @click="createSession"
        >
          {{ creating ? '创建中...' : '新建会话' }}
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="px-3 py-1 text-xs text-destructive">{{ errorMessage }}</p>

    <div ref="terminalContainerRef" class="min-h-0 flex-1 bg-[#0f1115] p-1" />
  </div>
</template>
