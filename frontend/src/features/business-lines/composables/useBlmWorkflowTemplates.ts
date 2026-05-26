import { computed, ref, type Ref } from 'vue'
import { WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX } from '@features/workflow'
import {
  businessLinesApi,
  type AgentToolConfig,
  type BusinessLine,
} from '@/api/business-lines'
import { workflowApi } from '@/api/workflow'
import type {
  WorkflowTemplate,
  WorkflowTemplateNode,
  WorkflowTemplateNodeInput,
} from '@/types/api/workflow'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'
import { SUPPORTED_CLI_TOOLS } from '../blm-agent-cli.constants'
import { isSupportedCliToolId } from '../blm-cli-utils'
import { normalizeOptionalText } from '../blmFormUtils'
import {
  createEmptyWorkflowNodeInput,
  type SupportedCliToolId,
  type WorkflowTemplateNodeForm,
  type WorkflowTemplateNodeInputForm,
} from '../blm-workflow-template.types'
import {
  buildConfiguredCliTools,
  groupAgentToolConfigsBySupportedTool,
  resolvePreferredAgentCliConfigId,
  resolvePreferredAgentCliToolId,
} from '@shared/utils/agent-cli-defaults'

type MessageLike = {
  success: (msg: string) => void
  error: (msg: string) => void
}

export function useBlmWorkflowTemplates(
  activeLineId: Ref<string>,
  lineDetail: Ref<BusinessLine | null>,
  message: MessageLike,
) {
  const loadingWorkflowTemplates = ref(false)
  const submittingWorkflowTemplate = ref(false)
  const platformCopyModalOpen = ref(false)
  const loadingPlatformMasters = ref(false)
  const platformMasters = ref<WorkflowTemplate[]>([])
  const copyingPlatformTemplateId = ref('')

  const workflowCreateModalOpen = ref(false)
  const workflowTemplateModalMode = ref<'create' | 'edit'>('create')
  const editingWorkflowTemplateId = ref('')
  const workflowTemplateActionId = ref('')
  const workflowTemplateDeleteModalOpen = ref(false)
  const workflowTemplateDeleteTarget = ref<WorkflowTemplate | null>(null)
  const workflowValidationMessage = ref('')
  const workflowTemplates = ref<WorkflowTemplate[]>([])
  const workflowConfiguredCliTools = ref<Array<{ id: SupportedCliToolId; label: string }>>([])
  const loadingWorkflowConfiguredCliTools = ref(false)
  const workflowNodeConfigsByTool = ref<Partial<Record<SupportedCliToolId, AgentToolConfig[]>>>({})
  const workflowNodeConfigLoadingByTool = ref<Partial<Record<SupportedCliToolId, boolean>>>({})
  const workflowEditorActiveNodeIndex = ref(0)
  const workflowCreateForm = ref<{
    name: string
    description: string
    nodes: WorkflowTemplateNodeForm[]
  }>({
    name: '',
    description: '',
    nodes: [
      {
        nodeOrder: 1,
        name: 'step-1',
        type: 'agent',
        requiresApproval: true,
        requiresArtifact: false,
        input: createEmptyWorkflowNodeInput(),
      },
    ],
  })

  const workflowConfiguredCliToolIdSet = computed(() => {
    return new Set(workflowConfiguredCliTools.value.map((tool) => tool.id))
  })

  const workflowCliToolSelectOptions = computed(() => {
    if (!loadingWorkflowConfiguredCliTools.value && workflowConfiguredCliTools.value.length === 0) {
      return [
        {
          label: '当前业务线暂无已配置 Agent CLI',
          value: '',
          disabled: true,
        },
      ]
    }

    return workflowConfiguredCliTools.value.map((tool) => ({
      label: tool.label,
      value: tool.id,
    }))
  })

  const workflowTemplateModalTitle = computed(() => {
    return workflowTemplateModalMode.value === 'edit'
      ? '编辑业务线工作流模板'
      : '创建业务线工作流模板'
  })

  const workflowTemplateSubmitIdleText = computed(() => {
    return workflowTemplateModalMode.value === 'edit' ? '保存修改' : '创建模板'
  })

  const workflowTemplateSubmitLoadingText = computed(() => {
    return workflowTemplateModalMode.value === 'edit' ? '保存中...' : '创建中...'
  })

  const workflowTemplateInfoHint = '配置模板名称与描述，供业务线所有项目复用。'

  const activeWorkflowCreateNode = computed(() => {
    return workflowCreateForm.value.nodes[workflowEditorActiveNodeIndex.value] ?? null
  })

  const formatWorkflowNodeTabLabel = (node: WorkflowTemplateNodeForm, index: number) => {
    const normalizedName = node.name.trim()
    return normalizedName || `节点 ${index + 1}`
  }

  const syncWorkflowEditorActiveNodeIndex = (preferredIndex = workflowEditorActiveNodeIndex.value) => {
    const maxIndex = workflowCreateForm.value.nodes.length - 1
    workflowEditorActiveNodeIndex.value = Math.min(Math.max(preferredIndex, 0), Math.max(maxIndex, 0))
  }

  const normalizeWorkflowNodeInput = (
    input?: WorkflowTemplateNodeInput,
  ): WorkflowTemplateNodeInputForm => {
    const rawInput = (input ?? {}) as Record<string, unknown>
    const prompt = typeof rawInput.prompt === 'string' ? rawInput.prompt : ''
    const rawAgentCliId =
      typeof rawInput.agentCliId === 'string'
        ? rawInput.agentCliId.trim()
        : typeof rawInput.cliToolId === 'string'
          ? rawInput.cliToolId.trim()
          : ''
    const normalizedCliToolId = isSupportedCliToolId(rawAgentCliId) ? rawAgentCliId : ''
    const rawAgentCliConfigId =
      typeof rawInput.agentCliConfigId === 'string'
        ? rawInput.agentCliConfigId.trim()
        : typeof rawInput.agentToolConfigId === 'string'
          ? rawInput.agentToolConfigId.trim()
          : ''
    const earlyExitMarkerEnabled = Boolean(rawInput.earlyExitMarkerEnabled)
    const earlyExitMarkerFileName =
      typeof rawInput.earlyExitMarkerFileName === 'string'
        ? rawInput.earlyExitMarkerFileName.trim()
        : ''
    const loopEnabled =
      typeof rawInput.loopEnabled === 'boolean'
        ? rawInput.loopEnabled
        : Boolean(earlyExitMarkerEnabled || (typeof rawInput.maxLoops === 'number' && rawInput.maxLoops > 1))

    return {
      prompt,
      agentCliId: normalizedCliToolId,
      agentCliConfigId: normalizedCliToolId ? rawAgentCliConfigId : '',
      loopEnabled,
      earlyExitMarkerEnabled,
      earlyExitMarkerFileName,
    }
  }

  const resolveWorkflowNodeInputByContext = (
    input: WorkflowTemplateNodeInput | WorkflowTemplateNodeInputForm | undefined,
    configuredTools: Array<{ id: SupportedCliToolId; label: string }>,
    configsByTool: Partial<Record<SupportedCliToolId, AgentToolConfig[]>>,
    options?: { preserveEmptyAgentCli?: boolean },
  ): WorkflowTemplateNodeInputForm => {
    const nextInput = normalizeWorkflowNodeInput(input)
    if (options?.preserveEmptyAgentCli && !nextInput.agentCliId) {
      return {
        ...nextInput,
        agentCliId: '',
        agentCliConfigId: '',
      }
    }

    const agentCliId = resolvePreferredAgentCliToolId({
      currentToolId: nextInput.agentCliId as SupportedCliToolId | '',
      defaultToolId: lineDetail.value?.defaultAgentCliToolId,
      configuredTools,
    })

    if (!agentCliId) {
      return {
        ...nextInput,
        agentCliId: '',
        agentCliConfigId: '',
      }
    }

    const toolConfigs = configsByTool[agentCliId] ?? []

    return {
      ...nextInput,
      agentCliId,
      agentCliConfigId: resolvePreferredAgentCliConfigId(
        toolConfigs,
        nextInput.agentCliConfigId,
      ),
    }
  }

  const resolveWorkflowNodeInput = (
    input: WorkflowTemplateNodeInput | WorkflowTemplateNodeInputForm | undefined,
  ): WorkflowTemplateNodeInputForm => {
    return resolveWorkflowNodeInputByContext(
      input,
      workflowConfiguredCliTools.value,
      workflowNodeConfigsByTool.value,
    )
  }

  const buildWorkflowNode = (nodeOrder: number): WorkflowTemplateNodeForm => ({
    nodeOrder,
    name: `step-${nodeOrder}`,
    type: 'agent',
    requiresApproval: true,
    requiresArtifact: false,
    maxLoops: 1,
    input: resolveWorkflowNodeInput(createEmptyWorkflowNodeInput()),
  })

  const normalizeWorkflowNodes = (nodes: WorkflowTemplateNodeForm[]) => {
    return [...nodes]
      .sort((left, right) => left.nodeOrder - right.nodeOrder)
      .map((node, index) => ({
        ...node,
        nodeOrder: index + 1,
        name: node.name.trim() || `step-${index + 1}`,
        requiresApproval: Boolean(node.requiresApproval),
        requiresArtifact: Boolean(node.requiresArtifact),
        maxLoops: Math.max(Number(node.maxLoops) || 1, 1),
        input: normalizeWorkflowNodeInput(node.input),
      }))
  }

  const serializeWorkflowNodeInput = (
    input: WorkflowTemplateNodeInputForm,
  ): WorkflowTemplateNodeInput | undefined => {
    const normalizedPrompt = input.prompt.trim()
    const normalizedConfigId = input.agentCliConfigId.trim()
    const normalizedMarkerFileName = input.earlyExitMarkerFileName.trim()
    const payload: WorkflowTemplateNodeInput = {}

    if (normalizedPrompt) {
      payload.prompt = normalizedPrompt
    }

    if (input.agentCliId) {
      payload.agentCliId = input.agentCliId
      if (normalizedConfigId) {
        payload.agentCliConfigId = normalizedConfigId
      }
    }

    if (input.loopEnabled) {
      payload.loopEnabled = true
      payload.earlyExitMarkerEnabled = true
    }

    if (input.loopEnabled && normalizedMarkerFileName) {
      payload.earlyExitMarkerFileName = normalizedMarkerFileName
    }

    return Object.keys(payload).length > 0 ? payload : undefined
  }

  const buildWorkflowNodesForSubmit = (nodes: WorkflowTemplateNodeForm[]): WorkflowTemplateNode[] => {
    return normalizeWorkflowNodes(nodes).map((node) => ({
      ...node,
      input: {
        ...serializeWorkflowNodeInput(node.input),
        ...(node.input.loopEnabled &&
        node.maxLoops !== undefined &&
        node.maxLoops > 1
          ? { maxLoops: node.maxLoops }
          : {}),
      },
    }))
  }

  const validateWorkflowNodes = (nodes: WorkflowTemplateNode[]) => {
    if (nodes.length === 0) {
      return '至少需要一个节点'
    }

    if (workflowConfiguredCliTools.value.length === 0) {
      return '当前业务线暂无已配置 Agent CLI，请先在 Agent CLI 页面完成配置'
    }

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (!node || !node.name.trim()) {
        return `节点 #${index + 1} 名称不能为空`
      }

      const nodeInput = normalizeWorkflowNodeInput(node.input)
      if (!nodeInput.agentCliId) {
        return `节点 #${index + 1} 请选择 Agent CLI`
      }

      if (!workflowConfiguredCliToolIdSet.value.has(nodeInput.agentCliId as SupportedCliToolId)) {
        return `节点 #${index + 1} 的 Agent CLI 不可用，请重新选择`
      }

      if (nodeInput.loopEnabled && !nodeInput.earlyExitMarkerFileName.trim()) {
        return `节点 #${index + 1} 已启用循环，请填写 Marker 文件名`
      }
    }

    return ''
  }

  const ensureWorkflowCreateNodeShape = () => {
    if (workflowCreateForm.value.nodes.length === 0) {
      workflowCreateForm.value.nodes = [buildWorkflowNode(1)]
    }

    workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
    syncWorkflowEditorActiveNodeIndex()
  }

  const loadWorkflowConfiguredCliTools = async (lineId: string) => {
    if (!lineId) {
      workflowConfiguredCliTools.value = []
      workflowNodeConfigsByTool.value = {}
      return
    }

    loadingWorkflowConfiguredCliTools.value = true
    try {
      const configs = await businessLinesApi.listAgentToolConfigs(lineId)
      if (lineId !== activeLineId.value) {
        return
      }

      const groupedConfigs = groupAgentToolConfigsBySupportedTool(
        configs,
        isSupportedCliToolId,
      )

      const configuredTools = buildConfiguredCliTools(
        SUPPORTED_CLI_TOOLS,
        groupedConfigs,
      )
      workflowNodeConfigsByTool.value = groupedConfigs
      workflowConfiguredCliTools.value = configuredTools
      workflowCreateForm.value.nodes = normalizeWorkflowNodes(
        workflowCreateForm.value.nodes.map((node) => {
          return {
            ...node,
            input: resolveWorkflowNodeInputByContext(node.input, configuredTools, groupedConfigs, {
              preserveEmptyAgentCli: workflowTemplateModalMode.value === 'edit',
            }),
          }
        }),
      )
      syncWorkflowEditorActiveNodeIndex()
    } catch (error) {
      if (lineId === activeLineId.value) {
        workflowConfiguredCliTools.value = []
        workflowNodeConfigsByTool.value = {}
        message.error(toErrorMessage(error, '加载业务线工作流 Agent CLI 列表失败'))
      }
    } finally {
      if (lineId === activeLineId.value) {
        loadingWorkflowConfiguredCliTools.value = false
      }
    }
  }

  const loadWorkflowNodeConfigs = async (
    lineId: string,
    toolId: SupportedCliToolId,
  ): Promise<AgentToolConfig[]> => {
    const cachedConfigs = workflowNodeConfigsByTool.value[toolId]
    if (cachedConfigs) {
      return cachedConfigs
    }

    workflowNodeConfigLoadingByTool.value = {
      ...workflowNodeConfigLoadingByTool.value,
      [toolId]: true,
    }

    try {
      const configs = await businessLinesApi.listAgentToolConfigs(lineId, { toolId })
      if (lineId !== activeLineId.value) {
        return []
      }

      workflowNodeConfigsByTool.value = {
        ...workflowNodeConfigsByTool.value,
        [toolId]: configs,
      }
      return configs
    } catch (error) {
      if (lineId === activeLineId.value) {
        workflowNodeConfigsByTool.value = {
          ...workflowNodeConfigsByTool.value,
          [toolId]: [],
        }
        message.error(toErrorMessage(error, '加载工作流节点 Agent CLI 配置失败'))
      }
      return []
    } finally {
      if (lineId === activeLineId.value) {
        workflowNodeConfigLoadingByTool.value = {
          ...workflowNodeConfigLoadingByTool.value,
          [toolId]: false,
        }
      }
    }
  }

  const getWorkflowNodeConfigs = (toolId: SupportedCliToolId | '') => {
    if (!toolId) {
      return []
    }

    return workflowNodeConfigsByTool.value[toolId] ?? []
  }

  const getWorkflowNodeConfigSelectOptions = (toolId: string) => {
    const id = toolId as SupportedCliToolId | ''
    return [
      {
        label: !id ? '请先选择 Agent CLI' : '请选择 Agent CLI 配置',
        value: '',
      },
      ...getWorkflowNodeConfigs(id).map((config) => ({
        label: config.name,
        value: config.id,
      })),
    ]
  }

  const isWorkflowNodeConfigLoading = (toolId: string) => {
    if (!toolId) {
      return false
    }

    return Boolean(workflowNodeConfigLoadingByTool.value[toolId as SupportedCliToolId])
  }

  const handleWorkflowNodeCliToolChange = async (node: WorkflowTemplateNodeForm) => {
    if (!activeLineId.value) {
      node.input = resolveWorkflowNodeInput(node.input)
      return
    }

    if (
      !node.input.agentCliId ||
      !workflowConfiguredCliToolIdSet.value.has(node.input.agentCliId as SupportedCliToolId)
    ) {
      node.input = resolveWorkflowNodeInput(node.input)
      return
    }

    const selectedToolId = node.input.agentCliId as SupportedCliToolId
    node.input.agentCliConfigId = ''

    const configs = await loadWorkflowNodeConfigs(activeLineId.value, selectedToolId)
    if (node.input.agentCliId !== selectedToolId) {
      return
    }

    node.input.agentCliConfigId = resolvePreferredAgentCliConfigId(
      configs,
      node.input.agentCliConfigId,
    )
  }

  const preloadWorkflowNodeConfigs = async () => {
    if (!activeLineId.value) {
      return
    }

    const toolIds = Array.from(
      new Set(
        workflowCreateForm.value.nodes
          .map((node) => node.input.agentCliId)
          .filter((toolId): toolId is SupportedCliToolId => Boolean(toolId)),
      ),
    )

    await Promise.all(toolIds.map((toolId) => loadWorkflowNodeConfigs(activeLineId.value, toolId)))
  }

  const resetWorkflowCreateForm = () => {
    workflowValidationMessage.value = ''
    workflowEditorActiveNodeIndex.value = 0
    workflowCreateForm.value = {
      name: '',
      description: '',
      nodes: [buildWorkflowNode(1)],
    }
  }

  const buildWorkflowFormNodesFromTemplate = (
    template: WorkflowTemplate,
  ): WorkflowTemplateNodeForm[] => {
    const sourceNodes = template.nodesJson.length > 0 ? template.nodesJson : [buildWorkflowNode(1)]

    return normalizeWorkflowNodes(
      sourceNodes.map((node, index) => ({
        nodeOrder: node.nodeOrder || index + 1,
        name: node.name || `step-${index + 1}`,
        type: node.type || 'agent',
        requiresApproval: Boolean(node.requiresApproval),
        requiresArtifact: Boolean(node.requiresArtifact),
        maxLoops: (node.input as WorkflowTemplateNodeInput | undefined)?.maxLoops ?? 1,
        input: normalizeWorkflowNodeInput(node.input),
      })),
    )
  }

  const openWorkflowCreateModal = () => {
    if (!activeLineId.value) {
      return
    }

    workflowTemplateModalMode.value = 'create'
    editingWorkflowTemplateId.value = ''
    resetWorkflowCreateForm()
    ensureWorkflowCreateNodeShape()
    workflowNodeConfigLoadingByTool.value = {}
    workflowCreateModalOpen.value = true
    void loadWorkflowConfiguredCliTools(activeLineId.value).then(() => preloadWorkflowNodeConfigs())
  }

  const openWorkflowEditModal = (template: WorkflowTemplate) => {
    if (!activeLineId.value) {
      return
    }

    workflowTemplateModalMode.value = 'edit'
    editingWorkflowTemplateId.value = template.id
    workflowValidationMessage.value = ''
    workflowCreateForm.value = {
      name: template.name,
      description: template.description ?? '',
      nodes: buildWorkflowFormNodesFromTemplate(template),
    }
    workflowEditorActiveNodeIndex.value = 0
    workflowNodeConfigLoadingByTool.value = {}
    workflowCreateModalOpen.value = true
    void loadWorkflowConfiguredCliTools(activeLineId.value).then(() => preloadWorkflowNodeConfigs())
  }

  const closeWorkflowCreateModal = () => {
    workflowCreateModalOpen.value = false
    workflowTemplateModalMode.value = 'create'
    editingWorkflowTemplateId.value = ''
    resetWorkflowCreateForm()
  }

  const addWorkflowCreateNode = () => {
    workflowCreateForm.value.nodes.push(buildWorkflowNode(workflowCreateForm.value.nodes.length + 1))
    workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
    workflowEditorActiveNodeIndex.value = workflowCreateForm.value.nodes.length - 1
  }

  const removeWorkflowCreateNode = (index: number) => {
    if (workflowCreateForm.value.nodes.length <= 1) {
      return
    }

    workflowCreateForm.value.nodes.splice(index, 1)
    workflowCreateForm.value.nodes = normalizeWorkflowNodes(workflowCreateForm.value.nodes)
    syncWorkflowEditorActiveNodeIndex(
      workflowEditorActiveNodeIndex.value > index ? workflowEditorActiveNodeIndex.value - 1 : index,
    )
  }

  const loadPlatformMasters = async () => {
    if (!activeLineId.value) {
      platformMasters.value = []
      return
    }
    loadingPlatformMasters.value = true
    try {
      const templates = await fetchAllPages((page, limit) =>
        workflowApi.listGlobalMastersForBusinessLine({
          businessLineId: activeLineId.value,
          page,
          limit,
          isActive: true,
        }),
      )
      platformMasters.value = templates
    } catch (error) {
      platformMasters.value = []
      message.error(toErrorMessage(error, '加载平台工作流失败'))
    } finally {
      loadingPlatformMasters.value = false
    }
  }

  const openPlatformCopyModal = () => {
    if (!activeLineId.value) {
      return
    }
    platformCopyModalOpen.value = true
    void loadPlatformMasters()
  }

  const closePlatformCopyModal = () => {
    platformCopyModalOpen.value = false
    platformMasters.value = []
    copyingPlatformTemplateId.value = ''
  }

  const copyFromPlatformTemplate = async (templateId: string) => {
    if (!activeLineId.value) {
      return
    }
    copyingPlatformTemplateId.value = templateId
    try {
      await workflowApi.copyGlobalToBusinessLine(templateId, activeLineId.value)
      message.success('已复制到当前业务线')
      await loadWorkflowTemplates(activeLineId.value)
      closePlatformCopyModal()
    } catch (error) {
      message.error(toErrorMessage(error, '复制失败'))
    } finally {
      copyingPlatformTemplateId.value = ''
    }
  }

  const loadWorkflowTemplates = async (lineId: string) => {
    if (!lineId) {
      workflowTemplates.value = []
      resetWorkflowCreateForm()
      return
    }

    loadingWorkflowTemplates.value = true
    workflowValidationMessage.value = ''

    try {
      const templates = await fetchAllPages((page, limit) =>
        workflowApi.list({
          page,
          limit,
          scope: 'business_line',
          businessLineId: lineId,
        }),
      )

      workflowTemplates.value = templates
    } catch (error) {
      workflowTemplates.value = []
      message.error(toErrorMessage(error, '加载业务线工作流模板失败'))
    } finally {
      loadingWorkflowTemplates.value = false
    }
  }

  const submitWorkflowTemplate = async () => {
    if (!activeLineId.value) {
      return
    }

    if (workflowTemplateModalMode.value === 'edit' && !editingWorkflowTemplateId.value) {
      workflowValidationMessage.value = '未找到待编辑模板'
      return
    }

    if (!workflowCreateForm.value.name.trim()) {
      workflowValidationMessage.value = '模板名称不能为空'
      return
    }

    ensureWorkflowCreateNodeShape()
    const nodes = buildWorkflowNodesForSubmit(workflowCreateForm.value.nodes)
    const nodeValidationMessage = validateWorkflowNodes(nodes)

    if (nodeValidationMessage) {
      workflowValidationMessage.value = nodeValidationMessage
      return
    }

    submittingWorkflowTemplate.value = true
    workflowValidationMessage.value = ''

    const requestPayload = {
      name: workflowCreateForm.value.name.trim(),
      description: normalizeOptionalText(workflowCreateForm.value.description),
      nodes,
    }
    const isEditing = workflowTemplateModalMode.value === 'edit'

    try {
      if (isEditing) {
        await workflowApi.update(editingWorkflowTemplateId.value, requestPayload)
        message.success('业务线工作流模板更新成功')
      } else {
        await workflowApi.create({
          ...requestPayload,
          scope: 'business_line',
          businessLineId: activeLineId.value,
          isActive: true,
        })
        message.success('业务线工作流模板创建成功')
      }

      await loadWorkflowTemplates(activeLineId.value)
      closeWorkflowCreateModal()
    } catch (error) {
      message.error(
        toErrorMessage(error, isEditing ? '更新业务线工作流模板失败' : '创建业务线工作流模板失败'),
      )
    } finally {
      submittingWorkflowTemplate.value = false
    }
  }

  const removeWorkflowTemplate = async (template: WorkflowTemplate) => {
    workflowTemplateDeleteTarget.value = template
    workflowTemplateDeleteModalOpen.value = true
  }

  const setWorkflowTemplateDeleteModalOpen = (open: boolean) => {
    workflowTemplateDeleteModalOpen.value = open
    if (!open) {
      workflowTemplateDeleteTarget.value = null
    }
  }

  const confirmRemoveWorkflowTemplate = async () => {
    const template = workflowTemplateDeleteTarget.value
    if (!template) {
      return
    }

    workflowTemplateActionId.value = template.id
    try {
      await workflowApi.remove(template.id)
      await loadWorkflowTemplates(activeLineId.value)
      message.success('模板删除成功')
      setWorkflowTemplateDeleteModalOpen(false)
    } catch (error) {
      message.error(toErrorMessage(error, '删除模板失败'))
    } finally {
      workflowTemplateActionId.value = ''
    }
  }

  return {
    platformCopyModalOpen,
    loadingPlatformMasters,
    platformMasters,
    copyingPlatformTemplateId,
    openPlatformCopyModal,
    closePlatformCopyModal,
    copyFromPlatformTemplate,
    loadingWorkflowTemplates,
    submittingWorkflowTemplate,
    workflowCreateModalOpen,
    workflowTemplateModalMode,
    editingWorkflowTemplateId,
    workflowTemplateActionId,
    workflowTemplateDeleteModalOpen,
    workflowTemplateDeleteTarget,
    workflowValidationMessage,
    workflowTemplates,
    workflowConfiguredCliTools,
    loadingWorkflowConfiguredCliTools,
    workflowNodeConfigsByTool,
    workflowNodeConfigLoadingByTool,
    workflowEditorActiveNodeIndex,
    workflowCreateForm,
    workflowConfiguredCliToolIdSet,
    workflowCliToolSelectOptions,
    workflowTemplateModalTitle,
    workflowTemplateSubmitIdleText,
    workflowTemplateSubmitLoadingText,
    workflowTemplateInfoHint,
    activeWorkflowCreateNode,
    formatWorkflowNodeTabLabel,
    WORKFLOW_TEMPLATE_EDITOR_SELECT_PANEL_Z_INDEX,
    loadWorkflowConfiguredCliTools,
    getWorkflowNodeConfigSelectOptions,
    isWorkflowNodeConfigLoading,
    handleWorkflowNodeCliToolChange,
    resetWorkflowCreateForm,
    openWorkflowCreateModal,
    openWorkflowEditModal,
    closeWorkflowCreateModal,
    addWorkflowCreateNode,
    removeWorkflowCreateNode,
    loadWorkflowTemplates,
    submitWorkflowTemplate,
    removeWorkflowTemplate,
    setWorkflowTemplateDeleteModalOpen,
    confirmRemoveWorkflowTemplate,
  }
}
