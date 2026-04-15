import type { ComponentPublicInstance } from 'vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { businessLinesApi } from '@/api/business-lines'
import { mcpsApi } from '@/api/mcps'
import { projectsApi } from '@/api/projects'
import type { Mcp, ProjectLocalMcpProvider } from '@/types/api/mcps'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'
import {
  MCP_EDITABLE_PROVIDER_SET as EDITABLE_PROVIDER_SET,
  MCP_MAX_PAGE_COUNT as MAX_PAGE_COUNT,
  MCP_PAGE_LIMIT as PAGE_LIMIT,
  MCP_PROJECT_PROVIDER_ORDER as PROJECT_PROVIDER_ORDER,
  MCP_PROVIDER_LABEL_MAP as PROVIDER_LABEL_MAP,
} from './mcp-page.constants'

type ProviderGroup = {
  id: string
  label: string
  configured: boolean
  serverCount: number
  servers: Mcp[]
}

export type McpPageContext = ReturnType<typeof useMcpPage>

export function useMcpPage() {
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
const mcpJsonPreviewItem = ref<Mcp | null>(null)
const mcpJsonPreviewName = ref('')
const mcpJsonPreviewSourcePath = ref('')
const mcpJsonPreviewProvider = ref<ProjectLocalMcpProvider | ''>('')
const mcpJsonPreviewError = ref('')
const mcpJsonPreviewDraft = ref('')
const savingMcpJsonPreview = ref(false)
const removingProjectMcpId = ref('')

const projectBusinessLineId = ref('')
const projectName = ref('')
const copyMcpModalOpen = ref(false)
const copyMcpKeyword = ref('')
const businessLineMcps = ref<Mcp[]>([])
const loadingBusinessLineMcps = ref(false)
const copyingBusinessLineMcpId = ref('')
const copyMcpErrorMessage = ref('')
const copyMcpTargetProviders = ref<ProjectLocalMcpProvider[]>(['cursor'])
const projectContextRequestToken = ref(0)

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
  return (
    resolveMetadataField(server.metadataJson ?? null, 'sourcePathAbsolute') ||
    resolveMetadataField(server.metadataJson ?? null, 'sourcePath') ||
    ''
  )
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

const setAddMenuAnchorEl = (el: Element | ComponentPublicInstance | null) => {
  if (el == null) {
    addMenuAnchorRef.value = null
    return
  }
  const node = el instanceof HTMLElement ? el : (el as ComponentPublicInstance).$el
  addMenuAnchorRef.value = node instanceof HTMLElement ? node : null
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

const loadProjectContext = async (projectId: string) => {
  const token = ++projectContextRequestToken.value

  try {
    const project = await projectsApi.detail(projectId)
    if (token !== projectContextRequestToken.value) {
      return
    }

    projectBusinessLineId.value = project.businessLineId
    projectName.value = project.name
  } catch (error) {
    if (token !== projectContextRequestToken.value) {
      return
    }

    projectBusinessLineId.value = ''
    projectName.value = ''
    message.error(toErrorMessage(error, '加载项目信息失败'))
  }
}

const filteredBusinessLineMcps = computed(() => {
  const query = copyMcpKeyword.value.trim().toLowerCase()
  if (!query) {
    return businessLineMcps.value
  }

  return businessLineMcps.value.filter((item) => {
  return (
    item.name.toLowerCase().includes(query) ||
    (item.version ?? '').toLowerCase().includes(query)
  )
  })
})

const loadBusinessLineMcps = async () => {
  const businessLineId = projectBusinessLineId.value
  if (!businessLineId) {
    businessLineMcps.value = []
    return
  }

  loadingBusinessLineMcps.value = true
  copyMcpErrorMessage.value = ''

  try {
    businessLineMcps.value = await businessLinesApi.listLocalMcps(businessLineId)
  } catch (error) {
    businessLineMcps.value = []
    copyMcpErrorMessage.value = toErrorMessage(error, '加载业务线 MCP 失败')
  } finally {
    loadingBusinessLineMcps.value = false
  }
}

const openCopyMcpModal = async () => {
  closeAddMenu()

  if (!activeProjectId.value) {
    message.error('请先选择项目')
    return
  }

  if (!projectBusinessLineId.value) {
    await loadProjectContext(activeProjectId.value)
  }

  if (!projectBusinessLineId.value) {
    message.error('无法识别项目所属业务线')
    return
  }

  copyMcpKeyword.value = ''
  copyMcpErrorMessage.value = ''
  copyMcpTargetProviders.value = ['cursor']
  copyMcpModalOpen.value = true
  await loadBusinessLineMcps()
}

const closeCopyMcpModal = () => {
  copyingBusinessLineMcpId.value = ''
  copyMcpErrorMessage.value = ''
  copyMcpModalOpen.value = false
}

const selectAllCopyMcpProviders = () => {
  copyMcpTargetProviders.value = [...PROJECT_PROVIDER_ORDER] as ProjectLocalMcpProvider[]
}

const clearAllCopyMcpProviders = () => {
  copyMcpTargetProviders.value = ['cursor']
}

const getWrapperKeyForProvider = (provider: ProjectLocalMcpProvider) => {
  return provider === 'opencode'
    ? 'mcp'
    : provider === 'codex'
      ? 'mcp_servers'
      : 'mcpServers'
}

const submitCopyBusinessLineMcp = async (item: Mcp) => {
  const projectId = activeProjectId.value
  const businessLineId = projectBusinessLineId.value
  const providers = copyMcpTargetProviders.value
  if (!projectId || !businessLineId || copyingBusinessLineMcpId.value) {
    return
  }

  if (providers.length === 0) {
    message.error('请至少选择一个目标类型')
    return
  }

  const sourcePath = resolveSourcePath(item)
  if (!sourcePath) {
    message.error('未找到 MCP 源配置路径')
    return
  }

  copyingBusinessLineMcpId.value = item.id
  copyMcpErrorMessage.value = ''

  try {
    const response = await businessLinesApi.getLocalMcpConfig(businessLineId, {
      name: item.name,
      sourcePath,
    })

    const errors: string[] = []
    for (const provider of providers) {
      try {
        const wrapperKey = getWrapperKeyForProvider(provider)
        const payload = {
          [wrapperKey]: {
            [response.name]: response.config,
          },
        }
        await mcpsApi.importProjectLocalMcps({
          projectId,
          provider,
          payload,
        })
      } catch (err) {
        errors.push(`${resolveProviderLabel(provider)}: ${toErrorMessage(err, '导入失败')}`)
      }
    }

    if (errors.length > 0) {
      copyMcpErrorMessage.value = errors.join('；')
      message.error(copyMcpErrorMessage.value)
      if (errors.length < providers.length) {
        await loadProjectMcps()
      }
    } else {
      closeCopyMcpModal()
      await loadProjectMcps()
      message.success(
        providers.length === 1
          ? `MCP「${item.name}」已复制到当前项目`
          : `MCP「${item.name}」已复制到 ${providers.length} 个类型`,
      )
    }
  } catch (error) {
    copyMcpErrorMessage.value = toErrorMessage(error, '复制业务线 MCP 失败')
    message.error(copyMcpErrorMessage.value)
  } finally {
    copyingBusinessLineMcpId.value = ''
  }
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
  mcpJsonPreviewItem.value = null
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

const removeProjectLocalMcp = async (item: Mcp) => {
  const projectId = activeProjectId.value
  if (!projectId || removingProjectMcpId.value) {
    return
  }

  const sourcePath = resolveSourcePath(item)
  const provider = resolveSourceProvider(item)
  if (!sourcePath || !isEditableProvider(provider)) {
    message.error('无法删除此 MCP')
    return
  }

  if (!window.confirm(`确认删除 MCP「${item.name}」吗？`)) {
    return
  }

  removingProjectMcpId.value = item.id

  try {
    await mcpsApi.removeProjectLocalMcp({
      projectId,
      provider,
      name: item.name,
      sourcePath,
    })
    if (mcpJsonPreviewItem.value?.id === item.id) {
      resetMcpJsonPreviewState()
    }
    await loadProjectMcps()
    message.success(`MCP「${item.name}」已删除`)
  } catch (error) {
    message.error(toErrorMessage(error, '删除 MCP 失败'))
  } finally {
    removingProjectMcpId.value = ''
  }
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
  mcpJsonPreviewItem.value = item
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

    const wrapperKey = getWrapperKeyForProvider(mcpJsonPreviewProvider.value as ProjectLocalMcpProvider)
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

  if (Object.prototype.hasOwnProperty.call(nextConfig, 'description')) {
    delete nextConfig.description
  }

  savingMcpJsonPreview.value = true
  mcpJsonPreviewError.value = ''

  try {
    const wrapperKey = getWrapperKeyForProvider(provider)
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
    copyMcpModalOpen.value = false
    projectBusinessLineId.value = ''
    projectName.value = ''
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
  return reactive({
    PROJECT_PROVIDER_ORDER,
    PROVIDER_LABEL_MAP,
    projectContextRequestToken,
    selectAllCopyMcpProviders,
    submitCopyBusinessLineMcp,
    resolveMcpConfigFromDraft,
    mcpJsonPreviewSourcePath,
    copyingBusinessLineMcpId,
    filteredBusinessLineMcps,
    clearAllCopyMcpProviders,
    getWrapperKeyForProvider,
    resetMcpJsonPreviewState,
    mcpJsonPreviewModalOpen,
    loadingBusinessLineMcps,
    selectedImportProvider,
    mcpJsonImportModalOpen,
    mcpJsonPreviewProvider,
    copyMcpTargetProviders,
    resolveStoredProjectId,
    openImportMcpJsonModal,
    loadingMcpJsonPreview,
    projectBusinessLineId,
    resolveSourceProvider,
    onDocumentPointerDown,
    removeProjectLocalMcp,
    importingProjectMcps,
    savingMcpJsonPreview,
    removingProjectMcpId,
    resolveMetadataField,
    resolveProviderLabel,
    loadBusinessLineMcps,
    mcpJsonPreviewError,
    mcpJsonPreviewDraft,
    copyMcpErrorMessage,
    normalizeRouteParam,
    submitImportMcpJson,
    closeMcpJsonPreview,
    mcpJsonImportError,
    mcpJsonPreviewItem,
    mcpJsonPreviewName,
    isEditableProvider,
    groupedProjectMcps,
    loadProjectContext,
    openMcpJsonPreview,
    saveMcpJsonPreview,
    resolveSourcePath,
    closeCopyMcpModal,
    addMenuAnchorRef,
    setAddMenuAnchorEl,
    copyMcpModalOpen,
    businessLineMcps,
    hasAnyProjectMcp,
    openCopyMcpModal,
    activeProjectId,
    loadProjectMcps,
    copyMcpKeyword,
    toggleAddMenu,
    requestToken,
    closeAddMenu,
    addMenuOpen,
    projectName,
    isRecord,
    message,
    loading,
    keyword,
    route,
    mcps,
  })
}
