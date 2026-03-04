<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { TaskGitBranchDiffFile, TaskGitStatus } from '@/types/api/tasks'
import { toErrorMessage } from '@/utils/http/to-error-message'

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
const selectedFilePath = ref<string | null>(null)
const activeTab = ref<'changes' | 'compare'>('changes')

const branchDiffFiles = ref<TaskGitBranchDiffFile[]>([])
const selectedBranchDiffPath = ref<string | null>(null)
const branchDiffText = ref('')
const compareLoading = ref(false)

const commitMessage = ref('')
const commitLoading = ref(false)
const actionLoading = ref<'merge' | 'rebase' | 'pr' | null>(null)
const actionMessage = ref('')

const baseBranchInput = ref(props.baseBranch || 'main')

const hasChanges = computed(() => {
  return (statusInfo.value?.files.length ?? 0) > 0
})

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

const loadDiff = async (path?: string, staged?: boolean) => {
  try {
    const response = await tasksApi.gitDiff(props.taskId, {
      path,
      staged,
    })
    diffText.value = response.diffText || ''
  } catch (error) {
    diffText.value = ''
    errorMessage.value = toErrorMessage(error, '加载 diff 失败')
  }
}

const loadBranchDiffFiles = async () => {
  compareLoading.value = true
  errorMessage.value = ''

  try {
    const response = await tasksApi.gitBranchDiffFiles(props.taskId, {
      baseBranch: baseBranchInput.value,
    })
    branchDiffFiles.value = response.files
  } catch (error) {
    branchDiffFiles.value = []
    errorMessage.value = toErrorMessage(error, '加载分支差异文件失败')
  } finally {
    compareLoading.value = false
  }
}

const loadBranchDiff = async (path?: string) => {
  try {
    const response = await tasksApi.gitBranchDiff(props.taskId, {
      baseBranch: baseBranchInput.value,
      path,
    })
    branchDiffText.value = response.diffText || ''
  } catch (error) {
    branchDiffText.value = ''
    errorMessage.value = toErrorMessage(error, '加载分支差异失败')
  }
}

const toggleStage = async (path: string, staged: boolean) => {
  try {
    if (staged) {
      await tasksApi.gitUnstage(props.taskId, {
        files: [path],
      })
    } else {
      await tasksApi.gitStage(props.taskId, {
        files: [path],
      })
    }

    await loadStatus()
    await loadDiff(selectedFilePath.value || undefined)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, staged ? '取消暂存失败' : '暂存失败')
  }
}

const stageAll = async () => {
  const files = (statusInfo.value?.files || []).map((file) => file.path)
  if (files.length === 0) {
    return
  }

  try {
    await tasksApi.gitStage(props.taskId, {
      files,
    })
    await loadStatus()
    await loadDiff(selectedFilePath.value || undefined)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '全部暂存失败')
  }
}

const unstageAll = async () => {
  const files = (statusInfo.value?.files || []).filter((file) => file.staged).map((file) => file.path)
  if (files.length === 0) {
    return
  }

  try {
    await tasksApi.gitUnstage(props.taskId, {
      files,
    })
    await loadStatus()
    await loadDiff(selectedFilePath.value || undefined)
  } catch (error) {
    errorMessage.value = toErrorMessage(error, '全部取消暂存失败')
  }
}

const commit = async () => {
  const message = commitMessage.value.trim()
  if (!message) {
    return
  }

  commitLoading.value = true
  actionMessage.value = ''

  try {
    const response = await tasksApi.gitCommit(props.taskId, {
      message,
    })

    actionMessage.value = response.message
    commitMessage.value = ''
    await loadStatus()
    await loadDiff(selectedFilePath.value || undefined)
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '提交失败')
  } finally {
    commitLoading.value = false
  }
}

const doMerge = async () => {
  actionLoading.value = 'merge'

  try {
    const response = await tasksApi.gitMerge(props.taskId, {
      baseBranch: baseBranchInput.value,
    })

    actionMessage.value = response.message
    await loadStatus()
    await loadBranchDiffFiles()
    await loadBranchDiff(selectedBranchDiffPath.value || undefined)
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '合并失败')
  } finally {
    actionLoading.value = null
  }
}

const doRebase = async () => {
  actionLoading.value = 'rebase'

  try {
    const response = await tasksApi.gitRebase(props.taskId, {
      baseBranch: baseBranchInput.value,
    })

    actionMessage.value = response.message
    await loadStatus()
    await loadBranchDiffFiles()
    await loadBranchDiff(selectedBranchDiffPath.value || undefined)
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '变基失败')
  } finally {
    actionLoading.value = null
  }
}

const openPrLink = async () => {
  actionLoading.value = 'pr'

  try {
    const response = await tasksApi.gitPrLink(props.taskId, {
      baseBranch: baseBranchInput.value,
    })

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

watch(
  () => props.taskId,
  async () => {
    selectedFilePath.value = null
    selectedBranchDiffPath.value = null
    await loadStatus()
    await loadDiff()
    await loadBranchDiffFiles()
    await loadBranchDiff()
  },
  {
    immediate: true,
  },
)

watch(
  () => props.baseBranch,
  (baseBranch) => {
    if (!baseBranch) {
      return
    }

    baseBranchInput.value = baseBranch
  },
)
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <header class="border-border/70 border-b px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs">
          <p class="text-muted-foreground">Git</p>
          <p class="text-foreground">{{ statusInfo?.branchName || '-' }} -> {{ baseBranchInput }}</p>
        </div>

        <button class="h-7 rounded-md border border-border bg-background px-2 text-xs" type="button" @click="loadStatus">
          刷新
        </button>
      </div>
    </header>

    <div class="border-border/70 flex items-center gap-1 border-b px-2 py-1">
      <button
        class="h-7 rounded-md px-2 text-xs"
        :class="activeTab === 'changes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
        type="button"
        @click="activeTab = 'changes'"
      >
        Changes
      </button>
      <button
        class="h-7 rounded-md px-2 text-xs"
        :class="activeTab === 'compare' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
        type="button"
        @click="activeTab = 'compare'"
      >
        Compare
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="activeTab === 'changes'" class="flex h-full min-w-0">
        <aside class="border-border/70 w-72 shrink-0 border-r bg-background/80 p-2 text-xs">
          <div class="mb-2 flex items-center gap-2">
            <button class="h-7 rounded-md border border-border bg-background px-2" type="button" @click="stageAll">全部暂存</button>
            <button class="h-7 rounded-md border border-border bg-background px-2" type="button" @click="unstageAll">全部取消</button>
          </div>

          <p v-if="loading" class="text-muted-foreground">加载中...</p>
          <p v-else-if="errorMessage" class="text-destructive">{{ errorMessage }}</p>

          <ul v-else class="space-y-1">
            <li v-for="file in statusInfo?.files || []" :key="file.path" class="rounded-md border border-border bg-background px-2 py-1.5">
              <div class="flex items-center justify-between gap-2">
                <button
                  class="min-w-0 flex-1 truncate text-left hover:text-foreground"
                  :class="selectedFilePath === file.path ? 'text-foreground font-medium' : 'text-muted-foreground'"
                  type="button"
                  @click="selectedFilePath = file.path; loadDiff(file.path)"
                >
                  {{ file.status.trim() || '--' }} {{ file.path }}
                </button>
                <button class="rounded border border-border px-1.5 py-0.5" type="button" @click="toggleStage(file.path, file.staged)">
                  {{ file.staged ? 'Unstage' : 'Stage' }}
                </button>
              </div>
            </li>

            <li v-if="!hasChanges" class="text-muted-foreground">工作区干净</li>
          </ul>
        </aside>

        <section class="min-w-0 flex-1 overflow-auto bg-muted/10 p-3">
          <div class="space-y-2">
            <label class="text-xs text-muted-foreground">提交信息</label>
            <div class="flex gap-2">
              <input
                v-model="commitMessage"
                class="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                placeholder="feat: ..."
                type="text"
              />
              <button
                class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="commitLoading"
                type="button"
                @click="commit"
              >
                {{ commitLoading ? '提交中...' : '提交' }}
              </button>
            </div>

            <p v-if="actionMessage" class="text-xs text-muted-foreground">{{ actionMessage }}</p>
          </div>

          <pre class="mt-3 max-h-[calc(100%-6rem)] overflow-auto rounded-md border border-border bg-background p-3 text-xs text-foreground">{{ diffText || '# no diff' }}</pre>
        </section>
      </div>

      <div v-else class="flex h-full min-w-0">
        <aside class="border-border/70 w-72 shrink-0 border-r bg-background/80 p-2 text-xs">
          <div class="mb-2 space-y-2">
            <label class="block text-muted-foreground">Base 分支</label>
            <input v-model="baseBranchInput" class="h-8 w-full rounded-md border border-border bg-background px-2" type="text" />
            <button class="h-7 rounded-md border border-border bg-background px-2" type="button" @click="loadBranchDiffFiles">刷新比较</button>
          </div>

          <p v-if="compareLoading" class="text-muted-foreground">加载中...</p>

          <ul v-else class="space-y-1">
            <li v-for="file in branchDiffFiles" :key="file.path">
              <button
                class="w-full truncate rounded-md border border-border bg-background px-2 py-1 text-left"
                :class="selectedBranchDiffPath === file.path ? 'text-foreground font-medium' : 'text-muted-foreground'"
                type="button"
                @click="selectedBranchDiffPath = file.path; loadBranchDiff(file.path)"
              >
                {{ file.status }} {{ file.path }}
              </button>
            </li>

            <li v-if="branchDiffFiles.length === 0" class="text-muted-foreground">无分支差异</li>
          </ul>
        </aside>

        <section class="min-w-0 flex-1 overflow-auto bg-muted/10 p-3">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <button
              class="h-8 rounded-md border border-border bg-background px-3 text-xs"
              :disabled="actionLoading === 'merge'"
              type="button"
              @click="doMerge"
            >
              {{ actionLoading === 'merge' ? '合并中...' : 'Merge' }}
            </button>
            <button
              class="h-8 rounded-md border border-border bg-background px-3 text-xs"
              :disabled="actionLoading === 'rebase'"
              type="button"
              @click="doRebase"
            >
              {{ actionLoading === 'rebase' ? '变基中...' : 'Rebase' }}
            </button>
            <button
              class="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground"
              :disabled="actionLoading === 'pr'"
              type="button"
              @click="openPrLink"
            >
              {{ actionLoading === 'pr' ? '生成中...' : 'PR Link' }}
            </button>
          </div>

          <p v-if="actionMessage" class="mb-2 text-xs text-muted-foreground">{{ actionMessage }}</p>
          <pre class="max-h-[calc(100%-5rem)] overflow-auto rounded-md border border-border bg-background p-3 text-xs text-foreground">{{ branchDiffText || '# no branch diff' }}</pre>
        </section>
      </div>
    </div>
  </div>
</template>
