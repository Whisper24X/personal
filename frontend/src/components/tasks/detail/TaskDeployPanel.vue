<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, nextTick } from 'vue'
import { projectsApi } from '@/api/projects'

const DEFAULT_DEPLOY_COMMAND = ''

const props = defineProps<{
  taskId: string
  projectId: string
  deployCommand?: string | null
}>()

type DeployStatus = 'idle' | 'running' | 'success' | 'failed'

const command = ref(props.deployCommand || DEFAULT_DEPLOY_COMMAND)
const status = ref<DeployStatus>('idle')
const logLines = ref<string[]>([])
const exitCode = ref<number | null>(null)
const featureBranch = ref<string | null>(null)
const logContainer = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

const scrollToBottom = () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

const appendLog = (text: string, prefix?: string) => {
  const lines = text.split('\n')
  for (const line of lines) {
    if (line) {
      logLines.value.push(prefix ? `${prefix} ${line}` : line)
    }
  }
  scrollToBottom()
}

const confirmAndDeploy = () => {
  if (status.value === 'running' || !command.value.trim()) return
  if (!confirm(`确认执行部署命令？\n\n${command.value.trim()}`)) return
  startDeploy()
}

const startDeploy = async () => {
  if (status.value === 'running' || !command.value.trim()) return

  logLines.value = []
  exitCode.value = null
  status.value = 'running'

  abortController = new AbortController()

  try {
    await projectsApi.deploy(props.projectId, props.taskId, command.value.trim(), {
      onEvent(event) {
        const data = (() => {
          try {
            return JSON.parse(event.data)
          } catch {
            return null
          }
        })()

        if (!data) return

        switch (event.event) {
          case 'deploy_start':
            if (data.featureBranch) featureBranch.value = data.featureBranch
            appendLog(`$ ${data.command}`)
            appendLog(`cwd: ${data.cwd}`)
            if (data.featureBranch) appendLog(`branch: ${data.featureBranch}`)
            appendLog('---')
            break
          case 'stdout':
            appendLog(data.text)
            break
          case 'stderr':
            appendLog(data.text, '[stderr]')
            break
          case 'deploy_error':
            appendLog(`[error] ${data.message}`, '[stderr]')
            break
          case 'deploy_end':
            exitCode.value = data.exitCode ?? -1
            if (data.aborted && !data.timedOut) {
              status.value = 'idle'
              appendLog('---')
              appendLog('部署已取消，分支已自动回滚')
            } else if (data.timedOut) {
              status.value = 'failed'
              appendLog('---')
              appendLog('部署超时（长时间无输出），进程已终止，分支已自动回滚')
            } else {
              status.value = data.exitCode === 0 ? 'success' : 'failed'
              appendLog('---')
              appendLog(
                data.exitCode === 0
                  ? '部署完成'
                  : `部署失败 (exit code: ${data.exitCode})`,
              )
            }
            if (data.error) {
              appendLog(`Error: ${data.error}`)
            }
            break
        }
      },
      onError(error) {
        if (error.name === 'AbortError') return
        status.value = 'failed'
        appendLog(`连接错误: ${error.message}`)
      },
      signal: abortController.signal,
    })
  } catch (error: any) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (status.value === 'running') {
      status.value = 'failed'
      if (error?.status === 409) {
        appendLog(error.message)
      } else {
        appendLog(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }
}

const cancelDeploy = () => {
  abortController?.abort()
  abortController = null
  if (status.value === 'running') {
    status.value = 'idle'
    appendLog('---')
    appendLog('已取消部署，后端正在终止进程并自动回滚分支状态...')
  }
}

onMounted(async () => {
  try {
    const info = await projectsApi.getDeployInfo(props.projectId, props.taskId)
    if (info.featureBranch) featureBranch.value = info.featureBranch
  } catch {
    /* non-critical, branch will still be detected on deploy */
  }
})

onBeforeUnmount(() => {
  abortController?.abort()
})

const statusLabel: Record<DeployStatus, string> = {
  idle: '',
  running: '部署中...',
  success: '部署成功',
  failed: '部署失败',
}

const statusClass: Record<DeployStatus, string> = {
  idle: '',
  running: 'text-yellow-500',
  success: 'text-green-500',
  failed: 'text-red-500',
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="shrink-0 space-y-3 border-b border-border/70 px-4 py-3">
      <div class="space-y-1">
        <span class="text-xs font-semibold text-muted-foreground">部署命令</span>
        <input
          v-model="command"
          :disabled="status === 'running'"
          type="text"
          class="h-8 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground disabled:opacity-50"
          placeholder="请输入部署命令，例如: make push-test"
        />
        <p v-if="featureBranch" class="text-[11px] text-muted-foreground/80">
          当前分支: <span class="font-mono font-semibold text-foreground/90">{{ featureBranch }}</span>
          (自动检测，将合并到 test)
        </p>
        <p class="text-[11px] text-muted-foreground/80">
          默认会在失败时尝试 <span class="font-mono">git merge --abort</span> 并切回执行前的分支，避免卡在 test 合并冲突状态。
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          v-if="status !== 'running'"
          type="button"
          class="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!command.trim()"
          @click="confirmAndDeploy"
        >
          部署到测试环境
        </button>
        <button
          v-else
          type="button"
          class="h-9 rounded-lg border border-destructive bg-background px-4 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
          @click="cancelDeploy"
        >
          取消部署
        </button>

        <span v-if="status !== 'idle'" class="text-xs font-medium" :class="statusClass[status]">
          {{ statusLabel[status] }}
        </span>
      </div>
    </div>

    <div
      ref="logContainer"
      class="min-h-0 flex-1 overflow-y-auto bg-[#1a1a2e] p-4 font-mono text-xs leading-5 text-green-300"
    >
      <div v-if="logLines.length === 0" class="text-muted-foreground/50">
        点击"部署到测试环境"开始执行部署命令...
      </div>
      <div v-for="(line, i) in logLines" :key="i" class="whitespace-pre-wrap break-all">
        {{ line }}
      </div>
    </div>
  </div>
</template>
