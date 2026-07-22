import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import { buildFileTreeFromPaths } from '@shared/components/file-browser/file-tree'
import type { TaskGitBranchDiffFile, TaskGitChangedFile, TaskGitStatus } from '@/types/api/tasks'
import { toErrorMessage } from '@api/shared/to-error-message'
import { taskGitChangedFileKey } from './task-git-keys'
import { mergeTaskBranchIntoBase } from './task-git-merge'

export type TaskGitPanelProps = {
  taskId: string
  baseBranch?: string | null
}

export type TaskGitPanelContext = ReturnType<typeof useTaskGitPanel>

export function useTaskGitPanel(props: TaskGitPanelProps) {
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
  const subRepoBranches = computed(() => statusInfo.value?.subRepoBranches ?? [])
  const isMultiRepoWorkspace = computed(() => subRepoBranches.value.length > 0)
  const subRepoCount = computed(() => subRepoBranches.value.length)
  const gitOperation = computed(() => statusInfo.value?.operation ?? null)
  const gitOperationRunning = computed(() => gitOperation.value?.status === 'running')
  const gitOperationLogs = computed(() => gitOperation.value?.logs ?? [])
  let gitOperationPollTimer: ReturnType<typeof setTimeout> | null = null

  const subRepoOperationRows = computed(() => {
    return subRepoBranches.value.map((repo) => {
      const prefixWithSlash = `${repo.prefix}/`
      const files = (statusInfo.value?.files ?? []).filter(
        (file) => file.path === repo.prefix || file.path.startsWith(prefixWithSlash),
      )

      return {
        ...repo,
        stagedCount: files.filter((file) => file.staged).length,
        unstagedCount: files.filter((file) => !file.staged).length,
        changedCount: files.length,
      }
    })
  })

  const conflictFiles = ref<string[]>([])
  let diffRequestId = 0
  const fullscreenTarget = ref<'changes' | 'compare' | null>(null)
  const toChangedFileKey = taskGitChangedFileKey

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
      if (statusInfo.value.operation?.status === 'running') {
        scheduleGitOperationPoll()
      }

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

  const clearGitOperationPoll = () => {
    if (gitOperationPollTimer) {
      clearTimeout(gitOperationPollTimer)
      gitOperationPollTimer = null
    }
  }

  const scheduleGitOperationPoll = () => {
    if (!gitOperationRunning.value || gitOperationPollTimer) return

    gitOperationPollTimer = setTimeout(async () => {
      gitOperationPollTimer = null
      await loadStatus()

      const operation = gitOperation.value
      if (operation?.status === 'running') {
        scheduleGitOperationPoll()
        return
      }

      if (operation?.status === 'success') {
        setActionFeedback(operation.message || '后台 Git 操作已完成', 'success')
        await loadBranchDiffFiles()
        return
      }

      if (operation?.status === 'cancelled') {
        setActionFeedback(operation.message || '操作已取消', 'warning')
        return
      }

      if (operation?.status === 'failed') {
        setActionFeedback(operation.message || '后台 Git 操作失败', 'error')
      }
    }, 2000)
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
      if (response.operationId) {
        setActionFeedback('后台推送已开始', 'neutral')
        await loadStatus()
        scheduleGitOperationPoll()
      } else {
        const prefix = isMultiRepoWorkspace.value ? `多仓推送：${subRepoCount.value} 个仓库\n` : ''
        setActionFeedback(
          `${prefix}${response.message}`.trim(),
          response.success ? 'success' : 'warning',
        )
      }
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
      const response = await mergeTaskBranchIntoBase(props.taskId, baseBranchInput.value)
      const mergeTone = response.operationId
        ? 'neutral'
        : !response.success && response.conflicts?.length
          ? 'warning'
          : response.success
            ? 'success'
            : 'neutral'
      setActionFeedback(response.message, mergeTone)

      if (!response.success && response.conflicts?.length) {
        conflictFiles.value = response.conflicts
      }

      await loadStatus()
      if (response.operationId) {
        scheduleGitOperationPoll()
      }
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

      if (response.urls && response.urls.length > 0) {
        const validUrls = response.urls.filter((u) => u.url)
        const hintItems = response.urls.filter((u) => !u.url && u.hint)

        if (validUrls.length === 0) {
          const hints = hintItems.map((u) => `[${u.prefix}] ${u.hint}`).join('\n')
          setActionFeedback(hints || '未能生成 PR 链接，请先推送到子仓', 'warning')
          return
        }

        for (const item of validUrls) {
          window.open(item.url!, '_blank', 'noopener,noreferrer')
        }

        const labels = validUrls.map((u) => u.prefix).join(', ')
        const hintSuffix = hintItems.length > 0
          ? `（${hintItems.map((u) => u.prefix).join(', ')} 未推送，跳过）`
          : ''
        setActionFeedback(`已打开 ${validUrls.length} 个子仓 PR 链接（${labels}）${hintSuffix}`, 'success')
        return
      }

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

  onBeforeUnmount(() => {
    clearGitOperationPoll()
  })

  return reactive({
    actionFeedbackClasses,
    actionLoading,
    actionMessage,
    actionMessageTone,
    activeTab,
    baseBranchInput,
    branchDiffFiles,
    branchDiffLoading,
    branchDiffText,
    branchDiffTree,
    buildChangedFilesTree,
    changesViewMode,
    clearChangedFileSelection,
    closeFullscreen,
    commit,
    commitLoading,
    commitMessage,
    compareCollapsedPaths,
    compareLoading,
    compareViewMode,
    conflictFiles,
    diffFallbackText,
    diffLoading,
    diffRequestId,
    diffText,
    doMerge,
    doRebase,
    errorMessage,
    expandChangedFileAncestors,
    findChangedFileByPathAndStage,
    fullscreenDiffLoading,
    fullscreenDiffText,
    fullscreenFallbackText,
    fullscreenOpen,
    fullscreenSelectedPath,
    fullscreenTarget,
    fullscreenViewMode,
    gitOperation,
    gitOperationLogs,
    gitOperationRunning,
    hasChanges,
    hasStagedFiles,
    isMultiRepoWorkspace,
    loadBranchDiff,
    loadBranchDiffFiles,
    loadDiff,
    loadLog,
    loadSelectedChangedFile,
    loadStatus,
    loading,
    logLoading,
    logText,
    openFullscreen,
    openPrLink,
    push,
    pushLoading,
    refreshActiveTab,
    selectBranchDiffFile,
    selectFile,
    selectedBranchDiffPath,
    selectedChangedFile,
    selectedFilePath,
    setActionFeedback,
    setFullscreenViewMode,
    stageAll,
    stagedCollapsedPaths,
    stagedFiles,
    stagedFilesCount,
    stagedTree,
    statusInfo,
    subRepoBranches,
    subRepoCount,
    subRepoOperationRows,
    toChangedFileKey,
    toggleCollapsedPath,
    toggleCompareCollapsedPath,
    toggleStage,
    unstageAll,
    unstagedCollapsedPaths,
    unstagedFiles,
    unstagedTree,
  })
}
