import type { ComponentPublicInstance } from 'vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { mcpsApi } from '@/api/mcps'
import { projectsApi } from '@/api/projects'
import type {
  Mcp,
  ProjectLocalMcpProvider,
  ProjectMcpOAuthCli,
  ProjectMcpOAuthCliState,
  ProjectMcpOAuthLoginSession,
  ProjectMcpOAuthProvider,
} from '@/types/api/mcps'
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
import {
  MCP_SOURCE_PROVIDER_TO_PROBE_TOOL_IDS,
  filterAgentToolConfigsForMcpProvider,
  hasMcpProbeMappingForProvider,
  pickDefaultProbeAgentToolConfigId,
} from './mcp-probe-provider-map'

type ProviderGroup = {
  id: string
  label: string
  configured: boolean
  serverCount: number
  servers: Mcp[]
}

export type McpPageContext = ReturnType<typeof useMcpPage>

const OAUTH_LOCAL_MCP_CLI_SET = new Set<ProjectMcpOAuthCli>(['codex', 'cursor'])
const LOCAL_MCP_OAUTH_PROVIDER = 'figma'

export function useMcpPage() {
  const route = useRoute()
  const router = useRouter()
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
  const allAgentToolConfigs = ref<AgentToolConfig[]>([])
  const selectedProbeAgentToolConfigIdByProvider = ref<Record<string, string>>({})
  const testingProjectMcpId = ref('')
  const copyMcpModalOpen = ref(false)
  const copyMcpKeyword = ref('')
  const businessLineMcps = ref<Mcp[]>([])
  const loadingBusinessLineMcps = ref(false)
  const copyingBusinessLineMcpId = ref('')
  const copyMcpErrorMessage = ref('')
  const copyMcpTargetProviders = ref<ProjectLocalMcpProvider[]>(['cursor'])
  const projectContextRequestToken = ref(0)
  const oauthProviders = ref<ProjectMcpOAuthProvider[]>([])
  const loadingOAuthProviders = ref(false)
  const authorizingOAuthProviderCli = ref('')
  const activeOAuthSession = ref<ProjectMcpOAuthLoginSession | null>(null)
  const oauthCallbackUrl = ref('')
  const relayingOAuthCallback = ref(false)

  const OAUTH_CLI_LABEL_MAP: Record<ProjectMcpOAuthCli, string> = {
    codex: 'Codex',
    cursor: 'Cursor',
  }

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
    const fromMetadata = resolveMetadataField(
      server.metadataJson ?? null,
      'sourceProvider',
    ).toLowerCase()
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

    if (!projectId.trim()) {
      projectBusinessLineId.value = ''
      projectName.value = ''
      return
    }

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

  const syncProbeSelectionsAfterConfigsLoad = () => {
    const configs = allAgentToolConfigs.value
    const prev = selectedProbeAgentToolConfigIdByProvider.value
    const next: Record<string, string> = {}

    for (const providerId of Object.keys(MCP_SOURCE_PROVIDER_TO_PROBE_TOOL_IDS)) {
      const filtered = filterAgentToolConfigsForMcpProvider(providerId, configs)
      const prevId = prev[providerId]
      if (prevId && filtered.some((c) => c.id === prevId)) {
        next[providerId] = prevId
      } else {
        next[providerId] = pickDefaultProbeAgentToolConfigId(filtered)
      }
    }

    selectedProbeAgentToolConfigIdByProvider.value = next
  }

  const loadMcpProbeAgentToolConfigs = async () => {
    const businessLineId = projectBusinessLineId.value.trim()
    if (!businessLineId) {
      allAgentToolConfigs.value = []
      selectedProbeAgentToolConfigIdByProvider.value = {}
      return
    }

    try {
      const configs = await businessLinesApi.listAgentToolConfigs(businessLineId)
      allAgentToolConfigs.value = configs
      syncProbeSelectionsAfterConfigsLoad()
    } catch {
      allAgentToolConfigs.value = []
      selectedProbeAgentToolConfigIdByProvider.value = {}
    }
  }

  const getProbeAgentToolConfigId = (providerId: string) => {
    return selectedProbeAgentToolConfigIdByProvider.value[providerId] ?? ''
  }

  const setProbeAgentToolConfigId = (providerId: string, configId: string) => {
    selectedProbeAgentToolConfigIdByProvider.value = {
      ...selectedProbeAgentToolConfigIdByProvider.value,
      [providerId]: configId,
    }
  }

  const groupProbeTestReady = (providerId: string) => {
    if (!hasMcpProbeMappingForProvider(providerId)) {
      return false
    }
    const filtered = filterAgentToolConfigsForMcpProvider(providerId, allAgentToolConfigs.value)
    if (filtered.length === 0) {
      return false
    }
    const id = getProbeAgentToolConfigId(providerId)
    return Boolean(id && filtered.some((c) => c.id === id))
  }

  const formatMcpProbeWarnings = (warnings: string[] | undefined) => {
    if (!warnings?.length) {
      return ''
    }

    const labels: Record<string, string> = {
      AGENT_MCP_CONFIG_MAY_NOT_REFERENCE_BUSINESS_LINE_FILE:
        '当前 Agent CLI 配置的 mcp_config 可能未包含本 MCP 配置文件路径',
      AGENT_GEMINI_MCP_MAY_NOT_REFERENCE_BUSINESS_LINE_FILE_OR_NAME:
        'Gemini 的 extensions 或 allowed_mcp_server_names 可能未引用当前 MCP',
    }

    return warnings.map((w) => labels[w] ?? w).join('；')
  }

  const testProjectLocalMcp = async (item: Mcp) => {
    const projectId = activeProjectId.value
    if (!projectId || testingProjectMcpId.value) {
      return
    }

    const sourcePath = resolveSourcePath(item)
    if (!sourcePath) {
      message.error('未找到 MCP 源配置路径')
      return
    }

    const providerId = resolveSourceProvider(item)
    if (!hasMcpProbeMappingForProvider(providerId)) {
      message.error('当前 MCP 来源不支持探测或无法匹配 Agent CLI 类型')
      return
    }

    const filtered = filterAgentToolConfigsForMcpProvider(providerId, allAgentToolConfigs.value)
    const agentToolConfigId = getProbeAgentToolConfigId(providerId)
    if (!agentToolConfigId || !filtered.some((c) => c.id === agentToolConfigId)) {
      message.error('请先在本分组选择用于探测的 Agent CLI 配置')
      return
    }

    testingProjectMcpId.value = item.id

    try {
      const result = await mcpsApi.testProjectLocalMcp({
        projectId,
        name: item.name,
        sourcePath,
        agentToolConfigId,
      })

      if (result.ok) {
        const warnText = formatMcpProbeWarnings(result.warnings)
        const base = `MCP「${item.name}」探测成功（tools：${result.toolsCount ?? 0}）`
        message.success(warnText ? `${base}。${warnText}` : base)
      } else {
        const detail = [result.message, result.stderrPreview].filter(Boolean).join('\n')
        message.error(detail || 'MCP 探测失败')
      }
    } catch (error) {
      message.error(toErrorMessage(error, 'MCP 探测失败'))
    } finally {
      testingProjectMcpId.value = ''
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
    return provider === 'opencode' ? 'mcp' : provider === 'codex' ? 'mcp_servers' : 'mcpServers'
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
        (page, limit) =>
          mcpsApi.list({
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

  const loadProjectOAuthProviders = async () => {
    const projectId = activeProjectId.value
    if (!projectId) {
      oauthProviders.value = []
      return
    }

    loadingOAuthProviders.value = true
    try {
      oauthProviders.value = await mcpsApi.listProjectOAuthProviders(projectId)
    } catch (error) {
      message.error(toErrorMessage(error, '加载 OAuth MCP 授权状态失败'))
    } finally {
      loadingOAuthProviders.value = false
    }
  }

  const getOAuthCliLabel = (cli: ProjectMcpOAuthCli) => {
    return OAUTH_CLI_LABEL_MAP[cli] ?? cli
  }

  const getOAuthProviderCliStatus = (
    provider: ProjectMcpOAuthProvider,
    cli: ProjectMcpOAuthCli,
  ) => {
    return provider.cliStates.find((state) => state.cli === cli)?.status ?? 'disconnected'
  }

  const resolveLocalMcpOAuthCli = (item: Mcp): ProjectMcpOAuthCli | null => {
    const sourceProvider = resolveSourceProvider(item)
    if (!OAUTH_LOCAL_MCP_CLI_SET.has(sourceProvider as ProjectMcpOAuthCli)) {
      return null
    }

    return sourceProvider as ProjectMcpOAuthCli
  }

  const isFigmaLocalMcp = (item: Mcp) => {
    const candidates = [
      item.provider ?? '',
      item.name,
      resolveMetadataField(item.metadataJson ?? null, 'provider'),
      resolveMetadataField(item.metadataJson ?? null, 'owner'),
    ]

    return candidates.some(
      (candidate) => candidate.trim().toLowerCase() === LOCAL_MCP_OAUTH_PROVIDER,
    )
  }

  const getLocalMcpOAuthProvider = (item: Mcp) => {
    const cli = resolveLocalMcpOAuthCli(item)
    if (!cli || !isFigmaLocalMcp(item)) {
      return null
    }

    return (
      oauthProviders.value.find((provider) => {
        return (
          provider.provider.trim().toLowerCase() === LOCAL_MCP_OAUTH_PROVIDER &&
          provider.cliStates.some((state) => state.cli === cli)
        )
      }) ?? null
    )
  }

  const canAuthorizeLocalMcpOAuth = (item: Mcp) => {
    return Boolean(getLocalMcpOAuthProvider(item))
  }

  const getLocalMcpOAuthStatus = (item: Mcp): ProjectMcpOAuthCliState['status'] | 'unavailable' => {
    const provider = getLocalMcpOAuthProvider(item)
    const cli = resolveLocalMcpOAuthCli(item)
    if (!provider || !cli) {
      return 'unavailable'
    }

    return getOAuthProviderCliStatus(provider, cli)
  }

  const isAuthorizingLocalMcpOAuth = (item: Mcp) => {
    const provider = getLocalMcpOAuthProvider(item)
    const cli = resolveLocalMcpOAuthCli(item)
    return Boolean(
      provider && cli && authorizingOAuthProviderCli.value === `${provider.provider}:${cli}`,
    )
  }

  const getLocalMcpOAuthButtonLabel = (item: Mcp) => {
    if (isAuthorizingLocalMcpOAuth(item)) {
      return '启动中…'
    }

    return getLocalMcpOAuthStatus(item) === 'connected' ? '已授权' : 'OAuth'
  }

  const startLocalMcpOAuthLogin = async (item: Mcp) => {
    const provider = getLocalMcpOAuthProvider(item)
    const cli = resolveLocalMcpOAuthCli(item)
    if (!provider || !cli) {
      message.error('当前 MCP 不支持 OAuth 授权')
      return
    }

    await startProjectOAuthLogin(provider, cli)
  }

  const startProjectOAuthLogin = async (
    provider: ProjectMcpOAuthProvider,
    cli: ProjectMcpOAuthCli,
  ) => {
    const projectId = activeProjectId.value
    if (!projectId) {
      message.error('请先选择项目')
      return
    }

    const key = `${provider.provider}:${cli}`
    authorizingOAuthProviderCli.value = key
    oauthCallbackUrl.value = ''
    try {
      const session = await mcpsApi.startProjectOAuthLogin({
        projectId,
        provider: provider.provider,
        cli,
      })
      activeOAuthSession.value = session.status === 'succeeded' ? null : session
      message.success(
        session.status === 'succeeded'
          ? `${provider.displayName} 已完成授权`
          : `已生成 ${provider.displayName} 授权链接`,
      )
      await loadProjectOAuthProviders()
    } catch (error) {
      message.error(toErrorMessage(error, `启动 ${provider.displayName} 授权失败`))
    } finally {
      authorizingOAuthProviderCli.value = ''
    }
  }

  const openOAuthAuthorizationUrl = () => {
    const url = activeOAuthSession.value?.authorizationUrl
    if (!url) {
      message.error('授权链接尚未生成')
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const readClipboardForOAuthCallback = async () => {
    try {
      oauthCallbackUrl.value = await navigator.clipboard.readText()
    } catch (error) {
      message.error(toErrorMessage(error, '读取剪贴板失败，请手动粘贴回调 URL'))
    }
  }

  const relayProjectOAuthCallback = async () => {
    const projectId = activeProjectId.value
    const session = activeOAuthSession.value
    if (!projectId || !session) {
      return
    }
    const callbackUrl = oauthCallbackUrl.value.trim()
    if (!callbackUrl) {
      message.error('请先粘贴或读取回调 URL')
      return
    }

    relayingOAuthCallback.value = true
    try {
      const result = await mcpsApi.relayProjectOAuthCallback({
        projectId,
        provider: session.provider,
        sessionId: session.sessionId,
        callbackUrl,
      })
      await loadProjectOAuthProviders()
      if (result.status === 'succeeded') {
        message.success('OAuth MCP 授权完成')
        activeOAuthSession.value = null
        oauthCallbackUrl.value = ''
      } else {
        message.success('回调已转发，CLI 正在完成授权')
      }
    } catch (error) {
      message.error(toErrorMessage(error, '完成 OAuth MCP 授权失败'))
    } finally {
      relayingOAuthCallback.value = false
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

      const wrapperKey = getWrapperKeyForProvider(
        mcpJsonPreviewProvider.value as ProjectLocalMcpProvider,
      )
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
      mcpJsonPreviewError.value = error instanceof Error ? error.message : '无法解析 MCP 配置'
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
    () => route.query.tab,
    (tab) => {
      if (tab == null) {
        return
      }

      const nextQuery = { ...route.query }
      delete nextQuery.tab
      void router.replace({ query: nextQuery })
    },
    { immediate: true },
  )

  watch(
    () => activeProjectId.value,
    async () => {
      closeAddMenu()
      mcpJsonImportModalOpen.value = false
      copyMcpModalOpen.value = false
      projectBusinessLineId.value = ''
      projectName.value = ''
      allAgentToolConfigs.value = []
      oauthProviders.value = []
      selectedProbeAgentToolConfigIdByProvider.value = {}
      activeOAuthSession.value = null
      oauthCallbackUrl.value = ''
      resetMcpJsonPreviewState()
      await loadProjectContext(activeProjectId.value)
      await loadMcpProbeAgentToolConfigs()
      await loadProjectMcps()
      await loadProjectOAuthProviders()
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
    activeOAuthSession,
    projectContextRequestToken,
    authorizingOAuthProviderCli,
    selectAllCopyMcpProviders,
    loadProjectOAuthProviders,
    loadingOAuthProviders,
    submitCopyBusinessLineMcp,
    openOAuthAuthorizationUrl,
    readClipboardForOAuthCallback,
    startProjectOAuthLogin,
    startLocalMcpOAuthLogin,
    getLocalMcpOAuthButtonLabel,
    getLocalMcpOAuthStatus,
    canAuthorizeLocalMcpOAuth,
    isAuthorizingLocalMcpOAuth,
    resolveMcpConfigFromDraft,
    getOAuthProviderCliStatus,
    relayProjectOAuthCallback,
    getOAuthCliLabel,
    oauthCallbackUrl,
    oauthProviders,
    relayingOAuthCallback,
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
    allAgentToolConfigs,
    selectedProbeAgentToolConfigIdByProvider,
    filterAgentToolConfigsForMcpProvider,
    hasMcpProbeMappingForProvider,
    getProbeAgentToolConfigId,
    setProbeAgentToolConfigId,
    groupProbeTestReady,
    testingProjectMcpId,
    testProjectLocalMcp,
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
