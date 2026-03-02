<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { mcpsApi } from '@/api/mcps'
import type { Mcp } from '@/types/api/mcps'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'McpManagementView',
})

const PAGE_LIMIT = 30

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const loadingMore = ref(false)
const keyword = ref('')
const enabledOnly = ref(false)
const mcps = ref<Mcp[]>([])
const page = ref(1)
const hasNextPage = ref(false)

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const activeProjectId = computed(() => normalizeRouteParam(route.query.projectId))

const resolveCatalogSourcePath = (payload?: Record<string, unknown> | null) => {
  if (!payload || typeof payload !== 'object') {
    return '-'
  }

  const sourcePath = payload.sourcePath
  if (typeof sourcePath !== 'string') {
    return '-'
  }

  const normalized = sourcePath.trim()
  return normalized || '-'
}

const loadMcps = async (reset = true) => {
  const projectId = activeProjectId.value

  if (!projectId) {
    mcps.value = []
    hasNextPage.value = false
    page.value = 1
    return
  }

  const nextPage = reset ? 1 : page.value + 1

  if (reset) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const response = await mcpsApi.list({
      page: nextPage,
      limit: PAGE_LIMIT,
      keyword: keyword.value.trim() || undefined,
      enabled: enabledOnly.value ? true : undefined,
      projectId,
    })

    if (reset) {
      mcps.value = response.data
    } else {
      const existingIds = new Set(mcps.value.map((item) => item.id))
      mcps.value = mcps.value.concat(
        response.data.filter((item) => !existingIds.has(item.id)),
      )
    }

    page.value = nextPage
    hasNextPage.value = response.hasNextPage
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目本地 MCP 列表失败'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

watch(
  () => activeProjectId.value,
  () => {
    void loadMcps(true)
  },
)

onMounted(() => {
  void loadMcps(true)
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MCP</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目本地 MCP 管理</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        当前页面读取项目本地 Agent CLI 配置（如 `.codex/.cursor`）中的 MCP 列表。
      </p>
      <p class="font-mono text-xs text-muted-foreground">
        当前项目：{{ activeProjectId || '未选择项目' }}
      </p>
    </section>

    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 提供方"
            type="search"
          />
          <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input v-model="enabledOnly" class="h-4 w-4" type="checkbox" />
            仅显示启用
          </label>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="loadMcps(true)"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="loadMcps(true)"
          >
            搜索
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="!activeProjectId"
      class="panel-card p-6 text-sm text-muted-foreground"
    >
      请先在左侧选择项目后再查看 MCP。
    </section>

    <section v-else-if="loading" class="panel-card p-6 text-sm text-muted-foreground">加载中...</section>

    <section v-else class="panel-card p-5">
      <div class="space-y-3">
        <article
          v-for="server in mcps"
          :key="server.id"
          class="rounded-xl border border-border bg-background/70 px-4 py-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ server.name }}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                版本：{{ server.version }} · 提供方：{{ server.provider ?? '-' }} · 工具数量：{{ server.toolsCount }}
              </p>
            </div>
            <span
              class="rounded-full px-2 py-1 text-[10px] font-semibold"
              :class="server.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
            >
              {{ server.enabled ? '已启用' : '已停用' }}
            </span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">{{ server.description ?? '暂无描述' }}</p>
          <p class="mt-1 font-mono text-[11px] text-muted-foreground">
            {{ resolveCatalogSourcePath(server.metadataJson ?? null) }}
          </p>
        </article>

        <article v-if="mcps.length === 0" class="rounded-xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
          当前项目没有可读取的 MCP 本地配置。
        </article>
      </div>
    </section>

    <section v-if="activeProjectId && !loading && hasNextPage" class="panel-card p-4">
      <button
        class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loadingMore"
        type="button"
        @click="loadMcps(false)"
      >
        {{ loadingMore ? '加载中...' : '加载更多' }}
      </button>
    </section>
  </div>
</template>
