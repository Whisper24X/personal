<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { openSseStream } from '@/api/http'
import { tasksApi } from '@/api/tasks'
import type { TaskTerminalEvent, TaskTerminalSession } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'

const props = defineProps<{
  taskId: string
}>()

const sessions = ref<TaskTerminalSession[]>([])
const loading = ref(false)
const errorMessage = ref('')
const creating = ref(false)
const activeSessionId = ref<string | null>(null)
const inputValue = ref('')
const outputMap = ref<Record<string, string>>({})

let streamAbortController: AbortController | null = null

const activeSession = computed(() => {
  if (!activeSessionId.value) {
    return null
  }

  return sessions.value.find((session) => session.id === activeSessionId.value) ?? null
})

const activeOutput = computed(() => {
  if (!activeSessionId.value) {
    return ''
  }

  return outputMap.value[activeSessionId.value] || ''
})

const disconnectStream = () => {
  if (streamAbortController) {
    streamAbortController.abort()
    streamAbortController = null
  }
}

const appendOutput = (sessionId: string, text: string) => {
  const current = outputMap.value[sessionId] || ''
  const next = `${current}${text}`
  outputMap.value = {
    ...outputMap.value,
    [sessionId]: next.slice(-200_000),
  }
}

const connectStream = async (sessionId: string) => {
  disconnectStream()

  streamAbortController = new AbortController()

  await openSseStream(
    `/tasks/${props.taskId}/terminal/sessions/${sessionId}/stream`,
    undefined,
    {
      signal: streamAbortController.signal,
      onEvent: (event) => {
        if (event.event && event.event !== 'task-terminal') {
          return
        }

        try {
          const payload = JSON.parse(event.data) as TaskTerminalEvent

          if (payload.type === 'chunk' && payload.data) {
            appendOutput(sessionId, payload.data)
            return
          }

          if (payload.type === 'error' && payload.message) {
            appendOutput(sessionId, `\n[error] ${payload.message}\n`)
            return
          }

          if (payload.type === 'exit') {
            appendOutput(sessionId, `\n[exit] code=${payload.code ?? 'null'} signal=${payload.signal ?? '-'}\n`)
            void loadSessions()
          }
        } catch {
          // ignore malformed SSE payload
        }
      },
      onError: () => {
        // keep panel usable even when stream reconnect fails
      },
    },
  )
}

const loadSessions = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await tasksApi.listTerminalSessions(props.taskId)
    sessions.value = response.sessions
    const firstSession = response.sessions[0] ?? null

    if (!activeSessionId.value && firstSession) {
      activeSessionId.value = firstSession.id
    }

    if (
      activeSessionId.value &&
      !response.sessions.some((session) => session.id === activeSessionId.value)
    ) {
      activeSessionId.value = firstSession?.id || null
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
    const session = await tasksApi.createTerminalSession(props.taskId)
    sessions.value = [...sessions.value, session]
    activeSessionId.value = session.id
    outputMap.value = {
      ...outputMap.value,
      [session.id]: outputMap.value[session.id] || '',
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '创建终端会话失败')
  } finally {
    creating.value = false
  }
}

const sendInput = async () => {
  if (!activeSessionId.value || !inputValue.value.trim()) {
    return
  }

  const input = inputValue.value

  try {
    await tasksApi.terminalInput(props.taskId, activeSessionId.value, {
      input,
    })

    appendOutput(activeSessionId.value, input)
    inputValue.value = ''
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '发送输入失败')
  }
}

const stopActiveSession = async () => {
  if (!activeSessionId.value) {
    return
  }

  try {
    await tasksApi.terminalStop(props.taskId, activeSessionId.value)
    await loadSessions()
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '停止终端失败')
  }
}

watch(
  () => props.taskId,
  async () => {
    disconnectStream()
    activeSessionId.value = null
    outputMap.value = {}
    await loadSessions()
  },
  {
    immediate: true,
  },
)

watch(
  () => activeSessionId.value,
  async (sessionId) => {
    if (!sessionId) {
      disconnectStream()
      return
    }

    await connectStream(sessionId)
  },
)

onBeforeUnmount(() => {
  disconnectStream()
  const runningSessionIds = sessions.value
    .filter((session) => session.status === 'running')
    .map((session) => session.id)

  if (runningSessionIds.length === 0) {
    return
  }

  void Promise.allSettled(
    runningSessionIds.map((sessionId) => {
      return tasksApi.terminalStop(props.taskId, sessionId)
    }),
  )
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header class="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-2">
      <div class="text-xs">
        <p class="text-muted-foreground">Terminal</p>
        <p class="text-foreground">{{ activeSession?.shell || '-' }}</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="h-7 rounded-md border border-border bg-background px-2 text-xs"
          :disabled="creating"
          type="button"
          @click="createSession"
        >
          {{ creating ? '创建中...' : '新建会话' }}
        </button>
        <button class="h-7 rounded-md border border-border bg-background px-2 text-xs" type="button" @click="loadSessions">
          刷新
        </button>
      </div>
    </header>

    <div class="border-border/70 flex items-center gap-1 overflow-x-auto border-b px-2 py-1">
      <button
        v-for="session in sessions"
        :key="session.id"
        class="h-7 rounded-md border px-2 text-xs"
        :class="activeSessionId === session.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'"
        type="button"
        @click="activeSessionId = session.id"
      >
        {{ session.id.slice(0, 8) }} · {{ session.status }}
      </button>
    </div>

    <div class="relative min-h-0 flex-1 bg-[#0f1115]">
      <pre class="h-full overflow-auto p-3 text-xs text-[#c7d2fe]">{{ activeOutput || (loading ? 'Loading...' : '请选择或创建终端会话') }}</pre>
    </div>

    <footer class="border-border/70 border-t px-3 py-2">
      <p v-if="errorMessage" class="mb-2 text-xs text-destructive">{{ errorMessage }}</p>

      <div class="flex items-center gap-2">
        <input
          v-model="inputValue"
          class="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          placeholder="输入命令，例如 ls -la\n"
          type="text"
          @keydown.enter.prevent="sendInput"
        />
        <button class="h-8 rounded-md border border-border bg-background px-2 text-xs" type="button" @click="sendInput">发送</button>
        <button class="h-8 rounded-md bg-destructive px-2 text-xs text-destructive-foreground" type="button" @click="stopActiveSession">停止</button>
      </div>
    </footer>
  </div>
</template>
