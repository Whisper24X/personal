<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { TaskGitBranchDiffFile, TaskGitChangedFile, TaskGitStatus } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import TaskDiffViewer from './TaskDiffViewer.vue'

const props = withDefaults(
  defineProps<{
    taskId: string
    baseBranch?: string | null
  }>(),
  {
    baseBranch: null,
  },
)

const loading = ref(false)
const errorMessage = ref('')
const statusInfo = ref<TaskGitStatus | null>(null)
const diffText = ref('')
const diffFallbackText = ref('')
const diffLoading = ref(false)
const selectedFilePath = ref<string | null>(null)
const activeTab = ref<'changes' | 'compare' | 'log'>('changes')

const branchDiffFiles = ref<TaskGitBranchDiffFile[]>([])
const selectedBranchDiffPath = ref<string | null>(null)
const branchDiffText = ref('')
const branchDiffLoading = ref(false)
const compareLoading = ref(false)

const commitMessage = ref('')
const commitLoading = ref(false)
const pushLoading = ref(false)
const actionLoading = ref<'merge' | 'rebase' | 'pr' | null>(null)
const actionMessage = ref('')

const logText = ref('')
const logLoading = ref(false)

const baseBranchInput = ref(props.baseBranch || 'main')

const stagedFiles = computed(() => {
  return (statusInfo.value?.files || []).filter((f) => f.staged)
})

const unstagedFiles = computed(() => {
  return (statusInfo.value?.files || []).filter((f) => !f.staged)
})

const hasChanges = computed(() => {
  return (statusInfo.value?.files.length ?? 0) > 0
})

const hasStagedFiles = computed(() => {
  return stagedFiles.value.length > 0
})

const conflictFiles = ref<string[]>([])

const findChangedFile = (filePath: string) => {
  return (statusInfo.value?.files || []).find((file) => file.path === filePath) ?? null
}

const loadStatus = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    statusInfo.value = await tasksApi.gitStatus(props.taskId)
  } catch (error) {
    statusInfo.value = null
    errorMessage.value = toErrorMessage(error, '加载 Git 状态失败')
  } finally {
    loading.value = false
  }
}

const loadWorkspaceFallback = async (file: TaskGitChangedFile) => {
  const preview = await tasksApi.workspacePreview(props.taskId, file.path)

  if (preview.tooLarge) {
    diffFallbackText.value = '文件过大，暂不支持在 Git 变更面板内预览。'
    return
  }

  if (preview.previewType === 'text' && typeof preview.text === 'string') {
    diffFallbackText.value = preview.text
    return
  }

  diffFallbackText.value = '当前文件类型暂不支持在 Git 变更面板内预览。'
}

const loadDiff = async (file: TaskGitChangedFile) => {
  diffLoading.value = true
  diffFallbackText.value = ''
  try {
    const response = await tasksApi.gitDiff(props.taskId, {
      path: file.path,
      staged: file.staged,
    })
    diffText.value = response.diffText || ''

    if (!response.diffText.trim() && !file.staged && file.status.trim() === '??') {
      await loadWorkspaceFallback(file)
    }
  } catch (error) {
    diffText.value = ''
    errorMessage.value = toErrorMessage(error, '加载 diff 失败')
  } finally {
    diffLoading.value = false
  }
}

const selectFile = (file: TaskGitChangedFile) => {
  selectedFilePath.value = file.path
  void loadDiff(file)
}

const loadBranchDiffFiles = async () => {
  compareLoading.value = true

  try {
    const response = await tasksApi.gitBranchDiffFiles(props.taskId, {
      baseBranch: baseBranchInput.value,
    })
    branchDiffFiles.value = response.files
    if (
      selectedBranchDiffPath.value &&
      !response.files.some((file) => file.path === selectedBranchDiffPath.value)
    ) {
      selectedBranchDiffPath.value = null
      branchDiffText.value = ''
    }
  } catch (error) {
    branchDiffFiles.value = []
    errorMessage.value = toErrorMessage(error, '加载分支差异文件失败')
  } finally {
    compareLoading.value = false
  }
}

const loadBranchDiff = async (filePath?: string) => {
  branchDiffLoading.value = true
  try {
    const response = await tasksApi.gitBranchDiff(props.taskId, {
      baseBranch: baseBranchInput.value,
      path: filePath,
    })
    branchDiffText.value = response.diffText || ''
  } catch (error) {
    branchDiffText.value = ''
    errorMessage.value = toErrorMessage(error, '加载分支差异失败')
  } finally {
    branchDiffLoading.value = false
  }
}

const loadLog = async () => {
  logLoading.value = true

  try {
    const response = await tasksApi.gitLog(props.taskId)
    logText.value = response.message || ''
  } catch (error) {
    logText.value = ''
    errorMessage.value = toErrorMessage(error, '加载提交记录失败')
  } finally {
    logLoading.value = false
  }
}

const toggleStage = async (filePath: string, staged: boolean) => {
  try {
    if (staged) {
      await tasksApi.gitUnstage(props.taskId, { files: [filePath] })
    } else {
      await tasksApi.gitStage(props.taskId, { files: [filePath] })
    }

    await loadStatus()

    if (selectedFilePath.value === filePath) {
      const nextFile =
        findChangedFile(filePath) ?? {
          path: filePath,
          status: staged ? '??' : 'A',
          staged: !staged,
        }

      await loadDiff(nextFile)
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error, staged ? '取消暂存失败' : '暂存失败')
  }
}

const stageAll = async () => {
  const files = unstagedFiles.value.map((f) => f.path)
  if (files.length === 0) return

  try {
    await tasksApi.gitStage(props.taskId, { files })
    await loadStatus()
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '全部暂存失败')
  }
}

const unstageAll = async () => {
  const files = stagedFiles.value.map((f) => f.path)
  if (files.length === 0) return

  try {
    await tasksApi.gitUnstage(props.taskId, { files })
    await loadStatus()
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '全部取消暂存失败')
  }
}

const commit = async () => {
  const message = commitMessage.value.trim()
  if (!message || !hasStagedFiles.value) return

  commitLoading.value = true
  actionMessage.value = ''

  try {
    const response = await tasksApi.gitCommit(props.taskId, { message })
    actionMessage.value = response.message
    commitMessage.value = ''
    await loadStatus()
    diffText.value = ''
    selectedFilePath.value = null
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '提交失败')
  } finally {
    commitLoading.value = false
  }
}

const push = async () => {
  pushLoading.value = true
  actionMessage.value = ''

  try {
    const response = await tasksApi.gitPush(props.taskId)
    actionMessage.value = response.message
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '推送失败')
  } finally {
    pushLoading.value = false
  }
}

const doMerge = async () => {
  actionLoading.value = 'merge'
  conflictFiles.value = []

  try {
    const response = await tasksApi.gitMerge(props.taskId, { baseBranch: baseBranchInput.value })
    actionMessage.value = response.message

    if (!response.success && response.conflicts?.length) {
      conflictFiles.value = response.conflicts
    }

    await loadStatus()
    await loadBranchDiffFiles()
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '合并失败')
  } finally {
    actionLoading.value = null
  }
}

const doRebase = async () => {
  actionLoading.value = 'rebase'
  conflictFiles.value = []

  try {
    const response = await tasksApi.gitRebase(props.taskId, { baseBranch: baseBranchInput.value })
    actionMessage.value = response.message

    if (!response.success && response.conflicts?.length) {
      conflictFiles.value = response.conflicts
    }

    await loadStatus()
    await loadBranchDiffFiles()
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '变基失败')
  } finally {
    actionLoading.value = null
  }
}

const openPrLink = async () => {
  actionLoading.value = 'pr'

  try {
    const response = await tasksApi.gitPrLink(props.taskId, { baseBranch: baseBranchInput.value })

    if (!response.url) {
      actionMessage.value = '未能生成 PR 链接'
      return
    }

    window.open(response.url, '_blank', 'noopener,noreferrer')
    actionMessage.value = '已打开 PR 链接'
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '生成 PR 链接失败')
  } finally {
    actionLoading.value = null
  }
}

const statusLabel = (status: string): string => {
  const s = status.trim()
  const map: Record<string, string> = {
    M: '修改',
    A: '新增',
    D: '删除',
    R: '重命名',
    C: '复制',
    U: '冲突',
    '??': '未跟踪',
    '!!': '忽略',
  }
  return map[s] || s
}

watch(
  () => props.taskId,
  async () => {
    selectedFilePath.value = null
    selectedBranchDiffPath.value = null
    diffText.value = ''
    diffFallbackText.value = ''
    branchDiffText.value = ''
    logText.value = ''
    actionMessage.value = ''
    conflictFiles.value = []
    await loadStatus()
  },
  { immediate: true },
)

watch(
  () => activeTab.value,
  (tab) => {
    errorMessage.value = ''
    actionMessage.value = ''

    if (tab === 'compare') {
      void loadBranchDiffFiles()
    } else if (tab === 'log') {
      void loadLog()
    }
  },
)

watch(
  () => props.baseBranch,
  (baseBranch) => {
    if (baseBranch) {
      baseBranchInput.value = baseBranch
    }
  },
)
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header class="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-2">
      <p class="truncate text-xs text-foreground">
        {{ statusInfo?.branchName || '-' }}
        <span class="text-muted-foreground/60">-></span>
        {{ baseBranchInput }}
      </p>

      <div class="flex shrink-0 items-center gap-1">
        <button
          class="h-6 rounded-md border border-border/60 bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          type="button"
          @click="loadStatus"
        >
          刷新
        </button>
        <button
          class="h-6 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="pushLoading"
          type="button"
          @click="push"
        >
          {{ pushLoading ? '推送中...' : '推送' }}
        </button>
      </div>
    </header>

    <div class="border-border/70 flex items-center gap-1 border-b px-2 py-1">
      <button
        v-for="tab in ([
          { key: 'changes' as const, label: '变更' },
          { key: 'compare' as const, label: '对比' },
          { key: 'log' as const, label: '日志' },
        ])"
        :key="tab.key"
        class="h-7 rounded-md px-2 text-xs transition-colors"
        :class="activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
        type="button"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <!-- Changes tab -->
      <div v-if="activeTab === 'changes'" class="flex h-full min-w-0">
        <aside class="border-border/70 flex w-64 shrink-0 flex-col border-r bg-background/80 text-xs">
          <div class="flex items-center justify-between border-b border-border/50 px-2 py-1.5">
            <span class="text-muted-foreground/70">文件变更</span>
            <div class="flex gap-1">
              <button
                class="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                type="button"
                @click="stageAll"
              >
                全部暂存
              </button>
              <button
                class="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                type="button"
                @click="unstageAll"
              >
                全部取消
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
            <p v-if="loading" class="px-1 text-muted-foreground">加载中...</p>
            <p v-else-if="errorMessage" class="px-1 text-destructive">{{ errorMessage }}</p>

            <template v-else>
              <div v-if="stagedFiles.length > 0" class="mb-2">
                <p class="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  已暂存 ({{ stagedFiles.length }})
                </p>
                <ul class="space-y-0.5">
                  <li v-for="file in stagedFiles" :key="'s-' + file.path">
                    <div
                      class="flex w-full cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted/40"
                      :class="selectedFilePath === file.path ? 'bg-muted/50 text-foreground' : 'text-muted-foreground'"
                      role="button"
                      tabindex="0"
                      @click="selectFile(file)"
                      @keydown.enter="selectFile(file)"
                    >
                      <span class="w-6 shrink-0 rounded bg-emerald-500/10 px-1 text-center text-[10px] text-emerald-600 dark:text-emerald-400">
                        {{ statusLabel(file.status) }}
                      </span>
                      <span class="min-w-0 flex-1 truncate">{{ file.path }}</span>
                      <button
                        class="shrink-0 rounded px-1 text-[10px] text-muted-foreground/50 transition-colors hover:bg-background hover:text-foreground"
                        type="button"
                        @click.stop="toggleStage(file.path, true)"
                      >
                        取消
                      </button>
                    </div>
                  </li>
                </ul>
              </div>

              <div v-if="unstagedFiles.length > 0">
                <p class="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  未暂存 ({{ unstagedFiles.length }})
                </p>
                <ul class="space-y-0.5">
                  <li v-for="file in unstagedFiles" :key="'u-' + file.path">
                    <div
                      class="flex w-full cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted/40"
                      :class="selectedFilePath === file.path ? 'bg-muted/50 text-foreground' : 'text-muted-foreground'"
                      role="button"
                      tabindex="0"
                      @click="selectFile(file)"
                      @keydown.enter="selectFile(file)"
                    >
                      <span class="w-6 shrink-0 rounded bg-muted/30 px-1 text-center text-[10px]">
                        {{ statusLabel(file.status) }}
                      </span>
                      <span class="min-w-0 flex-1 truncate">{{ file.path }}</span>
                      <button
                        class="shrink-0 rounded px-1 text-[10px] text-muted-foreground/50 transition-colors hover:bg-background hover:text-foreground"
                        type="button"
                        @click.stop="toggleStage(file.path, false)"
                      >
                        暂存
                      </button>
                    </div>
                  </li>
                </ul>
              </div>

              <p v-if="!hasChanges" class="px-1 py-2 text-center text-muted-foreground/50">工作区干净</p>
            </template>
          </div>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="border-b border-border/50 px-3 py-2">
            <div class="flex gap-2">
              <input
                v-model="commitMessage"
                class="h-7 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                placeholder="提交信息..."
                type="text"
                @keydown.enter="commit"
              />
              <button
                class="h-7 rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="commitLoading || !hasStagedFiles || !commitMessage.trim()"
                type="button"
                @click="commit"
              >
                {{ commitLoading ? '提交中...' : '提交' }}
              </button>
            </div>

            <p v-if="actionMessage" class="mt-1.5 text-[11px] text-muted-foreground">{{ actionMessage }}</p>
          </div>

          <TaskDiffViewer
            :diff-text="diffText"
            :fallback-text="diffFallbackText"
            :loading="diffLoading"
            :empty-text="'选择文件查看差异'"
            :fallback-path="selectedFilePath"
          />
        </section>
      </div>

      <!-- Compare tab -->
      <div v-else-if="activeTab === 'compare'" class="flex h-full min-w-0">
        <aside class="border-border/70 flex w-64 shrink-0 flex-col border-r bg-background/80 text-xs">
          <div class="space-y-1.5 border-b border-border/50 px-2 py-2">
            <div class="flex items-center gap-1.5">
              <input
                v-model="baseBranchInput"
                class="h-7 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs focus:outline-none"
                placeholder="base 分支"
                type="text"
              />
              <button
                class="h-7 shrink-0 rounded-md border border-border/60 bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                type="button"
                @click="loadBranchDiffFiles"
              >
                刷新
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
            <p v-if="compareLoading" class="px-1 text-muted-foreground">加载中...</p>

            <ul v-else class="space-y-0.5">
              <li v-for="file in branchDiffFiles" :key="file.path">
                <button
                  class="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted/40"
                  :class="selectedBranchDiffPath === file.path ? 'bg-muted/50 text-foreground' : 'text-muted-foreground'"
                  type="button"
                  @click="selectedBranchDiffPath = file.path; loadBranchDiff(file.path)"
                >
                  <span class="w-4 shrink-0 text-center text-[10px]">{{ file.status }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ file.path }}</span>
                </button>
              </li>
              <li v-if="branchDiffFiles.length === 0" class="px-1 py-2 text-center text-muted-foreground/50">
                无分支差异
              </li>
            </ul>
          </div>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="border-b border-border/50 px-3 py-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                class="h-7 rounded-md border border-border/60 bg-background px-2.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="actionLoading === 'merge'"
                type="button"
                @click="doMerge"
              >
                {{ actionLoading === 'merge' ? '合并中...' : '合并' }}
              </button>
              <button
                class="h-7 rounded-md border border-border/60 bg-background px-2.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="actionLoading === 'rebase'"
                type="button"
                @click="doRebase"
              >
                {{ actionLoading === 'rebase' ? '变基中...' : '变基' }}
              </button>
              <button
                class="h-7 rounded-md bg-primary px-2.5 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="actionLoading === 'pr'"
                type="button"
                @click="openPrLink"
              >
                {{ actionLoading === 'pr' ? '生成中...' : '创建 PR' }}
              </button>
            </div>

            <p v-if="actionMessage" class="mt-1.5 text-[11px] text-muted-foreground">{{ actionMessage }}</p>

            <div v-if="conflictFiles.length > 0" class="mt-1.5 rounded-md border border-amber-500/30 bg-amber-50/20 px-2 py-1.5 dark:bg-amber-500/5">
              <p class="mb-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">冲突文件 ({{ conflictFiles.length }})</p>
              <ul class="space-y-0.5">
                <li v-for="cf in conflictFiles" :key="cf" class="truncate text-[11px] text-amber-600 dark:text-amber-300">
                  {{ cf }}
                </li>
              </ul>
            </div>
          </div>

          <TaskDiffViewer
            :diff-text="branchDiffText"
            :loading="branchDiffLoading"
            :empty-text="'选择文件查看差异'"
            :fallback-path="selectedBranchDiffPath"
          />
        </section>
      </div>

      <!-- Log tab -->
      <div v-else class="flex h-full flex-col">
        <div class="border-b border-border/50 px-3 py-2">
          <button
            class="h-7 rounded-md border border-border/60 bg-background px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            type="button"
            @click="loadLog"
          >
            刷新
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <p v-if="logLoading" class="text-xs text-muted-foreground">加载中...</p>
          <pre v-else class="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">{{ logText || '暂无提交记录' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
