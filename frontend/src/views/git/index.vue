<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { gitApi } from '@/api/git'
import { useMessage } from '@/hooks'
import type { GitBranches, GitCommitSummary, GitStatus } from '@/types/api/git'
import { STORAGE_KEYS } from '@/types/common/storage'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'GitView',
})

const message = useMessage()
const route = useRoute()

const loading = ref(false)
const refreshing = ref(false)
const pullingMain = ref(false)
const branchData = ref<GitBranches>({
  defaultBranch: 'main',
  currentBranch: null,
  localBranches: [],
  remoteBranches: [],
})
const statusInfo = ref<GitStatus | null>(null)
const commits = ref<GitCommitSummary[]>([])
const lastPullOutput = ref('')

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const resolveStoredProjectId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const activeProjectId = computed(() => {
  return normalizeRouteParam(route.query.projectId) || resolveStoredProjectId()
})

const defaultBranchName = computed(() => {
  return statusInfo.value?.defaultBranch || branchData.value.defaultBranch
})

const currentBranchName = computed(() => {
  return statusInfo.value?.currentBranch ?? branchData.value.currentBranch
})

const localBranchCount = computed(() => branchData.value.localBranches.length)
const remoteBranchCount = computed(() => branchData.value.remoteBranches.length)

const branchCount = computed(() => {
  const unique = new Set([
    ...branchData.value.localBranches,
    ...branchData.value.remoteBranches,
  ])

  return unique.size
})

const isOnDefaultBranch = computed(() => {
  if (statusInfo.value) {
    return statusInfo.value.isOnDefaultBranch
  }

  return currentBranchName.value === defaultBranchName.value
})

const hasProjectId = computed(() => Boolean(activeProjectId.value))
const canPullMain = computed(() => {
  return hasProjectId.value && isOnDefaultBranch.value && !loading.value && !pullingMain.value
})

const syncStatus = computed(() => {
  if (!hasProjectId.value) {
    return {
      label: '未选择项目',
      detail: '当前页面缺少 projectId，暂时无法读取仓库信息。',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    }
  }

  if (!currentBranchName.value) {
    return {
      label: '等待加载分支',
      detail: '仓库分支信息加载后会显示当前分支状态。',
      badgeClass: 'bg-muted text-muted-foreground',
    }
  }

  if (statusInfo.value?.hasUncommittedChanges) {
    return {
      label: `工作区有 ${statusInfo.value.changedFilesCount} 个未提交变更`,
      detail: `当前位于 ${currentBranchName.value}。同步前建议先确认这些改动是否安全保留。`,
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    }
  }

  if (isOnDefaultBranch.value) {
    return {
      label: `已位于 ${defaultBranchName.value}`,
      detail: '可以直接拉取主分支最新代码。',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    }
  }

  return {
    label: `当前位于 ${currentBranchName.value}`,
    detail: `拉取前需要先切换到 ${defaultBranchName.value}。`,
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  }
})

const branchSummaryItems = computed(() => [
  {
    label: '当前分支',
    value: currentBranchName.value || '-',
  },
  {
    label: '默认分支',
    value: defaultBranchName.value,
  },
  {
    label: '本地分支',
    value: `${localBranchCount.value}`,
  },
  {
    label: '远端分支',
    value: `${remoteBranchCount.value}`,
  },
  {
    label: '工作区状态',
    value: !statusInfo.value
      ? '待加载'
      : statusInfo.value.hasUncommittedChanges
        ? `${statusInfo.value.changedFilesCount} 个变更`
        : '干净',
  },
])

const formatCommitTime = (value: string) => {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const resetGitData = () => {
  branchData.value = {
    defaultBranch: 'main',
    currentBranch: null,
    localBranches: [],
    remoteBranches: [],
  }
  statusInfo.value = null
  commits.value = []
}

const loadGitData = async (options: { keepContent?: boolean } = {}) => {
  const projectId = activeProjectId.value
  if (!projectId) {
    loading.value = false
    refreshing.value = false
    resetGitData()
    return
  }

  if (options.keepContent) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  const previousBranches = branchData.value
  const previousStatus = statusInfo.value
  const previousCommits = commits.value

  try {
    const nextBranches = await gitApi.branches(projectId)
    const nextStatus = await gitApi.status(projectId)
    const nextLog = await gitApi.log(projectId)

    branchData.value = nextBranches
    statusInfo.value = nextStatus
    commits.value = nextLog.commits
  } catch (error) {
    if (options.keepContent) {
      branchData.value = previousBranches
      statusInfo.value = previousStatus
      commits.value = previousCommits
    } else {
      resetGitData()
    }
    message.error(toErrorMessage(error, '读取 Git 信息失败'))
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const pullMainBranch = async () => {
  const projectId = activeProjectId.value
  if (!projectId) {
    message.error('缺少 projectId，请先选择项目')
    return
  }

  pullingMain.value = true

  try {
    const result = await gitApi.pullMain(projectId)
    lastPullOutput.value = result.output
    message.success(`已拉取 ${result.branch} 分支最新代码`)
    await loadGitData({ keepContent: true })
  } catch (error) {
    message.error(toErrorMessage(error, '拉取主分支失败'))
  } finally {
    pullingMain.value = false
  }
}

watch(activeProjectId, () => {
  lastPullOutput.value = ''
  void loadGitData()
}, { immediate: true })
</script>

<template>
  <div class="space-y-5 fade-up">
    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_22rem]">
      <article class="panel-card p-5">
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span class="inline-flex rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
              Git
            </span>
            <span class="font-mono">{{ activeProjectId || '未选择 projectId' }}</span>
            <span v-if="refreshing" class="text-primary">刷新中...</span>
          </div>

          <div class="space-y-2">
            <h2 class="text-2xl font-semibold tracking-tight md:text-3xl">{{ syncStatus.label }}</h2>
            <p class="text-sm leading-relaxed text-muted-foreground">{{ syncStatus.detail }}</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canPullMain"
              @click="pullMainBranch"
            >
              {{ pullingMain ? '拉取中...' : `拉取 ${defaultBranchName} 最新代码` }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading || !hasProjectId"
              @click="loadGitData({ keepContent: true })"
            >
              {{ refreshing || loading ? '刷新中...' : '刷新分支' }}
            </button>
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="syncStatus.badgeClass">
              {{ !hasProjectId ? '需选择项目' : statusInfo?.hasUncommittedChanges ? '有未提交变更' : isOnDefaultBranch ? '可拉取' : '需切换分支' }}
            </span>
          </div>

          <p v-if="!hasProjectId" class="text-xs text-amber-700 dark:text-amber-300">
            当前 URL 缺少 projectId，请使用 `?projectId=&lt;uuid&gt;` 访问或先在侧栏选择项目。
          </p>
        </div>
      </article>

      <article class="panel-card p-5">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">仓库摘要</p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <article
            v-for="item in branchSummaryItems"
            :key="item.label"
            class="rounded-2xl border border-border/80 bg-background/60 px-4 py-3"
          >
            <p class="text-xs text-muted-foreground">{{ item.label }}</p>
            <p class="mt-1 break-all text-lg font-semibold">{{ item.value }}</p>
          </article>
          <article class="rounded-2xl border border-border/80 bg-background/60 px-4 py-3">
            <p class="text-xs text-muted-foreground">分支总数（去重）</p>
            <p class="mt-1 text-lg font-semibold">{{ branchCount }}</p>
          </article>
        </div>
      </article>
    </section>

    <section class="panel-card p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold">最近提交</p>
          <p class="mt-1 text-xs text-muted-foreground">展示仓库最近 8 条提交记录。</p>
        </div>
        <p class="text-xs text-muted-foreground">{{ commits.length }} 条</p>
      </div>

      <div v-if="loading && !refreshing" class="mt-4 text-sm text-muted-foreground">加载中...</div>
      <div v-else class="mt-4 space-y-2">
        <article
          v-for="commit in commits"
          :key="commit.sha"
          class="rounded-xl border border-border bg-background/70 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-foreground">{{ commit.message }}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                <span class="font-mono">{{ commit.shortSha }}</span>
                <span class="mx-1.5">·</span>
                <span>{{ commit.authorName }}</span>
              </p>
            </div>
            <span class="shrink-0 text-xs text-muted-foreground">{{ formatCommitTime(commit.committedAt) }}</span>
          </div>
        </article>
        <p v-if="commits.length === 0" class="text-sm text-muted-foreground">暂无提交记录。</p>
      </div>
    </section>

    <section v-if="lastPullOutput" class="panel-card p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold">最近一次拉取输出</p>
          <p class="mt-1 text-xs text-muted-foreground">保留后端最近返回的命令执行结果。</p>
        </div>
        <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">最新结果</span>
      </div>
      <pre class="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background/70 p-4 text-xs text-foreground">{{ lastPullOutput }}</pre>
    </section>
  </div>
</template>
