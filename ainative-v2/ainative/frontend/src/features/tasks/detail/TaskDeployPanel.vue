<script setup lang="ts">
/* eslint-disable max-lines */
import { ref, onBeforeUnmount, onMounted, nextTick, computed } from 'vue'
import { projectsApi } from '@/api/projects'
import { HttpError } from '@api/shared/error'
import type { SubtreeDeployStatus, SubtreeDeployItem } from '@/types/api/projects'

const DEFAULT_DEPLOY_COMMAND = 'make push-test'

const props = defineProps<{
  taskId: string
  projectId: string
  deployCommand?: string | null
}>()

type DeployStatus = 'idle' | 'running' | 'success' | 'failed'
type DeployMode = 'loading' | 'classic' | 'subtree' | 'workspace-native'

const deployMode = ref<DeployMode>('loading')
const command = ref(props.deployCommand || DEFAULT_DEPLOY_COMMAND)
const status = ref<DeployStatus>('idle')
const logLines = ref<string[]>([])
const exitCode = ref<number | null>(null)
const featureBranch = ref<string | null>(null)
const logContainer = ref<HTMLElement | null>(null)
const showConfirm = ref(false)
let abortController: AbortController | null = null

const subtreeInfo = ref<{
  gitPhase?: string
  deployStatus?: SubtreeDeployStatus
  subtreeConfigs?: Array<{ url: string; prefix: string; branch: string }>
  canDeploy: boolean
}>({ canDeploy: false })

const subtreeItems = ref<SubtreeDeployItem[]>([])
const showForceConfirm = ref(false)

const wsNativeInfo = ref<{
  featureBranch?: string
  subRepos?: Array<{ url: string; prefix: string; branch: string }>
  deployStatus?: import('@/types/api/tasks').WorkspaceNativeDeployStatus
}>({})

const wsNativeTargetBranches = ref<Record<string, string>>({})

const DANGEROUS_BRANCHES = ['master', 'main']

const resolveTargetBranch = (prefix: string): string => {
  const userValue = wsNativeTargetBranches.value[prefix]?.trim()
  return userValue || ''
}

const wsNativeDeployBranches = computed(() => {
  return wsNativeInfo.value.deployStatus?.subRepoPushResults ?? []
})

const getSubRepoStatus = (prefix: string): 'success' | 'failed' | 'pending' | 'skipped' => {
  const item = wsNativeDeployBranches.value.find((b) => b.prefix === prefix)
  if (!item) return 'pending'
  if (item.status === 'success') return 'success'
  if (item.status === 'failed') return 'failed'
  if (item.status === 'skipped') return 'skipped'
  return 'pending'
}

const getSubRepoStatusIcon = (prefix: string): string => {
  const s = getSubRepoStatus(prefix)
  if (s === 'success') return '✓'
  if (s === 'failed') return '✗'
  if (s === 'skipped') return '–'
  return '○'
}

const getSubRepoStatusLabel = (prefix: string): string => {
  const s = getSubRepoStatus(prefix)
  if (s === 'success') return '已推送'
  if (s === 'failed') return '失败'
  if (s === 'skipped') return '无变化'
  return '待推送'
}

const isRetry = computed(
  () =>
    subtreeInfo.value.gitPhase === 'deploy_pending' ||
    subtreeInfo.value.gitPhase === 'cleanup_pending',
)

const getErrorStatus = (error: unknown) => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null
  return typeof error.status === 'number' ? error.status : null
}

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

// ─── Classic deploy (make push-test) ────────────────────────────────────────

const confirmAndDeploy = () => {
  if (status.value === 'running' || !command.value.trim()) return
  showConfirm.value = true
}

const onConfirmed = () => {
  showConfirm.value = false
  startClassicDeploy()
}

const onCancelConfirm = () => {
  showConfirm.value = false
}

const startClassicDeploy = async () => {
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
            status.value = 'failed'
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
              appendLog(data.exitCode === 0 ? '部署完成' : `部署失败 (exit code: ${data.exitCode})`)
            }
            if (data.error) appendLog(`Error: ${data.error}`)
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
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (status.value === 'running') {
      status.value = 'failed'
      if (
        error instanceof Error &&
        (getErrorStatus(error) === 409 || (error instanceof HttpError && error.status === 409))
      ) {
        appendLog(error.message)
      } else {
        appendLog(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }
}

// ─── Subtree deploy ─────────────────────────────────────────────────────────

const startSubtreeDeploy = async (force = false) => {
  if (status.value === 'running') return

  logLines.value = []
  status.value = 'running'

  if (subtreeInfo.value.deployStatus?.subtrees) {
    subtreeItems.value = subtreeInfo.value.deployStatus.subtrees.map((s) => ({ ...s }))
  } else if (subtreeInfo.value.subtreeConfigs) {
    subtreeItems.value = subtreeInfo.value.subtreeConfigs.map((c) => ({
      prefix: c.prefix,
      targetBranch: c.branch,
      sourceCommitSha: '',
      status: 'pending' as const,
      attempts: 0,
    }))
  }

  abortController = new AbortController()

  try {
    await projectsApi.deploySubtrees(props.projectId, props.taskId, force || undefined, {
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
            appendLog(`[deploy] 开始部署 (${data.isRetry ? '重试' : '首次'})`)
            if (data.subtreeCount) appendLog(`[deploy] 子仓数量: ${data.subtreeCount}`)
            appendLog('---')
            break

          case 'deploy_step':
            appendLog(`[${data.step}] ${data.message}`)
            break

          case 'deploy_subtree': {
            const item = subtreeItems.value.find((s) => s.prefix === data.prefix)
            if (item) {
              item.status = data.status
              if (data.error) item.error = data.error
              if (data.skippedReason) item.skippedReason = data.skippedReason
            }
            const statusText =
              data.status === 'success'
                ? '✓ 推送成功'
                : data.status === 'skipped'
                  ? '○ 无变化，已跳过'
                  : data.status === 'failed'
                    ? `✗ 推送失败: ${data.error || '未知错误'}`
                    : data.status
            appendLog(`[${data.prefix}] ${statusText}`)
            break
          }

          case 'deploy_error':
            status.value = 'failed'
            appendLog(`[error] ${data.message}`, '[stderr]')
            break

          case 'deploy_end':
            appendLog('---')
            if (data.success) {
              status.value = 'success'
              appendLog('部署完成，所有子仓已推送，主仓已清理')
            } else {
              status.value = 'failed'
              appendLog(`部署未完成: ${data.error || '部分子仓推送失败'}`)
            }
            refreshSubtreeInfo()
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
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (status.value === 'running') {
      status.value = 'failed'
      if (
        error instanceof Error &&
        (getErrorStatus(error) === 409 || (error instanceof HttpError && error.status === 409))
      ) {
        appendLog(error.message)
      } else {
        appendLog(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }
}

const confirmSubtreeDeploy = () => {
  if (status.value === 'running') return
  showConfirm.value = true
}

const onSubtreeConfirmed = () => {
  showConfirm.value = false
  startSubtreeDeploy(false)
}

const confirmForceOverwrite = () => {
  showForceConfirm.value = true
}

const onForceConfirmed = () => {
  showForceConfirm.value = false
  startSubtreeDeploy(true)
}

const refreshSubtreeInfo = async () => {
  try {
    const info = await projectsApi.getSubtreeDeployInfo(props.projectId, props.taskId)
    if (info.enabled) {
      subtreeInfo.value = info
      if (info.deployStatus?.subtrees) {
        subtreeItems.value = info.deployStatus.subtrees.map((s) => ({ ...s }))
      }
    }
  } catch {
    /* non-critical */
  }
}

// ─── Workspace-native deploy ────────────────────────────────────────────────

const showDangerConfirm = ref(false)
const dangerBranches = ref<string[]>([])

const allTargetBranchesFilled = computed(() => {
  const subRepos = wsNativeInfo.value.subRepos ?? []
  if (subRepos.length === 0) return false
  return subRepos.every((repo) => resolveTargetBranch(repo.prefix).length > 0)
})

const confirmWsNativeDeploy = () => {
  if (status.value === 'running') return
  if (!allTargetBranchesFilled.value) return

  const subRepos = wsNativeInfo.value.subRepos ?? []
  const dangerous: string[] = []
  for (const repo of subRepos) {
    const target = resolveTargetBranch(repo.prefix)
    if (DANGEROUS_BRANCHES.includes(target)) {
      dangerous.push(`${repo.prefix} → ${target}`)
    }
  }

  if (dangerous.length > 0) {
    dangerBranches.value = dangerous
    showDangerConfirm.value = true
    return
  }

  showConfirm.value = true
}

const onDangerConfirmed = () => {
  showDangerConfirm.value = false
  dangerBranches.value = []
  showConfirm.value = false
  startWsNativeDeploy()
}

const onDangerCancel = () => {
  showDangerConfirm.value = false
  dangerBranches.value = []
}

const onWsNativeConfirmed = () => {
  showConfirm.value = false
  startWsNativeDeploy()
}

const startWsNativeDeploy = async () => {
  if (status.value === 'running') return

  logLines.value = []

  const branches: Record<string, string> = {}
  const subRepos = wsNativeInfo.value.subRepos ?? []
  for (const repo of subRepos) {
    const target = resolveTargetBranch(repo.prefix)
    if (target) {
      branches[repo.prefix] = target
    }
  }

  status.value = 'running'
  abortController = new AbortController()

  try {

    await projectsApi.deployWorkspaceNative(
      props.projectId,
      props.taskId,
      {
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
              appendLog(`[deploy] 开始多仓部署`)
              if (data.subRepoCount) appendLog(`[deploy] 子仓数量: ${data.subRepoCount}`)
              appendLog('---')
              break

            case 'deploy_step':
              appendLog(`[${data.prefix || data.step}] ${data.message}`)
              break

            case 'deploy_log':
              appendLog(`  [${data.prefix}] ${data.text}`)
              break

            case 'deploy_subrepo': {
              const statusText =
                data.status === 'success'
                  ? `✓ 已推送到 ${data.branch || '目标分支'}`
                  : data.status === 'skipped'
                    ? '○ 无文件变更，已跳过'
                    : data.status === 'failed'
                      ? `✗ 推送失败: ${data.error || '未知错误'}`
                      : data.status
              appendLog(`[${data.prefix}] ${statusText}`)
              break
            }

            case 'deploy_error':
              status.value = 'failed'
              appendLog(`[error] ${data.message}`, '[stderr]')
              break

            case 'deploy_end':
              appendLog('---')
              if (data.success) {
                status.value = 'success'
                appendLog('部署完成，所有子仓已合并到各自目标分支')
              } else {
                status.value = 'failed'
                appendLog(`部署未完成: ${data.error || '部分子仓推送失败'}`)
              }
              refreshWsNativeInfo()
              break
          }
        },
        onError(error) {
          if (error.name === 'AbortError') return
          status.value = 'failed'
          appendLog(`连接错误: ${error.message}`)
        },
        signal: abortController.signal,
      },
      { targetBranches: branches },
    )
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (status.value === 'running') {
      status.value = 'failed'
      if (
        error instanceof Error &&
        (getErrorStatus(error) === 409 || (error instanceof HttpError && error.status === 409))
      ) {
        appendLog(error.message)
      } else {
        appendLog(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }
}

const refreshWsNativeInfo = async () => {
  try {
    const info = await projectsApi.getWorkspaceNativeDeployInfo(props.projectId, props.taskId)
    if (info.enabled) {
      wsNativeInfo.value = info
    }
  } catch {
    /* non-critical */
  }
}

// ─── Shared ─────────────────────────────────────────────────────────────────

const cancelDeploy = () => {
  abortController?.abort()
  abortController = null
  if (status.value === 'running') {
    status.value = 'idle'
    appendLog('---')
    appendLog('已取消部署')
  }
}

const wsNativeError = ref<string | null>(null)

onMounted(async () => {
  try {
    const info = await projectsApi.getWorkspaceNativeDeployInfo(props.projectId, props.taskId)
    if (info.enabled) {
      deployMode.value = 'workspace-native'
      wsNativeInfo.value = info
      if (info.error) {
        wsNativeError.value = info.errorMessage || '任务快照未就绪，无法部署'
      }
      if (info.featureBranch) featureBranch.value = info.featureBranch
      return
    }
  } catch (error) {
    if (getErrorStatus(error) !== 404) {
      appendLog(`[error] 部署模式探测失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return
    }
  }

  try {
    const info = await projectsApi.getSubtreeDeployInfo(props.projectId, props.taskId)
    if (info.enabled) {
      deployMode.value = 'subtree'
      subtreeInfo.value = info
      if (info.deployStatus?.subtrees) {
        subtreeItems.value = info.deployStatus.subtrees.map((s) => ({ ...s }))
      }
      return
    }
  } catch (error) {
    if (getErrorStatus(error) !== 404) {
      appendLog(`[error] 部署模式探测失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return
    }
  }

  deployMode.value = 'classic'
  try {
    const info = await projectsApi.getDeployInfo(props.projectId, props.taskId)
    if (info.featureBranch) featureBranch.value = info.featureBranch
  } catch {
    /* classic info is non-critical */
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

const subtreeStatusIcon: Record<string, string> = {
  pending: '○',
  pushing: '◉',
  success: '✓',
  failed: '✗',
  skipped: '–',
}

const subtreeStatusClass: Record<string, string> = {
  pending: 'text-muted-foreground',
  pushing: 'text-yellow-500',
  success: 'text-green-500',
  failed: 'text-red-500',
  skipped: 'text-muted-foreground/70',
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Loading -->
    <div v-if="deployMode === 'loading'" class="flex items-center justify-center p-8">
      <span class="text-xs text-muted-foreground">加载部署配置...</span>
    </div>

    <!-- ─── Subtree Deploy Mode ──────────────────────────────────────────── -->
    <template v-else-if="deployMode === 'subtree'">
      <div class="shrink-0 space-y-3 border-b border-border/70 px-4 py-3">
        <div class="space-y-2">
          <span class="text-xs font-semibold text-muted-foreground">Snapshot-Sync 部署</span>

          <!-- Subtree status cards -->
          <div v-if="subtreeItems.length > 0" class="space-y-1.5">
            <div
              v-for="item in subtreeItems"
              :key="item.prefix"
              class="flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-xs"
            >
              <span class="font-semibold" :class="subtreeStatusClass[item.status]">
                {{ subtreeStatusIcon[item.status] }}
              </span>
              <span class="font-mono font-medium text-foreground">{{ item.prefix }}</span>
              <span class="text-muted-foreground">→</span>
              <span class="font-mono text-muted-foreground">{{ item.targetBranch }}</span>
              <span class="ml-auto text-[10px]" :class="subtreeStatusClass[item.status]">
                <template v-if="item.status === 'success'">已推送</template>
                <template v-else-if="item.status === 'skipped'">无变化</template>
                <template v-else-if="item.status === 'failed'">{{ item.error || '失败' }}</template>
                <template v-else-if="item.status === 'pushing'">推送中...</template>
                <template v-else>待推送</template>
              </span>
            </div>
          </div>

          <p v-if="subtreeInfo.gitPhase" class="text-[11px] text-muted-foreground/80">
            Git 阶段:
            <span class="font-mono font-semibold text-foreground/90">{{
              subtreeInfo.gitPhase
            }}</span>
            <span v-if="isRetry" class="ml-1 text-yellow-500">（可重试）</span>
          </p>
        </div>

        <div class="flex items-center gap-3">
          <template v-if="status === 'running'">
            <button
              type="button"
              class="h-9 rounded-lg border border-destructive bg-background px-4 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
              @click="cancelDeploy"
            >
              取消部署
            </button>
          </template>
          <template v-else-if="showConfirm">
            <span class="text-xs font-medium text-yellow-500"
              >确认执行{{ isRetry ? '重试' : '' }}部署？</span
            >
            <button
              type="button"
              class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              @click="onSubtreeConfirmed"
            >
              确认
            </button>
            <button
              type="button"
              class="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              @click="onCancelConfirm"
            >
              取消
            </button>
          </template>
          <template v-else-if="showForceConfirm">
            <span class="text-xs font-medium text-red-500"
              >⚠️ 确认强制覆盖远端？此操作不可撤销。</span
            >
            <button
              type="button"
              class="h-8 rounded-md bg-red-600 px-3 text-xs font-semibold text-white transition hover:opacity-90"
              @click="onForceConfirmed"
            >
              确认强制覆盖
            </button>
            <button
              type="button"
              class="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              @click="showForceConfirm = false"
            >
              取消
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!subtreeInfo.canDeploy"
              @click="confirmSubtreeDeploy"
            >
              {{ isRetry ? '重试部署' : '部署子仓' }}
            </button>
            <button
              v-if="isRetry && subtreeItems.some((s) => s.status === 'failed')"
              type="button"
              class="h-9 rounded-lg border border-red-500/50 bg-background px-4 text-xs font-semibold text-red-500 transition hover:bg-red-500/10"
              @click="confirmForceOverwrite"
            >
              强制覆盖
            </button>
          </template>

          <span v-if="status !== 'idle'" class="text-xs font-medium" :class="statusClass[status]">
            {{ statusLabel[status] }}
          </span>
        </div>
      </div>
    </template>

    <!-- ─── Workspace-Native Deploy Mode ───────────────────────────────── -->
    <template v-else-if="deployMode === 'workspace-native'">
      <div v-if="wsNativeError" class="flex items-center justify-center p-8">
        <div class="text-center">
          <p class="text-sm font-medium text-destructive">无法部署</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ wsNativeError }}</p>
        </div>
      </div>
      <div v-else class="shrink-0 space-y-3 border-b border-border/70 px-4 py-3">
        <div class="space-y-2">
          <span class="text-xs font-semibold text-muted-foreground">多仓部署</span>

          <div
            v-if="wsNativeInfo.subRepos && wsNativeInfo.subRepos.length > 0"
            class="space-y-1.5"
          >
            <div
              v-for="repo in wsNativeInfo.subRepos"
              :key="repo.prefix"
              class="flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-xs"
            >
              <span
                class="font-semibold"
                :class="subtreeStatusClass[getSubRepoStatus(repo.prefix)]"
              >
                {{ getSubRepoStatusIcon(repo.prefix) }}
              </span>
              <span class="font-mono font-medium text-foreground">{{ repo.prefix }}</span>
              <span class="text-muted-foreground">→</span>
              <input
                :value="wsNativeTargetBranches[repo.prefix] ?? ''"
                :disabled="status === 'running'"
                type="text"
                class="h-6 w-32 rounded border border-border bg-background px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50"
                placeholder="目标分支 (如 test, develop)"
                @input="
                  wsNativeTargetBranches[repo.prefix] = ($event.target as HTMLInputElement).value
                "
              />
              <span
                class="ml-auto text-[10px]"
                :class="subtreeStatusClass[getSubRepoStatus(repo.prefix)]"
              >
                {{ getSubRepoStatusLabel(repo.prefix) }}
              </span>
            </div>
          </div>

          <p class="text-[11px] leading-relaxed text-muted-foreground/80">
            请为每个子仓填写部署目标分支（如 test、develop）。所有子仓都必须填写才能开始部署。填写 master/main 会触发二次确认。
          </p>
        </div>

        <div class="flex items-center gap-3">
          <template v-if="status === 'running'">
            <button
              type="button"
              class="h-9 rounded-lg border border-destructive bg-background px-4 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
              @click="cancelDeploy"
            >
              取消部署
            </button>
          </template>
          <template v-else-if="showDangerConfirm">
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-destructive">⚠️ 危险操作：以下部署目标为生产分支</span>
              <span v-for="b in dangerBranches" :key="b" class="pl-2 font-mono text-[11px] text-destructive/80">{{ b }}</span>
            </div>
            <button
              type="button"
              class="h-8 rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"
              @click="onDangerConfirmed"
            >
              我确认要推到生产分支
            </button>
            <button
              type="button"
              class="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              @click="onDangerCancel"
            >
              取消
            </button>
          </template>
          <template v-else-if="showConfirm">
            <span class="text-xs font-medium text-yellow-500">确认部署到各子仓目标分支？</span>
            <button
              type="button"
              class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              @click="onWsNativeConfirmed"
            >
              确认
            </button>
            <button
              type="button"
              class="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              @click="onCancelConfirm"
            >
              取消
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!allTargetBranchesFilled"
              @click="confirmWsNativeDeploy"
            >
              开始部署
            </button>
            <span v-if="!allTargetBranchesFilled" class="text-[11px] text-muted-foreground">
              请为所有子仓填写目标分支
            </span>
          </template>

          <span v-if="status !== 'idle'" class="text-xs font-medium" :class="statusClass[status]">
            {{ statusLabel[status] }}
          </span>
        </div>
      </div>
    </template>

    <!-- ─── Classic Deploy Mode ──────────────────────────────────────────── -->
    <template v-else>
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
            当前分支:
            <span class="font-mono font-semibold text-foreground/90">{{ featureBranch }}</span>
            (自动检测，将合并到 test)
          </p>
          <p class="text-[11px] text-muted-foreground/80">
            默认会在失败时尝试
            <span class="font-mono">git merge --abort</span> 并切回执行前的分支，避免卡在 test
            合并冲突状态。
          </p>
        </div>

        <div class="flex items-center gap-3">
          <template v-if="status === 'running'">
            <button
              type="button"
              class="h-9 rounded-lg border border-destructive bg-background px-4 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
              @click="cancelDeploy"
            >
              取消部署
            </button>
          </template>
          <template v-else-if="showConfirm">
            <span class="text-xs font-medium text-yellow-500">确认执行部署？</span>
            <button
              type="button"
              class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              @click="onConfirmed"
            >
              确认
            </button>
            <button
              type="button"
              class="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              @click="onCancelConfirm"
            >
              取消
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!command.trim()"
              @click="confirmAndDeploy"
            >
              部署到测试环境
            </button>
          </template>

          <span v-if="status !== 'idle'" class="text-xs font-medium" :class="statusClass[status]">
            {{ statusLabel[status] }}
          </span>
        </div>
      </div>
    </template>

    <!-- ─── Log output (shared) ──────────────────────────────────────────── -->
    <div
      ref="logContainer"
      class="deploy-log-area min-h-[200px] flex-1 bg-[#1a1a2e] p-4 font-mono text-xs leading-5 text-green-300"
    >
      <div v-if="logLines.length === 0" class="text-muted-foreground/50">
        <template v-if="deployMode === 'workspace-native'">
          点击"开始部署"将各子仓变更直接合并到对应目标分支...
        </template>
        <template v-else-if="deployMode === 'subtree'">
          点击"部署子仓"开始执行 snapshot-sync 部署...
        </template>
        <template v-else> 点击"部署到测试环境"开始执行部署命令... </template>
      </div>
      <div v-for="(line, i) in logLines" :key="i" class="whitespace-pre">
        {{ line }}
      </div>
    </div>
  </div>
</template>

<style>
.deploy-log-area {
  overflow: scroll !important;
}
.deploy-log-area::-webkit-scrollbar {
  width: 12px;
  height: 12px;
  display: block;
}
.deploy-log-area::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  margin: 4px;
}
.deploy-log-area::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  min-height: 40px;
}
.deploy-log-area::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.5);
}
.deploy-log-area::-webkit-scrollbar-corner {
  background: rgba(255, 255, 255, 0.05);
}
</style>
