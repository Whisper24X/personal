import { computed, ref, watch, type Ref } from 'vue'
import {
  businessLinesApi,
  type AgentToolConfig,
  type BusinessLine,
} from '@/api/business-lines'
import { toErrorMessage } from '@api/shared/to-error-message'
import { DEFAULT_AGENT_TOOL_CONFIG_NAME, SUPPORTED_CLI_TOOLS } from '../blm-agent-cli.constants'
import { isSupportedCliToolId } from '../blm-cli-utils'
import { normalizeOptionalText } from '../blmFormUtils'
import type { SupportedCliToolId } from '../blm-workflow-template.types'
import {
  buildConfiguredCliTools,
  groupAgentToolConfigsBySupportedTool,
} from '@shared/utils/agent-cli-defaults'

type MessageLike = {
  success: (msg: string) => void
  error: (msg: string) => void
}

export function useBlmAgentCli(
  activeLineId: Ref<string>,
  lineDetail: Ref<BusinessLine | null>,
  message: MessageLike,
) {
  const loadingAgentToolConfigs = ref(false)
  const submittingAgentToolConfig = ref(false)
  const deletingAgentToolConfigId = ref('')
  const testingAgentToolConfigId = ref('')
  const savingDefaultAgentCliTool = ref(false)
  const agentCliValidationMessage = ref('')
  const agentToolConfigModalOpen = ref(false)
  const agentToolConfigMode = ref<'create' | 'edit'>('create')
  const editingAgentToolConfigId = ref('')
  const allAgentToolConfigs = ref<AgentToolConfig[]>([])
  const agentToolConfigs = ref<AgentToolConfig[]>([])
  const activeAgentCliToolId = ref<SupportedCliToolId>('cursor-agent')
  const defaultAgentCliToolDraft = ref<SupportedCliToolId | ''>('')
  const agentToolConfigForm = ref({
    name: '',
    description: '',
    isDefault: false,
    config: {} as Record<string, unknown>,
  })

  const activeAgentCliToolLabel = computed(() => {
    return (
      SUPPORTED_CLI_TOOLS.find((tool) => tool.id === activeAgentCliToolId.value)?.label ??
      activeAgentCliToolId.value
    )
  })

  const allAgentToolConfigsByTool = computed(() => {
    return groupAgentToolConfigsBySupportedTool(allAgentToolConfigs.value, isSupportedCliToolId)
  })

  const currentDefaultAgentCliToolId = computed<SupportedCliToolId | ''>(() => {
    const toolId = lineDetail.value?.defaultAgentCliToolId?.trim() ?? ''

    return isSupportedCliToolId(toolId) ? toolId : ''
  })

  const defaultAgentCliToolOptions = computed(() => {
    return buildConfiguredCliTools(
      SUPPORTED_CLI_TOOLS,
      allAgentToolConfigsByTool.value,
    ).map((tool) => ({
      label: tool.label,
      value: tool.id,
    }))
  })

  const canSaveDefaultAgentCliTool = computed(() => {
    return defaultAgentCliToolDraft.value !== currentDefaultAgentCliToolId.value
  })

  const syncVisibleAgentToolConfigs = (
    toolId: SupportedCliToolId = activeAgentCliToolId.value,
  ) => {
    agentToolConfigs.value = allAgentToolConfigs.value.filter(
      (config) => config.toolId === toolId,
    )
  }

  const resetAgentToolConfigForm = () => {
    agentToolConfigModalOpen.value = false
    agentToolConfigMode.value = 'create'
    editingAgentToolConfigId.value = ''
    agentCliValidationMessage.value = ''
    agentToolConfigForm.value = {
      name: '',
      description: '',
      isDefault: false,
      config: {},
    }
  }

  watch(
    [activeLineId, currentDefaultAgentCliToolId],
    () => {
      defaultAgentCliToolDraft.value = currentDefaultAgentCliToolId.value
    },
    { immediate: true },
  )

  watch(activeLineId, (lineId) => {
    if (lineId) {
      return
    }

    allAgentToolConfigs.value = []
    agentToolConfigs.value = []
    defaultAgentCliToolDraft.value = ''
  })

  const buildCreateAgentToolConfigForm = () => {
    const hasNamedDefaultConfig = agentToolConfigs.value.some(
      (config) => config.name.trim().toLowerCase() === DEFAULT_AGENT_TOOL_CONFIG_NAME,
    )
    const hasDefaultConfig = agentToolConfigs.value.some((config) => config.isDefault)

    return {
      name: hasNamedDefaultConfig ? '' : DEFAULT_AGENT_TOOL_CONFIG_NAME,
      description: '',
      isDefault: !hasDefaultConfig,
      config: {} as Record<string, unknown>,
    }
  }

  const openCreateAgentToolConfig = () => {
    resetAgentToolConfigForm()
    agentToolConfigForm.value = buildCreateAgentToolConfigForm()
    agentToolConfigModalOpen.value = true
  }

  const openEditAgentToolConfig = (config: AgentToolConfig) => {
    agentToolConfigMode.value = 'edit'
    editingAgentToolConfigId.value = config.id
    agentCliValidationMessage.value = ''
    agentToolConfigForm.value = {
      name: config.name,
      description: config.description ?? '',
      isDefault: config.isDefault,
      config: { ...config.configJson },
    }
    agentToolConfigModalOpen.value = true
  }

  const loadAgentToolConfigs = async (
    lineId: string,
    toolId: SupportedCliToolId = activeAgentCliToolId.value,
  ) => {
    if (!lineId) {
      allAgentToolConfigs.value = []
      agentToolConfigs.value = []
      resetAgentToolConfigForm()
      return
    }

    loadingAgentToolConfigs.value = true
    try {
      const [configs, latestLineDetail] = await Promise.all([
        businessLinesApi.listAgentToolConfigs(lineId),
        businessLinesApi.detail(lineId).catch(() => lineDetail.value),
      ])
      if (lineId !== activeLineId.value) {
        return
      }

      lineDetail.value = latestLineDetail
      allAgentToolConfigs.value = configs
      syncVisibleAgentToolConfigs(toolId)
    } catch (error) {
      if (lineId === activeLineId.value) {
        allAgentToolConfigs.value = []
        agentToolConfigs.value = []
        message.error(toErrorMessage(error, '加载 Agent CLI 配置失败'))
      }
    } finally {
      if (lineId === activeLineId.value) {
        loadingAgentToolConfigs.value = false
      }
    }
  }

  const saveDefaultAgentCliTool = async () => {
    if (!activeLineId.value || !canSaveDefaultAgentCliTool.value) {
      return
    }

    savingDefaultAgentCliTool.value = true
    try {
      const updatedBusinessLine = await businessLinesApi.updateDefaultAgentCliTool(
        activeLineId.value,
        {
          defaultAgentCliToolId: defaultAgentCliToolDraft.value || null,
        },
      )

      lineDetail.value = updatedBusinessLine
      message.success(
        updatedBusinessLine.defaultAgentCliToolId
          ? '业务线默认 Agent CLI 已更新'
          : '业务线默认 Agent CLI 已清空',
      )
    } catch (error) {
      message.error(toErrorMessage(error, '更新业务线默认 Agent CLI 失败'))
    } finally {
      savingDefaultAgentCliTool.value = false
    }
  }

  const clearDefaultAgentCliTool = async () => {
    if (!activeLineId.value) {
      return
    }

    defaultAgentCliToolDraft.value = ''
    await saveDefaultAgentCliTool()
  }

  const saveAgentToolConfig = async (payload: {
    name: string
    description: string
    isDefault: boolean
    config: Record<string, unknown>
  }) => {
    if (!activeLineId.value) {
      return
    }

    const toolId = activeAgentCliToolId.value
    const name = payload.name.trim()

    if (!toolId) {
      agentCliValidationMessage.value = 'Tool ID 不能为空'
      return
    }

    if (!name) {
      agentCliValidationMessage.value = '配置名称不能为空'
      return
    }

    submittingAgentToolConfig.value = true
    agentCliValidationMessage.value = ''

    try {
      const requestPayload = {
        toolId,
        name,
        description: normalizeOptionalText(payload.description),
        isDefault: payload.isDefault,
        configJson: payload.config,
      }

      if (agentToolConfigMode.value === 'create') {
        await businessLinesApi.createAgentToolConfig(activeLineId.value, requestPayload)
        message.success('Agent CLI 配置创建成功')
      } else {
        if (!editingAgentToolConfigId.value) {
          return
        }

        await businessLinesApi.updateAgentToolConfig(
          activeLineId.value,
          editingAgentToolConfigId.value,
          requestPayload,
        )
        message.success('Agent CLI 配置更新成功')
      }

      await loadAgentToolConfigs(activeLineId.value)
      resetAgentToolConfigForm()
      agentToolConfigModalOpen.value = false
    } catch (error) {
      message.error(toErrorMessage(error, '保存 Agent CLI 配置失败'))
    } finally {
      submittingAgentToolConfig.value = false
    }
  }

  const setAgentToolConfigAsDefault = async (config: AgentToolConfig) => {
    if (!activeLineId.value || config.isDefault) {
      return
    }

    submittingAgentToolConfig.value = true
    agentCliValidationMessage.value = ''

    try {
      await businessLinesApi.updateAgentToolConfig(activeLineId.value, config.id, {
        isDefault: true,
      })
      await loadAgentToolConfigs(activeLineId.value, activeAgentCliToolId.value)
      message.success('默认 Agent CLI 配置已更新')
    } catch (error) {
      message.error(toErrorMessage(error, '更新默认配置失败'))
    } finally {
      submittingAgentToolConfig.value = false
    }
  }

  const formatSmokeTestError = (code?: string) => {
    switch (code) {
      case 'ENOENT':
        return '未找到可执行文件（PATH 或自定义命令无效）'
      case 'TIMEOUT':
        return '命令执行超时'
      case 'NON_ZERO':
        return '命令退出码非 0'
      case 'SPAWN_ERROR':
        return '无法启动进程'
      case 'AUTH_ERROR':
        return '输出疑似鉴权失败（如 invalid API key、401/403）'
      default:
        return '探测失败'
    }
  }

  const SMOKE_COST_HINT = '（已发起真实模型调用，可能产生费用）'

  const testAgentToolConfig = async (config: AgentToolConfig) => {
    if (!activeLineId.value) {
      return
    }

    testingAgentToolConfigId.value = config.id
    try {
      const result = await businessLinesApi.testAgentToolConfig(activeLineId.value, config.id)
      if (result.ok) {
        const hint = result.stdoutPreview?.trim() || result.stderrPreview?.trim()
        message.success(
          hint
            ? `端到端可用 ${SMOKE_COST_HINT} ${hint.slice(0, 200)}${hint.length > 200 ? '…' : ''}`
            : `端到端可用 ${SMOKE_COST_HINT} 退出码 0`,
        )
      } else {
        const reason = formatSmokeTestError(result.errorCode)
        const detail = result.stderrPreview?.trim() || result.stdoutPreview?.trim()
        message.error(
          detail
            ? `${reason} ${SMOKE_COST_HINT}：${detail.slice(0, 400)}${detail.length > 400 ? '…' : ''}`
            : `${reason} ${SMOKE_COST_HINT}`,
        )
      }
    } catch (error) {
      message.error(toErrorMessage(error, '测试 Agent CLI 配置失败'))
    } finally {
      testingAgentToolConfigId.value = ''
    }
  }

  const removeAgentToolConfig = async (configId: string) => {
    if (!activeLineId.value) {
      return
    }

    deletingAgentToolConfigId.value = configId
    try {
      await businessLinesApi.removeAgentToolConfig(activeLineId.value, configId)
      await loadAgentToolConfigs(activeLineId.value, activeAgentCliToolId.value)
      lineDetail.value = await businessLinesApi.detail(activeLineId.value).catch(
        () => lineDetail.value,
      )

      if (editingAgentToolConfigId.value === configId) {
        resetAgentToolConfigForm()
      }

      message.success('Agent CLI 配置已删除')
    } catch (error) {
      message.error(toErrorMessage(error, '删除 Agent CLI 配置失败'))
    } finally {
      deletingAgentToolConfigId.value = ''
    }
  }

  return {
    SUPPORTED_CLI_TOOLS,
    loadingAgentToolConfigs,
    submittingAgentToolConfig,
    deletingAgentToolConfigId,
    testingAgentToolConfigId,
    savingDefaultAgentCliTool,
    agentCliValidationMessage,
    agentToolConfigModalOpen,
    agentToolConfigMode,
    editingAgentToolConfigId,
    agentToolConfigs,
    activeAgentCliToolId,
    agentToolConfigForm,
    activeAgentCliToolLabel,
    canSaveDefaultAgentCliTool,
    clearDefaultAgentCliTool,
    currentDefaultAgentCliToolId,
    defaultAgentCliToolDraft,
    defaultAgentCliToolOptions,
    resetAgentToolConfigForm,
    buildCreateAgentToolConfigForm,
    openCreateAgentToolConfig,
    openEditAgentToolConfig,
    loadAgentToolConfigs,
    saveDefaultAgentCliTool,
    saveAgentToolConfig,
    setAgentToolConfigAsDefault,
    removeAgentToolConfig,
    testAgentToolConfig,
  }
}
