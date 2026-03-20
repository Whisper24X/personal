<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import { buildFileTreeFromPaths } from '@/components/core/file-browser/file-tree'
import type { TaskGitBranchDiffFile, TaskGitChangedFile, TaskGitStatus } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import TaskGitChangeTreeItem from './TaskGitChangeTreeItem.vue'
import TaskGitCompareTreeItem from './TaskGitCompareTreeItem.vue'
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
const selectedChangedFile = ref<TaskGitChangedFile | null>(null)
const activeTab = ref<'changes' | 'compare' | 'operations' | 'log'>('changes')
const stagedCollapsedPaths = ref<Set<string>>(new Set())
const unstagedCollapsedPaths = ref<Set<string>>(new Set())
const compareCollapsedPaths = ref<Set<string>>(new Set())
const changesViewMode = ref<'unified' | 'split'>('unified')
const compareViewMode = ref<'unified' | 'split'>('unified')

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
const actionMessageTone = ref<'success' | 'warning' | 'error' | 'neutral'>('neutral')

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
const stagedFilesCount = computed(() => stagedFiles.value.length)

const conflictFiles = ref<string[]>([])
let diffRequestId = 0
const fullscreenTarget = ref<'changes' | 'compare' | null>(null)
const fullscreenDialogRef = useTemplateRef<HTMLDivElement>('fullscreenDialog')

const toChangedFileKey = (file: TaskGitChangedFile) => {
  return `${file.staged ? 'staged' : 'unstaged'}:${file.path}`
}

const selectedFilePath = computed(() => {
  return selectedChangedFile.value?.path ?? null
})

const fullscreenOpen = computed(() => fullscreenTarget.value !== null)
const fullscreenDiffText = computed(() => {
  return fullscreenTarget.value === 'compare' ? branchDiffText.value : diffText.value
})
const fullscreenFallbackText = computed(() => {
  return fullscreenTarget.value === 'compare' ? '' : diffFallbackText.value
})
const fullscreenDiffLoading = computed(() => {
  return fullscreenTarget.value === 'compare' ? branchDiffLoading.value : diffLoading.value
})
const fullscreenSelectedPath = computed(() => {
  return fullscreenTarget.value === 'compare'
    ? selectedBranchDiffPath.value
    : selectedFilePath.value
})
const fullscreenViewMode = computed(() => {
  return fullscreenTarget.value === 'compare' ? compareViewMode.value : changesViewMode.value
})
const actionFeedbackClasses = computed(() => {
  if (actionMessageTone.value === 'success') {
    return 'border-emerald-500/30 bg-emerald-50/30 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
  }

  if (actionMessageTone.value === 'warning') {
    return 'border-amber-500/30 bg-amber-50/30 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
  }

  if (actionMessageTone.value === 'error') {
    return 'border-destructive/30 bg-destructive/5 text-destructive'
  }

  return 'border-border/70 bg-muted/20 text-muted-foreground'
})

const buildChangedFilesTree = (files: TaskGitChangedFile[]) => {
  const items = files.map((file) => {
    const segments = file.path.split('/').filter(Boolean)
    return {
      path: file.path,
      name: segments[segments.length - 1] ?? file.path,
    }
  })

  const { nodes } = buildFileTreeFromPaths(items)

  return {
    nodes,
    filesByPath: Object.fromEntries(files.map((file) => [file.path, file])),
  }
}

const stagedTree = computed(() => {
  return buildChangedFilesTree(stagedFiles.value)
})

const unstagedTree = computed(() => {
  return buildChangedFilesTree(unstagedFiles.value)
})

const branchDiffTree = computed(() => {
  const items = branchDiffFiles.value.map((file) => {
    const segments = file.path.split('/').filter(Boolean)
    return {
      path: file.path,
      name: segments[segments.length - 1] ?? file.path,
    }
  })

  const { nodes } = buildFileTreeFromPaths(items)

  return {
    nodes,
    filesByPath: Object.fromEntries(branchDiffFiles.value.map((file) => [file.path, file])),
  }
})

const findChangedFileByPathAndStage = (filePath: string, staged: boolean) => {
  return (
    (statusInfo.value?.files || []).find(
      (file) => file.path === filePath && file.staged === staged,
    ) ?? null
  )
}

const clearChangedFileSelection = () => {
  selectedChangedFile.value = null
  diffText.value = ''
  diffFallbackText.value = ''
  diffRequestId += 1
}

const expandChangedFileAncestors = (file: TaskGitChangedFile) => {
  const collapsedPaths = file.staged ? stagedCollapsedPaths : unstagedCollapsedPaths
  const next = new Set(collapsedPaths.value)
  const segments = file.path.split('/').filter(Boolean)

  for (let index = 1; index < segments.length; index += 1) {
    next.delete(segments.slice(0, index).join('/'))
  }

  collapsedPaths.value = next
}

const loadStatus = async () => {
  loading.value = true
  errorMessage.value = ''
  const previousSelectedKey = selectedChangedFile.value
    ? toChangedFileKey(selectedChangedFile.value)
    : null

  try {
    statusInfo.value = await tasksApi.gitStatus(props.taskId)

    if (previousSelectedKey) {
      const matched = (statusInfo.value.files || []).find(
        (file) => toChangedFileKey(file) === previousSelectedKey,
      )

      if (matched) {
        selectedChangedFile.value = matched
      } else {
        clearChangedFileSelection()
      }
    }
  } catch (error) {
    statusInfo.value = null
    clearChangedFileSelection()
    errorMessage.value = toErrorMessage(error, '加载 Git 状态失败')
  } finally {
    loading.value = false
  }
}

const loadDiff = async (file: TaskGitChangedFile) => {
  const requestId = ++diffRequestId
  diffLoading.value = true
  diffFallbackText.value = ''

  try {
    const response = await tasksApi.gitDiff(props.taskId, {
      path: file.path,
      staged: file.staged,
    })

    if (requestId !== diffRequestId) {
      return
    }

    diffText.value = response.diffText || ''

    if (!response.diffText.trim() && !file.staged && file.status.trim() === '??') {
      diffFallbackText.value = '未跟踪文件暂无 diff，可前往文件面板查看原始内容。'
    }
  } catch (error) {
    if (requestId !== diffRequestId) {
      return
    }

    diffText.value = ''
    errorMessage.value = toErrorMessage(error, '加载 diff 失败')
  } finally {
    if (requestId === diffRequestId) {
      diffLoading.value = false
    }
  }
}

const loadSelectedChangedFile = async (file: TaskGitChangedFile) => {
  selectedChangedFile.value = file
  expandChangedFileAncestors(file)
  await loadDiff(file)
}

const selectFile = (file: TaskGitChangedFile) => {
  void loadSelectedChangedFile(file)
}

const toggleCollapsedPath = (path: string, staged: boolean) => {
  const collapsedPaths = staged ? stagedCollapsedPaths : unstagedCollapsedPaths
  const next = new Set(collapsedPaths.value)

  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }

  collapsedPaths.value = next
}

const toggleCompareCollapsedPath = (path: string) => {
  const next = new Set(compareCollapsedPaths.value)

  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }

  compareCollapsedPaths.value = next
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

const selectBranchDiffFile = (filePath: string) => {
  selectedBranchDiffPath.value = filePath
  void loadBranchDiff(filePath)
}

const refreshActiveTab = async () => {
  errorMessage.value = ''

  if (activeTab.value === 'compare') {
    await loadBranchDiffFiles()
    return
  }

  if (activeTab.value === 'log') {
    await loadLog()
    return
  }

  await loadStatus()
}

const setActionFeedback = (
  message: string,
  tone: 'success' | 'warning' | 'error' | 'neutral' = 'neutral',
) => {
  actionMessage.value = message
  actionMessageTone.value = tone
}

const openFullscreen = (target: 'changes' | 'compare') => {
  fullscreenTarget.value = target
}

const closeFullscreen = () => {
  fullscreenTarget.value = null
}

const setFullscreenViewMode = (mode: 'unified' | 'split') => {
  if (fullscreenTarget.value === 'compare') {
    compareViewMode.value = mode
    return
  }

  changesViewMode.value = mode
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

    if (selectedChangedFile.value?.path === filePath) {
      const nextFile = findChangedFileByPathAndStage(filePath, !staged) ??
        findChangedFileByPathAndStage(filePath, staged) ?? {
          path: filePath,
          status: staged ? '??' : 'A',
          staged: !staged,
        }

      await loadSelectedChangedFile(nextFile)
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
  setActionFeedback('')

  try {
    const response = await tasksApi.gitCommit(props.taskId, { message })
    setActionFeedback(response.message, response.success ? 'success' : 'warning')
    commitMessage.value = ''
    await loadStatus()
    clearChangedFileSelection()
  } catch (error) {
    setActionFeedback(toErrorMessage(error, '提交失败'), 'error')
  } finally {
    commitLoading.value = false
  }
}

const push = async () => {
  pushLoading.value = true
  setActionFeedback('')

  try {
    const response = await tasksApi.gitPush(props.taskId)
    setActionFeedback(response.message, response.success ? 'success' : 'warning')
  } catch (error) {
    setActionFeedback(toErrorMessage(error, '推送失败'), 'error')
  } finally {
    pushLoading.value = false
  }
}

const doMerge = async () => {
  actionLoading.value = 'merge'
  conflictFiles.value = []

  try {
    const response = await tasksApi.gitMerge(props.taskId, { baseBranch: baseBranchInput.value })
    setActionFeedback(
      response.message,
      !response.success && response.conflicts?.length
        ? 'warning'
        : response.success
          ? 'success'
          : 'neutral',
    )

    if (!response.success && response.conflicts?.length) {
      conflictFiles.value = response.conflicts
    }

    await loadStatus()
    await loadBranchDiffFiles()
  } catch (error) {
    setActionFeedback(toErrorMessage(error, '合并失败'), 'error')
  } finally {
    actionLoading.value = null
  }
}

const doRebase = async () => {
  actionLoading.value = 'rebase'
  conflictFiles.value = []

  try {
    const response = await tasksApi.gitRebase(props.taskId, { baseBranch: baseBranchInput.value })
    setActionFeedback(
      response.message,
      !response.success && response.conflicts?.length
        ? 'warning'
        : response.success
          ? 'success'
          : 'neutral',
    )

    if (!response.success && response.conflicts?.length) {
      conflictFiles.value = response.conflicts
    }

    await loadStatus()
    await loadBranchDiffFiles()
  } catch (error) {
    setActionFeedback(toErrorMessage(error, '变基失败'), 'error')
  } finally {
    actionLoading.value = null
  }
}

const openPrLink = async () => {
  actionLoading.value = 'pr'

  try {
    const response = await tasksApi.gitPrLink(props.taskId, { baseBranch: baseBranchInput.value })

    if (!response.url) {
      setActionFeedback('未能生成 PR 链接', 'warning')
      return
    }

    window.open(response.url, '_blank', 'noopener,noreferrer')
    setActionFeedback('已打开 PR 链接', 'success')
  } catch (error) {
    setActionFeedback(toErrorMessage(error, '生成 PR 链接失败'), 'error')
  } finally {
    actionLoading.value = null
  }
}

watch(
  () => props.taskId,
  async () => {
    clearChangedFileSelection()
    selectedBranchDiffPath.value = null
    branchDiffText.value = ''
    logText.value = ''
    setActionFeedback('')
    conflictFiles.value = []
    await loadStatus()
  },
  { immediate: true },
)

watch(
  () => activeTab.value,
  (tab) => {
    errorMessage.value = ''
    setActionFeedback('')

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

watch(fullscreenOpen, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  fullscreenDialogRef.value?.focus()
})
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
          @click="refreshActiveTab"
        >
          刷新
        </button>
      </div>
    </header>

    <div class="border-border/70 flex items-center gap-1 border-b px-2 py-1">
      <button
        v-for="tab in [
          { key: 'changes' as const, label: '变更' },
          { key: 'compare' as const, label: '对比' },
          { key: 'operations' as const, label: '操作' },
          { key: 'log' as const, label: '日志' },
        ]"
        :key="tab.key"
        class="h-7 rounded-md px-2 text-xs transition-colors"
        :class="
          activeTab === tab.key
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted'
        "
        type="button"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <!-- Changes tab -->
      <div v-if="activeTab === 'changes'" class="flex h-full min-w-0">
        <aside
          class="border-border/70 flex w-72 shrink-0 flex-col border-r bg-background/80 text-xs"
        >
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
              <div v-if="stagedFiles.length > 0" class="mb-3">
                <p
                  class="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                >
                  已暂存 ({{ stagedFiles.length }})
                </p>
                <p class="mb-1.5 px-1 text-[11px] text-muted-foreground/70">
                  准备进入下一次 commit 的内容
                </p>
                <div class="space-y-0.5">
                  <TaskGitChangeTreeItem
                    v-for="node in stagedTree.nodes"
                    :key="'s-' + node.path"
                    :node="node"
                    :files-by-path="stagedTree.filesByPath"
                    :collapsed-paths="stagedCollapsedPaths"
                    :selected-path="selectedChangedFile?.staged ? selectedChangedFile.path : null"
                    :staged="true"
                    @select-file="selectFile"
                    @toggle-dir="toggleCollapsedPath($event, true)"
                    @toggle-stage="toggleStage($event.filePath, $event.staged)"
                  />
                </div>
              </div>

              <div v-if="unstagedFiles.length > 0">
                <p
                  class="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60"
                >
                  未暂存 ({{ unstagedFiles.length }})
                </p>
                <p class="mb-1.5 px-1 text-[11px] text-muted-foreground/70">
                  工作区变更，尚未加入 commit
                </p>
                <div class="space-y-0.5">
                  <TaskGitChangeTreeItem
                    v-for="node in unstagedTree.nodes"
                    :key="'u-' + node.path"
                    :node="node"
                    :files-by-path="unstagedTree.filesByPath"
                    :collapsed-paths="unstagedCollapsedPaths"
                    :selected-path="
                      selectedChangedFile && !selectedChangedFile.staged
                        ? selectedChangedFile.path
                        : null
                    "
                    :staged="false"
                    @select-file="selectFile"
                    @toggle-dir="toggleCollapsedPath($event, false)"
                    @toggle-stage="toggleStage($event.filePath, $event.staged)"
                  />
                </div>
              </div>

              <p v-if="!hasChanges" class="px-1 py-2 text-center text-muted-foreground/50">
                工作区干净
              </p>
            </template>
          </div>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="min-h-0 flex-1 overflow-hidden">
            <section
              class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background"
            >
              <div
                class="flex items-center justify-end gap-2 border-b border-border/60 px-2 py-1.5"
              >
                <div
                  class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm"
                >
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      changesViewMode === 'unified'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="changesViewMode = 'unified'"
                  >
                    统一视图
                  </button>
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      changesViewMode === 'split'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="changesViewMode = 'split'"
                  >
                    分栏视图
                  </button>
                </div>
                <button
                  class="rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  type="button"
                  @click="openFullscreen('changes')"
                >
                  全屏
                </button>
              </div>
              <TaskDiffViewer
                :diff-text="diffText"
                :fallback-text="diffFallbackText"
                :loading="diffLoading"
                :empty-text="'选择文件查看差异'"
                :fallback-path="selectedFilePath"
                :view-mode="changesViewMode"
                :show-view-mode-toolbar="false"
              />
            </section>
          </div>
        </section>
      </div>

      <!-- Compare tab -->
      <div v-else-if="activeTab === 'compare'" class="flex h-full min-w-0">
        <aside
          class="border-border/70 flex w-72 shrink-0 flex-col border-r bg-background/80 text-xs"
        >
          <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
            <p v-if="compareLoading" class="px-1 text-muted-foreground">加载中...</p>
            <p v-else-if="errorMessage" class="px-1 text-destructive">{{ errorMessage }}</p>

            <template v-else>
              <div class="mb-3">
                <p
                  class="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300"
                >
                  分支差异 ({{ branchDiffFiles.length }})
                </p>
                <div class="space-y-0.5">
                  <TaskGitCompareTreeItem
                    v-for="node in branchDiffTree.nodes"
                    :key="node.path"
                    :node="node"
                    :files-by-path="branchDiffTree.filesByPath"
                    :collapsed-paths="compareCollapsedPaths"
                    :selected-path="selectedBranchDiffPath"
                    @select-file="selectBranchDiffFile"
                    @toggle-dir="toggleCompareCollapsedPath"
                  />
                </div>
              </div>

              <p
                v-if="branchDiffFiles.length === 0"
                class="px-1 py-2 text-center text-muted-foreground/50"
              >
                无分支差异
              </p>
            </template>
          </div>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="min-h-0 flex-1 overflow-hidden p-3">
            <section
              class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background"
            >
              <div class="flex items-center justify-end gap-2 border-b border-border/60 px-3 py-1.5">
                <div
                  class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm"
                >
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      compareViewMode === 'unified'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="compareViewMode = 'unified'"
                  >
                    统一视图
                  </button>
                  <button
                    class="rounded px-2.5 py-1 text-[11px] transition-colors"
                    :class="
                      compareViewMode === 'split'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    "
                    type="button"
                    @click="compareViewMode = 'split'"
                  >
                    分栏视图
                  </button>
                </div>
                <button
                  class="rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  type="button"
                  @click="openFullscreen('compare')"
                >
                  全屏
                </button>
              </div>
              <TaskDiffViewer
                :diff-text="branchDiffText"
                :loading="branchDiffLoading"
                :empty-text="'选择文件查看差异'"
                :fallback-path="selectedBranchDiffPath"
                :view-mode="compareViewMode"
                :show-view-mode-toolbar="false"
              />
            </section>
          </div>
        </section>
      </div>

      <!-- Operations tab -->
      <div v-else-if="activeTab === 'operations'" class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="mx-auto flex max-w-4xl flex-col gap-4">
          <section class="rounded-2xl border border-border/70 bg-background shadow-sm">
            <div class="flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <span class="rounded-md bg-muted px-2 py-1">
                当前分支 {{ statusInfo?.branchName || '-' }}
              </span>
              <span class="rounded-md bg-muted px-2 py-1">基准分支 {{ baseBranchInput }}</span>
            </div>
          </section>

          <section class="rounded-2xl border border-border/70 bg-background shadow-sm">
            <header
              class="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3"
            >
              <div>
                <h3 class="text-sm font-semibold text-foreground">提交操作</h3>
                <p class="mt-1 text-xs text-muted-foreground">整理已暂存内容并提交到当前分支。</p>
              </div>
              <span
                class="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                >
                  已暂存 {{ stagedFilesCount }} 个文件
                </span>
            </header>

            <div class="space-y-4 px-4 py-4">
              <div class="flex flex-col gap-2 md:flex-row">
                <input
                  v-model="commitMessage"
                  class="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                  placeholder="输入提交信息..."
                  type="text"
                  @keydown.enter="commit"
                />
                <button
                  class="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="commitLoading || !hasStagedFiles || !commitMessage.trim()"
                  type="button"
                  @click="commit"
                >
                  {{ commitLoading ? '提交中...' : '提交' }}
                </button>
                <button
                  class="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="pushLoading"
                  type="button"
                  @click="push"
                >
                  {{ pushLoading ? '推送中...' : '推送' }}
                </button>
              </div>

            </div>
          </section>

          <section class="rounded-2xl border border-border/70 bg-background shadow-sm">
            <header class="border-b border-border/60 px-4 py-3">
              <div>
                <h3 class="text-sm font-semibold text-foreground">分支操作</h3>
                <p class="mt-1 text-xs text-muted-foreground">
                  围绕当前分支和基准分支执行后续协作动作。
                </p>
              </div>
            </header>

            <div class="space-y-4 px-4 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="actionLoading === 'pr'"
                  type="button"
                  @click="openPrLink"
                >
                  {{ actionLoading === 'pr' ? '生成中...' : '创建 PR' }}
                </button>
                <button
                  class="h-10 rounded-xl border border-border/60 bg-background px-4 text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="actionLoading === 'merge'"
                  type="button"
                  @click="doMerge"
                >
                  {{ actionLoading === 'merge' ? '合并中...' : '合并' }}
                </button>
                <button
                  class="h-10 rounded-xl border border-amber-500/30 bg-amber-50/30 px-4 text-sm text-amber-700 transition-colors hover:bg-amber-50/50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500/10 dark:text-amber-300"
                  :disabled="actionLoading === 'rebase'"
                  type="button"
                  @click="doRebase"
                >
                  {{ actionLoading === 'rebase' ? '变基中...' : '变基' }}
                </button>
              </div>

              <div
                v-if="actionMessage"
                class="rounded-xl border px-3 py-3 text-sm"
                :class="actionFeedbackClasses"
              >
                {{ actionMessage }}
              </div>

              <div
                v-if="conflictFiles.length > 0"
                class="rounded-xl border border-amber-500/30 bg-amber-50/20 px-3 py-3 dark:bg-amber-500/5"
              >
                <p class="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  冲突文件 ({{ conflictFiles.length }})
                </p>
                <ul class="space-y-1">
                  <li
                    v-for="cf in conflictFiles"
                    :key="cf"
                    class="truncate rounded-md bg-background/70 px-2 py-1 text-xs text-amber-700 dark:text-amber-300"
                  >
                    {{ cf }}
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Log tab -->
      <div v-else class="flex h-full flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <p v-if="logLoading" class="text-xs text-muted-foreground">加载中...</p>
          <pre
            v-else
            class="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap"
            >{{ logText || '暂无提交记录' }}</pre
          >
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="fullscreenOpen"
      class="fixed inset-0 z-[140] flex bg-background/85 p-3 backdrop-blur-sm sm:p-6"
      @click.self="closeFullscreen"
    >
      <section
        ref="fullscreenDialog"
        class="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Git Diff 全屏预览"
        tabindex="-1"
        @keydown.esc="closeFullscreen"
      >
        <header
          class="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3"
        >
          <p class="min-w-0 truncate font-mono text-sm text-foreground">
            {{ fullscreenSelectedPath || 'Git Diff' }}
          </p>
          <div class="flex items-center gap-2">
            <div
              class="inline-flex rounded-md border border-border/70 bg-background p-0.5 shadow-sm"
            >
              <button
                class="rounded px-2.5 py-1 text-[11px] transition-colors"
                :class="
                  fullscreenViewMode === 'unified'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                "
                type="button"
                @click="setFullscreenViewMode('unified')"
              >
                统一视图
              </button>
              <button
                class="rounded px-2.5 py-1 text-[11px] transition-colors"
                :class="
                  fullscreenViewMode === 'split'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                "
                type="button"
                @click="setFullscreenViewMode('split')"
              >
                分栏视图
              </button>
            </div>
            <button
              class="rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              type="button"
              @click="closeFullscreen"
            >
              退出全屏
            </button>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-hidden">
          <TaskDiffViewer
            :diff-text="fullscreenDiffText"
            :fallback-text="fullscreenFallbackText"
            :loading="fullscreenDiffLoading"
            :empty-text="'选择文件查看差异'"
            :fallback-path="fullscreenSelectedPath"
            :view-mode="fullscreenViewMode"
            :show-view-mode-toolbar="false"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>
