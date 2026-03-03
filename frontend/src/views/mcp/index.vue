<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@/hooks'
import { mcpsApi } from '@/api/mcps'
import type { Mcp, ProjectLocalMcpProvider } from '@/types/api/mcps'
import { STORAGE_KEYS } from '@/types/common/storage'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'
import McpJsonImportModal from '@/components/business/settings/modals/McpJsonImportModal.vue'

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
const MAX_PAGE_COUNT = 20
const PROJECT_PROVIDER_ORDER = ['cursor', 'gemini', 'opencode', 'claude-code', 'codex']
const PROVIDER_LABEL_MAP: Record<string, string> = {
  cursor: 'Cursor',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  'claude-code': 'Claude Code',
  codex: 'Codex',
}
const EDITABLE_PROVIDER_SET = new Set<ProjectLocalMcpProvider>([
  'cursor',
  'gemini',
  'opencode',
  'claude-code',
  'codex',
])

const route = useRoute()
const message = useMessage()

const loading = ref(false)
const keyword = ref('')
const mcps = ref<Mcp[]>([])
const requestToken = ref(0)

const addMenuOpen = ref(false)
const addMenuAnchorRef = ref<HTMLElement | null>(null)
const selectedImportProvider = ref<ProjectLocalMcpProvider | ''>('')
const mcpJsonImportModalOpen = ref(false)
const importingProjectMcps = ref(false)
const mcpJsonImportError = ref('')

const mcpJsonPreviewModalOpen = ref(false)
const loadingMcpJsonPreview = ref(false)
const mcpJsonPreviewName = ref('')
const mcpJsonPreviewSourcePath = ref('')
const mcpJsonPreviewProvider = ref<ProjectLocalMcpProvider | ''>('')
const mcpJsonPreviewError = ref('')
const mcpJsonPreviewDraft = ref('')
const savingMcpJsonPreview = ref(false)

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
  const fromMetadata = resolveMetadataField(server.metadataJson ?? null, 'sourceProvider').toLowerCase()
  return fromMetadata || 'unknown'
}

const resolveSourcePath = (server: Mcp) => {
  return resolveMetadataField(server.metadataJson ?? null, 'sourcePath') || ''
}

const resolveProviderLabel = (provider: string) => {
  return PROVIDER_LABEL_MAP[provider] ?? provider
}

const isEditableProvider = (provider: string): provider is ProjectLocalMcpProvider => {
  return EDITABLE_PROVIDER_SET.has(provider as ProjectLocalMcpProvider)
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

const closeAddMenu = () => {
  addMenuOpen.value = false
}

const toggleAddMenu = () => {
  addMenuOpen.value = !addMenuOpen.value
}

const onDocumentPointerDown = (event: PointerEvent) => {
  if (!addMenuOpen.value) {
    return
  }

  const eventTarget = event.target
  if (!(eventTarget instanceof Node)) {
    return
  }

  if (addMenuAnchorRef.value?.contains(eventTarget)) {
    return
  }

  closeAddMenu()
}

const loadProjectMcps = async () => {
  const projectId = activeProjectId.value
  const token = ++requestToken.value

  if (!projectId) {
    mcps.value = []
    return
  }

  loading.value = true

  try {
    const records = await fetchAllPages(
      (page, limit) => mcpsApi.list({
        page,
        limit,
        keyword: keyword.value.trim() || undefined,
        projectId,
      }),
      {
        limit: PAGE_LIMIT,
        maxPages: MAX_PAGE_COUNT,
      },
    )

    if (token !== requestToken.value) {
      return
    }

    mcps.value = Array.from(new Map(records.map((item) => [item.id, item])).values())
  } catch (error) {
    if (token !== requestToken.value) {
      return
    }

    message.error(toErrorMessage(error, '加载项目 MCP 配置失败'))
  } finally {
    if (token === requestToken.value) {
      loading.value = false
    }
  }
}

const openImportMcpJsonModal = (provider: ProjectLocalMcpProvider) => {
  closeAddMenu()

  if (!activeProjectId.value) {
    message.error('请先选择项目')
    return
  }

  selectedImportProvider.value = provider
  mcpJsonImportError.value = ''
  mcpJsonImportModalOpen.value = true
}

const submitImportMcpJson = async (payload: Record<string, unknown>) => {
  const projectId = activeProjectId.value
  const provider = selectedImportProvider.value
  if (!projectId || !provider) {
    return
  }

  importingProjectMcps.value = true
  mcpJsonImportError.value = ''

  try {
    const result = await mcpsApi.importProjectLocalMcps({
      projectId,
      provider,
      payload,
    })

    mcpJsonImportModalOpen.value = false
    await loadProjectMcps()

    const summary =
      result.overwrittenCount > 0
        ? `导入 ${result.importedCount} 个，覆盖 ${result.overwrittenCount} 个`
        : `导入 ${result.importedCount} 个`
    message.success(`MCP 添加成功（${summary}）`)
  } catch (error) {
    mcpJsonImportError.value = toErrorMessage(error, '添加 MCP 失败')
    message.error(mcpJsonImportError.value)
  } finally {
    importingProjectMcps.value = false
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const resolveMcpConfigFromDraft = (
  parsedPayload: unknown,
  mcpName: string,
): Record<string, unknown> => {
  if (!isRecord(parsedPayload)) {
    throw new Error('JSON 顶层必须是对象')
  }

  const mcpServers = parsedPayload.mcpServers
  if (isRecord(mcpServers) && isRecord(mcpServers[mcpName])) {
    return mcpServers[mcpName]
  }

  const mcpMap = parsedPayload.mcp
  if (isRecord(mcpMap) && isRecord(mcpMap[mcpName])) {
    return mcpMap[mcpName]
  }

  const mcpsMap = parsedPayload.mcps
  if (isRecord(mcpsMap) && isRecord(mcpsMap[mcpName])) {
    return mcpsMap[mcpName]
  }

  const mcpServersSnake = parsedPayload.mcp_servers
  if (isRecord(mcpServersSnake) && isRecord(mcpServersSnake[mcpName])) {
    return mcpServersSnake[mcpName]
  }

  const keys = Object.keys(parsedPayload)
  if (keys.length === 1) {
    const onlyKey = keys[0]
    if (onlyKey && isRecord(parsedPayload[onlyKey])) {
      return parsedPayload[onlyKey]
    }
  }

  if (isRecord(parsedPayload[mcpName])) {
    return parsedPayload[mcpName]
  }

  throw new Error('未找到可保存的 MCP 配置对象')
}

const resetMcpJsonPreviewState = () => {
  mcpJsonPreviewModalOpen.value = false
  loadingMcpJsonPreview.value = false
  mcpJsonPreviewName.value = ''
  mcpJsonPreviewSourcePath.value = ''
  mcpJsonPreviewProvider.value = ''
  mcpJsonPreviewError.value = ''
  mcpJsonPreviewDraft.value = ''
  savingMcpJsonPreview.value = false
}

const closeMcpJsonPreview = () => {
  if (savingMcpJsonPreview.value) {
    return
  }

  resetMcpJsonPreviewState()
}

const openMcpJsonPreview = async (item: Mcp) => {
  const projectId = activeProjectId.value
  if (!projectId) {
    return
  }

  const sourcePath = resolveSourcePath(item)
  if (!sourcePath) {
    message.error('未找到 MCP 源配置路径')
    return
  }

  const sourceProvider = resolveSourceProvider(item)
  if (!isEditableProvider(sourceProvider)) {
    message.error('当前来源暂不支持在线编辑')
    return
  }

  mcpJsonPreviewModalOpen.value = true
  loadingMcpJsonPreview.value = true
  mcpJsonPreviewName.value = item.name
  mcpJsonPreviewSourcePath.value = sourcePath
  mcpJsonPreviewProvider.value = sourceProvider
  mcpJsonPreviewError.value = ''
  mcpJsonPreviewDraft.value = ''

  try {
    const response = await mcpsApi.getProjectLocalConfig({
      projectId,
      name: item.name,
      sourcePath,
    })

    const wrapperKey = mcpJsonPreviewProvider.value === 'opencode'
      ? 'mcp'
      : mcpJsonPreviewProvider.value === 'codex'
        ? 'mcp_servers'
        : 'mcpServers'
    mcpJsonPreviewDraft.value = JSON.stringify(
      {
        [wrapperKey]: {
          [response.name]: response.config,
        },
      },
      null,
      2,
    )
  } catch (error) {
    mcpJsonPreviewError.value = toErrorMessage(error, '读取 MCP 配置失败')
  } finally {
    loadingMcpJsonPreview.value = false
  }
}

const saveMcpJsonPreview = async () => {
  const projectId = activeProjectId.value
  const provider = mcpJsonPreviewProvider.value
  if (!projectId || !provider || !mcpJsonPreviewName.value) {
    return
  }

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(mcpJsonPreviewDraft.value)
  } catch {
    mcpJsonPreviewError.value = 'JSON 格式不合法'
    return
  }

  let nextConfig: Record<string, unknown>
  try {
    nextConfig = resolveMcpConfigFromDraft(parsedPayload, mcpJsonPreviewName.value)
  } catch (error) {
    mcpJsonPreviewError.value =
      error instanceof Error ? error.message : '无法解析 MCP 配置'
    return
  }

  savingMcpJsonPreview.value = true
  mcpJsonPreviewError.value = ''

  try {
    const wrapperKey = provider === 'opencode'
      ? 'mcp'
      : provider === 'codex'
        ? 'mcp_servers'
        : 'mcpServers'
    await mcpsApi.importProjectLocalMcps({
      projectId,
      provider,
      payload: {
        [wrapperKey]: {
          [mcpJsonPreviewName.value]: nextConfig,
        },
      },
    })

    await loadProjectMcps()
    message.success(`MCP「${mcpJsonPreviewName.value}」保存成功`)
    resetMcpJsonPreviewState()
  } catch (error) {
    mcpJsonPreviewError.value = toErrorMessage(error, '保存 MCP 配置失败')
  } finally {
    savingMcpJsonPreview.value = false
  }
}

watch(
  () => activeProjectId.value,
  async () => {
    closeAddMenu()
    mcpJsonImportModalOpen.value = false
    resetMcpJsonPreviewState()
    await loadProjectMcps()
  },
  { immediate: true },
)

watch(
  () => addMenuOpen.value,
  (open) => {
    if (typeof document === 'undefined') {
      return
    }

    if (open) {
      document.addEventListener('pointerdown', onDocumentPointerDown)
      return
    }

    document.removeEventListener('pointerdown', onDocumentPointerDown)
  },
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="panel-card p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <input
            v-model="keyword"
            class="h-10 min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            placeholder="搜索名称 / 版本 / 说明"
            type="search"
            @keydown.enter.prevent="void loadProjectMcps()"
          />
        </div>

        <div class="flex items-center gap-2">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md"
            type="button"
            @click="void loadProjectMcps()"
          >
            刷新
          </button>
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
            type="button"
            @click="void loadProjectMcps()"
          >
            搜索
          </button>
          <div ref="addMenuAnchorRef" class="relative">
            <button
              type="button"
              class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:shadow-md"
              :disabled="!activeProjectId"
              @click="toggleAddMenu"
            >
              添加 MCP
            </button>

            <div
              v-if="addMenuOpen"
              class="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-background p-1 shadow-lg"
            >
              <button
                type="button"
                class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="openImportMcpJsonModal('cursor')"
              >
                添加到 Cursor
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="openImportMcpJsonModal('gemini')"
              >
                添加到 Gemini
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="openImportMcpJsonModal('opencode')"
              >
                添加到 OpenCode
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="openImportMcpJsonModal('claude-code')"
              >
                添加到 Claude Code
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
                @click="openImportMcpJsonModal('codex')"
              >
                添加到 Codex
              </button>
            </div>
          </div>
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

    <section v-else class="space-y-4">
      <article
        v-if="!hasAnyProjectMcp"
        class="panel-card p-6 text-sm text-muted-foreground"
      >
        当前项目没有可读取的 MCP 本地配置。
      </article>

      <article
        v-for="group in groupedProjectMcps"
        :key="group.id"
        class="panel-card p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold">{{ group.label }}</p>
          <div class="flex items-center gap-2">
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="group.configured ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
            >
              {{ group.configured ? '已配置' : '未配置' }}
            </span>
            <span class="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              {{ group.serverCount }} 项
            </span>
          </div>
        </div>

        <div v-if="group.serverCount > 0" class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="item in group.servers"
            :key="item.id"
            role="button"
            class="cursor-pointer rounded-xl border border-border bg-background/70 px-4 py-3 transition-colors hover:border-foreground/20"
            tabindex="0"
            @click="void openMcpJsonPreview(item)"
            @keydown.enter.prevent="void openMcpJsonPreview(item)"
            @keydown.space.prevent="void openMcpJsonPreview(item)"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">{{ item.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">版本：{{ item.version }}</p>
              </div>
              <span
                class="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold"
                :class="item.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
              >
                {{ item.enabled ? '已启用' : '已停用' }}
              </span>
            </div>

            <p class="mt-3 line-clamp-2 text-xs text-muted-foreground">{{ item.description ?? '暂无描述' }}</p>
            <p class="mt-3 break-all font-mono text-[10px] text-muted-foreground">{{ resolveSourcePath(item) || '-' }}</p>
          </article>
        </div>

        <div
          v-else
          class="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
        >
          当前来源未发现 MCP 配置
        </div>
      </article>
    </section>

    <McpJsonImportModal
      :open="mcpJsonImportModalOpen"
      :submitting="importingProjectMcps"
      :error-message="mcpJsonImportError"
      @update:open="mcpJsonImportModalOpen = $event"
      @submit="submitImportMcpJson"
    />

    <Teleport to="body">
      <div
        v-if="mcpJsonPreviewModalOpen"
        class="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-6"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          aria-label="关闭 MCP JSON 预览弹窗"
          @click="closeMcpJsonPreview"
        />
        <section
          aria-modal="true"
          role="dialog"
          class="relative z-10 w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
        >
          <header class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="space-y-1">
              <h2 class="text-base font-semibold">MCP 配置</h2>
              <p class="text-xs text-muted-foreground">{{ mcpJsonPreviewName }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loadingMcpJsonPreview || savingMcpJsonPreview || !mcpJsonPreviewDraft || !mcpJsonPreviewProvider"
                @click="void saveMcpJsonPreview()"
              >
                {{ savingMcpJsonPreview ? '保存中...' : '保存' }}
              </button>
              <button
                type="button"
                aria-label="关闭"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition hover:bg-muted hover:text-foreground"
                @click="closeMcpJsonPreview"
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
            </div>
          </header>
          <div class="space-y-3 px-4 py-4">
            <p v-if="loadingMcpJsonPreview" class="text-sm text-muted-foreground">加载配置中...</p>
            <div v-else class="space-y-2">
              <textarea
                v-model="mcpJsonPreviewDraft"
                class="min-h-[56vh] w-full rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs text-foreground"
              />
            </div>
            <p v-if="!loadingMcpJsonPreview && mcpJsonPreviewError" class="text-sm text-destructive">
              {{ mcpJsonPreviewError }}
            </p>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
