import { computed, ref, type Ref } from 'vue'
import { businessLinesApi, type AgentToolConfig } from '@/api/business-lines'
import { toErrorMessage } from '@api/shared/to-error-message'
import { DEFAULT_AGENT_TOOL_CONFIG_NAME, SUPPORTED_CLI_TOOLS } from '../blm-agent-cli.constants'
import { normalizeOptionalText } from '../blmFormUtils'
import type { SupportedCliToolId } from '../blm-workflow-template.types'

type MessageLike = {
  success: (msg: string) => void
  error: (msg: string) => void
}

export function useBlmAgentCli(activeLineId: Ref<string>, message: MessageLike) {
  const loadingAgentToolConfigs = ref(false)
  const submittingAgentToolConfig = ref(false)
  const deletingAgentToolConfigId = ref('')
  const testingAgentToolConfigId = ref('')
  const agentCliValidationMessage = ref('')
  const agentToolConfigModalOpen = ref(false)
  const agentToolConfigMode = ref<'create' | 'edit'>('create')
  const editingAgentToolConfigId = ref('')
  const agentToolConfigs = ref<AgentToolConfig[]>([])
  const activeAgentCliToolId = ref<SupportedCliToolId>('cursor-agent')
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
      agentToolConfigs.value = []
      resetAgentToolConfigForm()
      return
    }

    loadingAgentToolConfigs.value = true
    try {
      const configs = await businessLinesApi.listAgentToolConfigs(lineId, { toolId })
      if (lineId !== activeLineId.value) {
        return
      }
      agentToolConfigs.value = configs
    } catch (error) {
      if (lineId === activeLineId.value) {
        agentToolConfigs.value = []
        message.error(toErrorMessage(error, '加载 Agent CLI 配置失败'))
      }
    } finally {
      if (lineId === activeLineId.value) {
        loadingAgentToolConfigs.value = false
      }
    }
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
    agentCliValidationMessage,
    agentToolConfigModalOpen,
    agentToolConfigMode,
    editingAgentToolConfigId,
    agentToolConfigs,
    activeAgentCliToolId,
    agentToolConfigForm,
    activeAgentCliToolLabel,
    resetAgentToolConfigForm,
    buildCreateAgentToolConfigForm,
    openCreateAgentToolConfig,
    openEditAgentToolConfig,
    loadAgentToolConfigs,
    saveAgentToolConfig,
    setAgentToolConfigAsDefault,
    removeAgentToolConfig,
    testAgentToolConfig,
  }
}
