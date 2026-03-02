<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { mcpsApi } from '@/api/mcps'
import type { Mcp } from '@/types/api/mcps'
import { toErrorMessage } from '@/utils/http/to-error-message'

defineOptions({
  name: 'McpManagementView',
})

type ProviderGroup = {
  id: string
  label: string
  configured: boolean
  serverCount: number
  servers: Mcp[]
}

const PAGE_LIMIT = 50
const PROJECT_PROVIDER_ORDER = ['codex', 'cursor']
const PROVIDER_LABEL_MAP: Record<string, string> = {
  codex: 'Codex',
  cursor: 'Cursor',
}

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const refreshing = ref(false)
const mcps = ref<Mcp[]>([])
const detailServer = ref<Mcp | null>(null)
const requestToken = ref(0)

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

const resolveMetadataField = (
  payload: Record<string, unknown> | null | undefined,
  key: string,
) => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const value = payload[key]
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

const resolveSourceProvider = (server: Mcp) => {
  const fromMetadata = resolveMetadataField(server.metadataJson ?? null, 'sourceProvider')
  return fromMetadata || 'unknown'
}

const resolveSourcePath = (server: Mcp) => {
  return resolveMetadataField(server.metadataJson ?? null, 'sourcePath') || '-'
}

const resolveProviderLabel = (provider: string) => {
  return PROVIDER_LABEL_MAP[provider] ?? provider
}

const groupedProjectMcps = computed<ProviderGroup[]>(() => {
  const grouped = new Map<string, Mcp[]>()

  for (const server of mcps.value) {
    const provider = resolveSourceProvider(server)
    const existing = grouped.get(provider) ?? []
    existing.push(server)
    grouped.set(provider, existing)
  }

  for (const provider of grouped.keys()) {
    const existing = grouped.get(provider) ?? []
    existing.sort((left, right) => left.name.localeCompare(right.name))
    grouped.set(provider, existing)
  }

  const orderedProviders = [...PROJECT_PROVIDER_ORDER]
  for (const provider of grouped.keys()) {
    if (!orderedProviders.includes(provider)) {
      orderedProviders.push(provider)
    }
  }

  return orderedProviders.map((provider) => {
    const servers = grouped.get(provider) ?? []
    return {
      id: provider,
      label: resolveProviderLabel(provider),
      configured: servers.length > 0,
      serverCount: servers.length,
      servers,
    }
  })
})

const hasAnyProjectMcp = computed(() => {
  return groupedProjectMcps.value.some((group) => group.serverCount > 0)
})

const detailSourcePath = computed(() => {
  if (!detailServer.value) {
    return '-'
  }

  return resolveSourcePath(detailServer.value)
})

const detailMetadataText = computed(() => {
  if (!detailServer.value?.metadataJson) {
    return ''
  }

  return JSON.stringify(detailServer.value.metadataJson, null, 2)
})

const loadProjectMcps = async (options?: { silent?: boolean }) => {
  const projectId = activeProjectId.value
  const token = ++requestToken.value
  const silent = Boolean(options?.silent)

  if (!projectId) {
    mcps.value = []
    return
  }

  if (silent) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  try {
    const merged: Mcp[] = []
    const collected = new Set<string>()
    let nextPage = 1
    let hasNextPage = false

    do {
      const response = await mcpsApi.list({
        page: nextPage,
        limit: PAGE_LIMIT,
        projectId,
      })

      for (const server of response.data) {
        if (collected.has(server.id)) {
          continue
        }

        collected.add(server.id)
        merged.push(server)
      }

      hasNextPage = response.hasNextPage
      nextPage += 1
    } while (hasNextPage)

    if (token !== requestToken.value) {
      return
    }

    mcps.value = merged
  } catch (error) {
    if (token !== requestToken.value) {
      return
    }

    message.error(toErrorMessage(error, '加载项目 MCP 配置失败'))
  } finally {
    if (token !== requestToken.value) {
      return
    }

    loading.value = false
    refreshing.value = false
  }
}

const closeDetail = () => {
  detailServer.value = null
}

watch(
  () => activeProjectId.value,
  () => {
    closeDetail()
    void loadProjectMcps()
  },
  { immediate: true },
)
</script>

<template>
  <div class="fade-up flex h-full flex-col overflow-hidden">
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MCP</p>
        <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">项目 MCP 配置</h1>
        <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          仅展示当前项目目录中的 MCP 配置，不展示全局配置。
        </p>
        <p class="font-mono text-xs text-muted-foreground">
          当前项目：{{ activeProjectId || '未选择项目' }}
        </p>
      </div>

      <button
        class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!activeProjectId || loading || refreshing"
        type="button"
        @click="loadProjectMcps({ silent: true })"
      >
        {{ refreshing ? '刷新中...' : '刷新' }}
      </button>
    </section>

    <section class="mt-6 min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="!activeProjectId"
        class="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center"
      >
        <p class="text-base font-semibold">未选择项目</p>
        <p class="mt-2 max-w-md text-sm text-muted-foreground">
          请先在左侧选择一个项目，再查看该项目目录中的 MCP 配置。
        </p>
      </div>

      <div
        v-else-if="loading"
        class="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground"
      >
        加载中...
      </div>

      <div
        v-else-if="!hasAnyProjectMcp"
        class="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground"
      >
        当前项目目录中未发现 MCP 配置。
      </div>

      <div v-else class="space-y-6">
        <article
          v-for="group in groupedProjectMcps"
          :key="group.id"
          class="rounded-xl border border-border bg-background p-4"
        >
          <header class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-foreground">{{ group.label }}</h2>
            <div class="flex items-center gap-2">
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="group.configured ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
              >
                {{ group.configured ? '已配置' : '未配置' }}
              </span>
              <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {{ group.serverCount }} 个
              </span>
            </div>
          </header>

          <div v-if="group.serverCount > 0" class="mt-4 grid grid-cols-1 gap-3">
            <button
              v-for="server in group.servers"
              :key="server.id"
              type="button"
              class="w-full rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:border-foreground/20"
              @click="detailServer = server"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-foreground">{{ server.name }}</span>
                <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  v{{ server.version }}
                </span>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                工具数：{{ server.toolsCount }} · 状态：{{ server.enabled ? '启用' : '停用' }}
              </p>
            </button>
          </div>

          <div
            v-else
            class="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
          >
            当前来源未发现 MCP 配置
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="detailServer"
        class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
        @keydown.esc.prevent.stop="closeDetail"
      >
        <button
          type="button"
          aria-label="关闭 MCP 详情弹窗"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          @click="closeDetail"
        />

        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 class="text-base font-semibold">MCP 配置详情</h2>
            <button
              type="button"
              aria-label="关闭"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
              @click="closeDetail"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <article class="rounded-lg border border-border bg-background p-3">
                <p class="text-xs text-muted-foreground">名称</p>
                <p class="mt-1 text-sm font-semibold">{{ detailServer.name }}</p>
              </article>
              <article class="rounded-lg border border-border bg-background p-3">
                <p class="text-xs text-muted-foreground">版本</p>
                <p class="mt-1 text-sm font-semibold">{{ detailServer.version }}</p>
              </article>
              <article class="rounded-lg border border-border bg-background p-3">
                <p class="text-xs text-muted-foreground">来源</p>
                <p class="mt-1 text-sm font-semibold">
                  {{ resolveProviderLabel(resolveSourceProvider(detailServer)) }}
                </p>
              </article>
              <article class="rounded-lg border border-border bg-background p-3">
                <p class="text-xs text-muted-foreground">状态</p>
                <p class="mt-1 text-sm font-semibold">{{ detailServer.enabled ? '已启用' : '已停用' }}</p>
              </article>
              <article class="rounded-lg border border-border bg-background p-3">
                <p class="text-xs text-muted-foreground">提供方</p>
                <p class="mt-1 text-sm font-semibold">{{ detailServer.provider || '-' }}</p>
              </article>
              <article class="rounded-lg border border-border bg-background p-3">
                <p class="text-xs text-muted-foreground">工具数量</p>
                <p class="mt-1 text-sm font-semibold">{{ detailServer.toolsCount }}</p>
              </article>
            </div>

            <article class="mt-3 rounded-lg border border-border bg-background p-3">
              <p class="text-xs text-muted-foreground">描述</p>
              <p class="mt-1 text-sm">{{ detailServer.description || '暂无描述' }}</p>
            </article>

            <article class="mt-3 rounded-lg border border-border bg-background p-3">
              <p class="text-xs text-muted-foreground">配置文件路径</p>
              <p class="mt-1 break-all font-mono text-xs text-muted-foreground">{{ detailSourcePath }}</p>
            </article>

            <article v-if="detailMetadataText" class="mt-3 rounded-lg border border-border bg-background p-3">
              <p class="text-xs text-muted-foreground">元数据</p>
              <pre class="mt-2 max-h-56 overflow-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground">{{ detailMetadataText }}</pre>
            </article>
          </div>

          <footer class="border-t border-border px-4 py-3">
            <button
              type="button"
              class="h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              @click="closeDetail"
            >
              关闭
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>
