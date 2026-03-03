<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { gitApi } from '@/api/git'
import { useMessage } from '@/hooks'
import type { GitBranches } from '@/types/api/git'
import { STORAGE_KEYS } from '@/types/common/storage'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'GitView',
})

const message = useMessage()
const route = useRoute()

const loading = ref(false)
const pullingMain = ref(false)
const branchData = ref<GitBranches>({
  defaultBranch: 'main',
  currentBranch: null,
  localBranches: [],
  remoteBranches: [],
})
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

const branchCount = computed(() => {
  const unique = new Set([
    ...branchData.value.localBranches,
    ...branchData.value.remoteBranches,
  ])

  return unique.size
})

const isOnDefaultBranch = computed(() => {
  return branchData.value.currentBranch === branchData.value.defaultBranch
})

const hasProjectId = computed(() => Boolean(activeProjectId.value))

const loadBranches = async () => {
  const projectId = activeProjectId.value
  if (!projectId) {
    branchData.value = {
      defaultBranch: 'main',
      currentBranch: null,
      localBranches: [],
      remoteBranches: [],
    }
    return
  }

  loading.value = true

  try {
    branchData.value = await gitApi.branches(projectId)
  } catch (error) {
    message.error(toErrorMessage(error, '读取分支信息失败'))
  } finally {
    loading.value = false
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
    await loadBranches()
  } catch (error) {
    message.error(toErrorMessage(error, '拉取主分支失败'))
  } finally {
    pullingMain.value = false
  }
}

watch(activeProjectId, () => {
  lastPullOutput.value = ''
  void loadBranches()
}, { immediate: true })
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Git</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目级 Git 工具</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        基于当前项目（projectId）查看仓库分支，并拉取项目主分支最新代码。
      </p>
    </section>

    <section class="grid gap-4 md:grid-cols-3">
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">当前分支</p>
        <p class="mt-2 text-2xl font-semibold">{{ branchData.currentBranch || '-' }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">分支总数（去重）</p>
        <p class="mt-2 text-2xl font-semibold">{{ branchCount }}</p>
      </article>
      <article class="panel-card p-4">
        <p class="text-xs text-muted-foreground">主分支状态</p>
        <p class="mt-2 text-2xl font-semibold">{{ isOnDefaultBranch ? branchData.defaultBranch : `非 ${branchData.defaultBranch}` }}</p>
      </article>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="pullingMain || !hasProjectId"
          @click="pullMainBranch"
        >
          {{ pullingMain ? '拉取中...' : '拉取主分支最新代码' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || !hasProjectId"
          @click="loadBranches"
        >
          {{ loading ? '刷新中...' : '刷新分支' }}
        </button>
      </div>
      <p v-if="!hasProjectId" class="mt-3 text-xs text-amber-700 dark:text-amber-300">
        当前 URL 缺少 projectId，请使用 `?projectId=&lt;uuid&gt;` 访问或先在侧栏选择项目。
      </p>
      <p v-else-if="!isOnDefaultBranch" class="mt-3 text-xs text-amber-700 dark:text-amber-300">
        当前不在 {{ branchData.defaultBranch }} 分支，拉取操作会被后端拒绝，请先切换到 {{ branchData.defaultBranch }}。
      </p>
      <div v-if="lastPullOutput" class="mt-4 rounded-lg border border-border bg-background/70 p-3">
        <p class="text-xs font-semibold text-muted-foreground">最近一次拉取输出</p>
        <pre class="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">{{ lastPullOutput }}</pre>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <article class="panel-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">本地分支</p>
          <p class="text-xs text-muted-foreground">{{ branchData.localBranches.length }} 个</p>
        </div>
        <div v-if="loading" class="mt-3 text-sm text-muted-foreground">加载中...</div>
        <div v-else class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="branch in branchData.localBranches"
            :key="`local-${branch}`"
            class="rounded-full border px-3 py-1 text-xs"
            :class="
              branch === branchData.currentBranch
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-background/70 text-foreground'
            "
          >
            {{ branch }}
          </span>
          <p v-if="branchData.localBranches.length === 0" class="text-sm text-muted-foreground">暂无本地分支。</p>
        </div>
      </article>

      <article class="panel-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">远端分支（origin）</p>
          <p class="text-xs text-muted-foreground">{{ branchData.remoteBranches.length }} 个</p>
        </div>
        <div v-if="loading" class="mt-3 text-sm text-muted-foreground">加载中...</div>
        <div v-else class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="branch in branchData.remoteBranches"
            :key="`remote-${branch}`"
            class="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-foreground"
          >
            {{ branch }}
          </span>
          <p v-if="branchData.remoteBranches.length === 0" class="text-sm text-muted-foreground">暂无远端分支。</p>
        </div>
      </article>
    </section>
  </div>
</template>
