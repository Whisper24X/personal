<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { gitApi } from '@/api/git'
import AppSelect from '@shared/components/select'
import { useMessage } from '@app/composables/useMessage'
import type { GitBranchDetail, GitCommitSummary } from '@/types/api/git'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { toErrorMessage } from '@api/shared/to-error-message'

defineOptions({
  name: 'GitBranchManagement',
})

const message = useMessage()
const route = useRoute()

const loading = ref(false)
const branches = ref<GitBranchDetail[]>([])
const expandedBranch = ref<string | null>(null)
const branchCommits = ref<Record<string, GitCommitSummary[]>>({})
const loadingBranchCommits = ref<Record<string, boolean>>({})
const filterType = ref<'all' | 'local' | 'remote' | 'current'>('current')
const operatingBranch = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const deletingBranchName = ref('')
const deletingBranchIsRemote = ref(false)

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

const filteredBranches = computed(() => {
  if (filterType.value === 'all') return branches.value
  if (filterType.value === 'current') return branches.value.filter(b => b.isCurrent)
  if (filterType.value === 'local') return branches.value.filter(b => b.type === 'local' || b.type === 'both')
  if (filterType.value === 'remote') return branches.value.filter(b => b.type === 'remote' || b.type === 'both')
  return branches.value
})

const branchTypeConfig = {
  local: { label: '仅本地', class: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  remote: { label: '仅远程', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  both: { label: '本地+远程', class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
}

const getSyncStatus = (branch: GitBranchDetail) => {
  if (branch.ahead === 0 && branch.behind === 0) {
    return { text: '✓ 已同步', class: 'text-emerald-600 dark:text-emerald-400' }
  }
  if (branch.ahead > 0 && branch.behind === 0) {
    return { text: `↑${branch.ahead}`, class: 'text-blue-600 dark:text-blue-400' }
  }
  if (branch.ahead === 0 && branch.behind > 0) {
    return { text: `↓${branch.behind}`, class: 'text-amber-600 dark:text-amber-400' }
  }
  return { text: `↑${branch.ahead}↓${branch.behind}`, class: 'text-red-600 dark:text-red-400' }
}

const FILTER_TYPE_OPTIONS = [
  { label: '全部分支', value: 'all' },
  { label: '当前分支', value: 'current' },
  { label: '本地分支', value: 'local' },
  { label: '远程分支', value: 'remote' },
] as const

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

const getBranchMetaItems = (branch: GitBranchDetail) => {
  const items = [
    branch.lastCommit.shortSha
      ? { key: 'sha', label: branch.lastCommit.shortSha, class: 'font-mono' }
      : null,
    branch.lastCommit.author
      ? { key: 'author', label: branch.lastCommit.author, class: '' }
      : null,
    branch.lastCommit.committedAt
      ? { key: 'time', label: formatCommitTime(branch.lastCommit.committedAt), class: '' }
      : null,
  ]

  return items.filter((item): item is { key: string; label: string; class: string } => Boolean(item))
}

const getCommitMetaItems = (commit: GitCommitSummary) => {
  const items = [
    commit.shortSha
      ? { key: 'sha', label: commit.shortSha, class: 'rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]' }
      : null,
    commit.authorName
      ? { key: 'author', label: commit.authorName, class: '' }
      : null,
    commit.committedAt
      ? { key: 'time', label: formatCommitTime(commit.committedAt), class: '' }
      : null,
  ]

  return items.filter((item): item is { key: string; label: string; class: string } => Boolean(item))
}

const loadBranches = async () => {
  const projectId = activeProjectId.value
  if (!projectId) {
    branches.value = []
    return
  }

  loading.value = true
  try {
    const branchData = await gitApi.branchesDetail(projectId)
    branches.value = branchData.branches
    window.dispatchEvent(new Event('git-sync-updated'))
  } catch (error) {
    message.error(toErrorMessage(error, '读取分支信息失败'))
    branches.value = []
  } finally {
    loading.value = false
  }
}

const canPullBranch = (branch: GitBranchDetail) => {
  return branch.isCurrent && (branch.type === 'local' || branch.type === 'both') && branch.behind > 0
}

/** 当前检出分支相对其跟踪远端已分歧（领先 / 落后 / 双方均有），可强制对齐远端 */
const canResetBranch = (branch: GitBranchDetail) => {
  return (
    branch.isCurrent &&
    (branch.type === 'local' || branch.type === 'both') &&
    (branch.ahead > 0 || branch.behind > 0)
  )
}

const isBranchExpanded = (branchName: string) => {
  return expandedBranch.value === branchName
}

const getLogToggleLabel = (branchName: string) => {
  return isBranchExpanded(branchName) ? '收起日志' : '查看日志'
}


const toggleBranchExpand = async (branchName: string) => {
  if (isBranchExpanded(branchName)) {
    expandedBranch.value = null
    return
  }

  expandedBranch.value = branchName

  if (branchCommits.value[branchName]) return

  const projectId = activeProjectId.value
  if (!projectId) return

  loadingBranchCommits.value[branchName] = true
  try {
    const result = await gitApi.log(projectId, { limit: 5, offset: 0 })
    branchCommits.value[branchName] = result.commits
  } catch (error) {
    message.error(toErrorMessage(error, '读取提交记录失败'))
  } finally {
    loadingBranchCommits.value[branchName] = false
  }
}

const openDeleteConfirm = (branchName: string, isRemote: boolean) => {
  deletingBranchName.value = branchName
  deletingBranchIsRemote.value = isRemote
  showDeleteConfirm.value = true
}

const deleteBranch = async () => {
  const projectId = activeProjectId.value
  if (!projectId) return

  const branchName = deletingBranchName.value
  const isRemote = deletingBranchIsRemote.value

  showDeleteConfirm.value = false
  operatingBranch.value = branchName
  try {
    await gitApi.deleteBranch(projectId, branchName, isRemote)
    message.success(`已删除分支 ${branchName}`)
    await loadBranches()
  } catch (error) {
    message.error(toErrorMessage(error, '删除分支失败'))
  } finally {
    operatingBranch.value = null
  }
}


const pushBranch = async (branchName: string) => {
  const projectId = activeProjectId.value
  if (!projectId) return

  operatingBranch.value = branchName
  try {
    const result = await gitApi.pushBranch(projectId, branchName)
    message.success(`已推送分支 ${branchName}，推送了 ${result.pushedCommits} 个提交`)
    await loadBranches()
    window.dispatchEvent(new Event('git-sync-updated'))
  } catch (error) {
    message.error(toErrorMessage(error, '推送分支失败'))
  } finally {
    operatingBranch.value = null
  }
}


const pullBranch = async (branchName: string) => {
  const projectId = activeProjectId.value
  if (!projectId) return

  operatingBranch.value = branchName
  try {
    await gitApi.pullBranch(projectId, branchName)
    message.success(`已拉取分支 ${branchName}`)
    await loadBranches()
    window.dispatchEvent(new Event('git-sync-updated'))
  } catch (error) {
    message.error(toErrorMessage(error, '拉取分支失败'))
  } finally {
    operatingBranch.value = null
  }
}

const resetBranch = async (branchName: string) => {
  const projectId = activeProjectId.value
  if (!projectId) return

  operatingBranch.value = branchName
  try {
    await gitApi.resetBranch(projectId, branchName)
    message.success(`已重置分支 ${branchName} 到远端最新`)
    await loadBranches()
    window.dispatchEvent(new Event('git-sync-updated'))
  } catch (error) {
    message.error(toErrorMessage(error, '重置分支失败'))
  } finally {
    operatingBranch.value = null
  }
}

watch(activeProjectId, () => {
  void loadBranches()
}, { immediate: true })

</script>

<template>
  <div class="space-y-5 fade-up">
    <!-- 顶部操作栏 -->
    <section class="panel-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold">分支管理</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            管理本地和远程分支，查看同步状态
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold transition hover:bg-muted"
            :disabled="loading"
            @click="loadBranches"
          >
            {{ loading ? '刷新中...' : '刷新' }}
          </button>
          <AppSelect
            v-model="filterType"
            aria-label="分支筛选"
            :block="false"
            :options="[...FILTER_TYPE_OPTIONS]"
            trigger-class="rounded-lg border-border bg-background px-3 py-2 text-sm font-semibold shadow-none"
          />
        </div>
      </div>
    </section>

    <!-- 分支列表 -->
    <section class="panel-card p-5">
      <div v-if="loading" class="text-center text-sm text-muted-foreground">加载中...</div>
      <div v-else-if="filteredBranches.length === 0" class="text-center text-sm text-muted-foreground">
        暂无分支
      </div>
      <div v-else class="space-y-2">
        <!-- 分支行 -->
        <article
          v-for="branch in filteredBranches"
          :key="branch.name"
          class="rounded-xl border border-border bg-background/70"
        >
          <!-- 分支主信息 -->
          <div class="flex items-center gap-3 px-4 py-3">
            <!-- 分支名 -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span v-if="branch.isCurrent" class="text-primary">⭐</span>
                <span class="font-mono text-sm font-semibold" :class="branch.isCurrent ? 'text-primary' : 'text-foreground'">
                  {{ branch.name }}
                </span>
                <span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold" :class="branchTypeConfig[branch.type].class">
                  {{ branchTypeConfig[branch.type].label }}
                </span>
              </div>
              <div v-if="getBranchMetaItems(branch).length > 0" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <template v-for="(item, index) in getBranchMetaItems(branch)" :key="item.key">
                  <span v-if="index > 0" aria-hidden="true">·</span>
                  <span :class="item.class">{{ item.label }}</span>
                </template>
              </div>
            </div>

            <!-- 同步状态 -->
            <div class="shrink-0">
              <span class="text-sm font-semibold" :class="getSyncStatus(branch).class">
                {{ getSyncStatus(branch).text }}
              </span>
            </div>

            <!-- 操作按钮 -->
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                v-if="branch.ahead > 0 && (branch.type === 'local' || branch.type === 'both')"
                type="button"
                class="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                :disabled="operatingBranch === branch.name"
                @click="pushBranch(branch.name)"
              >
                {{ operatingBranch === branch.name ? '推送中...' : '推送' }}
              </button>
              <button
                v-if="canPullBranch(branch)"
                type="button"
                class="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                :disabled="operatingBranch === branch.name"
                @click="pullBranch(branch.name)"
              >
                {{ operatingBranch === branch.name ? '拉取中...' : '拉取' }}
              </button>
              <button
                v-if="canResetBranch(branch)"
                type="button"
                class="inline-flex h-8 items-center rounded-full border border-amber-200/70 bg-amber-50/70 px-3 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100/80 disabled:opacity-50 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:border-amber-400/30 dark:hover:bg-amber-500/15"
                :disabled="operatingBranch === branch.name"
                title="强制重置到远端最新，丢弃本地差异"
                @click="resetBranch(branch.name)"
              >
                {{ operatingBranch === branch.name ? '重置中...' : '重置' }}
              </button>
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 px-3 text-xs font-semibold text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground"
                :aria-expanded="isBranchExpanded(branch.name)"
                :aria-label="isBranchExpanded(branch.name) ? `收起 ${branch.name} 的提交记录` : `展开 ${branch.name} 的提交记录`"
                @click="toggleBranchExpand(branch.name)"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8M8 12h8M8 17h5" />
                </svg>
                <span>{{ getLogToggleLabel(branch.name) }}</span>
                <svg class="h-3.5 w-3.5 transition" :class="isBranchExpanded(branch.name) ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                v-if="branch.name !== 'main' && branch.name !== 'master'"
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-200/70 bg-red-50/70 px-3 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100/80 disabled:opacity-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-400/30 dark:hover:bg-red-500/15"
                :disabled="operatingBranch === branch.name"
                @click="openDeleteConfirm(branch.name, branch.type === 'remote')"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 7h12M9 7V5h6v2m-7 4v6m4-6v6m4-6v6m-9 3h10a2 2 0 002-2V7H5v11a2 2 0 002 2z" />
                </svg>
                删除
              </button>
            </div>
          </div>

          <!-- 展开的提交列表 -->
          <div v-if="isBranchExpanded(branch.name)" class="border-t border-border bg-muted/20 px-4 py-3">
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-xs font-semibold tracking-[0.12em] text-muted-foreground">最近 5 条提交</p>
              <span class="rounded-full bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {{ branch.name }}
              </span>
            </div>
            <div v-if="loadingBranchCommits[branch.name]" class="text-xs text-muted-foreground">加载中...</div>
            <div v-else-if="branchCommits[branch.name]?.length === 0" class="rounded-xl border border-dashed border-border bg-background/70 px-3 py-4 text-xs text-muted-foreground">
              暂无提交记录
            </div>
            <div v-else-if="branchCommits[branch.name]" class="space-y-1">
              <div
                v-for="commit in branchCommits[branch.name]"
                :key="commit.sha"
                class="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 transition hover:border-border hover:bg-background"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-semibold text-foreground">{{ commit.message }}</p>
                    <p v-if="getCommitMetaItems(commit).length > 0" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <template v-for="(item, index) in getCommitMetaItems(commit)" :key="item.key">
                        <span v-if="index > 0" aria-hidden="true">·</span>
                        <span :class="item.class">{{ item.label }}</span>
                      </template>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @keydown.esc.prevent.stop="showDeleteConfirm = false"
        @click.self="showDeleteConfirm = false"
      >
        <div
          aria-describedby="git-delete-branch-description"
          aria-labelledby="git-delete-branch-title"
          aria-modal="true"
          role="dialog"
          class="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
        >
          <h3 id="git-delete-branch-title" class="text-lg font-semibold">确认删除</h3>
          <p id="git-delete-branch-description" class="mt-2 text-sm text-muted-foreground">
            确定要删除{{ deletingBranchIsRemote ? '远程' : '本地' }}分支 <span class="font-mono font-semibold text-foreground">{{ deletingBranchName }}</span> 吗？
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
              @click="showDeleteConfirm = false"
            >
              取消
            </button>
            <button
              type="button"
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              @click="deleteBranch"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
