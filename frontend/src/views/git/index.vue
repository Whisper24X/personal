<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { gitApi } from '@/api/git'
import AppSelect from '@/components/core/select'
import { useMessage } from '@/hooks'
import type { GitBranchDetail, GitCommitSummary } from '@/types/api/git'
import { STORAGE_KEYS } from '@/types/common/storage'
import { toErrorMessage } from '@/utils/http/to-error-message'

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
const filterType = ref<'all' | 'local' | 'remote' | 'current'>('all')
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

const loadBranches = async () => {
  const projectId = activeProjectId.value
  if (!projectId) {
    branches.value = []
    return
  }

  loading.value = true
  try {
    // 临时方案：使用现有API组合数据，等后端实现 branches-detail API 后替换
    const [branchData, statusData, logData] = await Promise.all([
      gitApi.branches(projectId),
      gitApi.status(projectId),
      gitApi.log(projectId, { limit: 1 }),
    ])

    const lastCommit = logData.commits[0] || {
      sha: '',
      shortSha: '',
      message: 'No commits',
      authorName: '',
      committedAt: new Date().toISOString(),
    }

    // 组合本地和远程分支
    const branchDetails: GitBranchDetail[] = []
    const localSet = new Set(branchData.localBranches)
    const remoteSet = new Set(branchData.remoteBranches)

    // 处理本地分支
    branchData.localBranches.forEach(name => {
      const hasRemote = remoteSet.has(name) || remoteSet.has(`origin/${name}`)
      branchDetails.push({
        name,
        type: hasRemote ? 'both' : 'local',
        isCurrent: name === statusData.currentBranch,
        ahead: 0, // 临时数据，等后端API
        behind: 0,
        lastCommit: {
          sha: lastCommit.sha,
          shortSha: lastCommit.shortSha,
          message: lastCommit.message,
          author: lastCommit.authorName,
          committedAt: lastCommit.committedAt,
        },
      })
    })

    // 处理仅远程分支
    branchData.remoteBranches.forEach(name => {
      const cleanName = name.replace(/^origin\//, '')
      if (!localSet.has(cleanName)) {
        branchDetails.push({
          name,
          type: 'remote',
          isCurrent: false,
          ahead: 0,
          behind: 0,
          lastCommit: {
            sha: lastCommit.sha,
            shortSha: lastCommit.shortSha,
            message: lastCommit.message,
            author: lastCommit.authorName,
            committedAt: lastCommit.committedAt,
          },
        })
      }
    })

    branches.value = branchDetails
  } catch (error) {
    message.error(toErrorMessage(error, '读取分支信息失败'))
    branches.value = []
  } finally {
    loading.value = false
  }
}


const toggleBranchExpand = async (branchName: string) => {
  if (expandedBranch.value === branchName) {
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
  } catch (error) {
    message.error(toErrorMessage(error, '拉取分支失败'))
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
              <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span class="font-mono">{{ branch.lastCommit.shortSha }}</span>
                <span>·</span>
                <span>{{ branch.lastCommit.author }}</span>
                <span>·</span>
                <span>{{ formatCommitTime(branch.lastCommit.committedAt) }}</span>
              </div>
            </div>

            <!-- 同步状态 -->
            <div class="shrink-0">
              <span class="text-sm font-semibold" :class="getSyncStatus(branch).class">
                {{ getSyncStatus(branch).text }}
              </span>
            </div>

            <!-- 操作按钮 -->
            <div class="flex shrink-0 items-center gap-1">
              <button
                v-if="branch.ahead > 0 && (branch.type === 'local' || branch.type === 'both')"
                type="button"
                class="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                :disabled="operatingBranch === branch.name"
                @click="pushBranch(branch.name)"
              >
                {{ operatingBranch === branch.name ? '推送中...' : '推送' }}
              </button>
              <button
                v-if="branch.behind > 0 && (branch.type === 'local' || branch.type === 'both')"
                type="button"
                class="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                :disabled="operatingBranch === branch.name"
                @click="pullBranch(branch.name)"
              >
                {{ operatingBranch === branch.name ? '拉取中...' : '拉取' }}
              </button>
              <button
                v-if="branch.name !== 'main' && branch.name !== 'master'"
                type="button"
                class="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                :disabled="operatingBranch === branch.name"
                @click="openDeleteConfirm(branch.name, branch.type === 'remote')"
              >
                删除
              </button>
              <button
                type="button"
                class="rounded-lg border border-border bg-background p-1 transition hover:bg-muted"
                :aria-expanded="expandedBranch === branch.name"
                :aria-label="expandedBranch === branch.name ? `收起 ${branch.name} 的提交记录` : `展开 ${branch.name} 的提交记录`"
                @click="toggleBranchExpand(branch.name)"
              >
                <svg class="h-4 w-4 transition" :class="expandedBranch === branch.name ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 展开的提交列表 -->
          <div v-if="expandedBranch === branch.name" class="border-t border-border px-4 py-3">
            <p class="mb-2 text-xs font-semibold text-muted-foreground">最近提交</p>
            <div v-if="loadingBranchCommits[branch.name]" class="text-xs text-muted-foreground">加载中...</div>
            <div v-else-if="branchCommits[branch.name]" class="space-y-1">
              <div
                v-for="commit in branchCommits[branch.name]"
                :key="commit.sha"
                class="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
              >
                <p class="truncate text-xs font-semibold">{{ commit.message }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  <span class="font-mono">{{ commit.shortSha }}</span>
                  <span class="mx-1">·</span>
                  <span>{{ commit.authorName }}</span>
                  <span class="mx-1">·</span>
                  <span>{{ formatCommitTime(commit.committedAt) }}</span>
                </p>
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
