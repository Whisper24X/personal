import { computed, ref } from 'vue'
import { workflowApi } from '@/api/workflow'
import type {
  WorkflowTemplate,
  WorkflowTemplateNode,
  WorkflowTemplateNodeInput,
  WorkflowNodeType,
} from '@/types/api/workflow'
import { fetchAllPages } from '@shared/utils/pagination'
import { toErrorMessage } from '@api/shared/to-error-message'
import {
  createEmptyWorkflowNodeInput,
  formatWorkflowNodeTabLabel,
  type WorkflowCreateFormState,
  type WorkflowTemplateNodeForm,
  type WorkflowTemplateNodeInputForm,
} from '@features/workflow'

export type PlatformWorkflowFormState = WorkflowCreateFormState

const normalizeWorkflowNodeInput = (
  input?: WorkflowTemplateNodeInput,
): WorkflowTemplateNodeInputForm => {
  const rawInput = (input ?? {}) as Record<string, unknown>
  const prompt = typeof rawInput.prompt === 'string' ? rawInput.prompt : ''
  const earlyExitMarkerEnabled = Boolean(rawInput.earlyExitMarkerEnabled)
  const earlyExitMarkerFileName =
    typeof rawInput.earlyExitMarkerFileName === 'string'
      ? rawInput.earlyExitMarkerFileName.trim()
      : ''
  const loopEnabled =
    typeof rawInput.loopEnabled === 'boolean'
      ? rawInput.loopEnabled
      : Boolean(
          earlyExitMarkerEnabled ||
            (typeof rawInput.maxLoops === 'number' && rawInput.maxLoops > 1),
        )

  return {
    ...createEmptyWorkflowNodeInput(),
    prompt,
    loopEnabled,
    earlyExitMarkerEnabled,
    earlyExitMarkerFileName,
  }
}

const normalizeNodes = (nodes: WorkflowTemplateNodeForm[]) => {
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

const nodeFromApi = (node: WorkflowTemplateNode, index: number): WorkflowTemplateNodeForm => {
  const input = normalizeWorkflowNodeInput(node.input)
  const maxLoops = typeof node.input?.maxLoops === 'number' ? node.input.maxLoops : 1

  return {
    nodeOrder: node.nodeOrder ?? index + 1,
    name: node.name,
    type: (node.type as WorkflowNodeType) ?? 'agent',
    requiresApproval: Boolean(node.requiresApproval),
    requiresArtifact: Boolean(node.requiresArtifact),
    maxLoops: Math.max(maxLoops, 1),
    input,
  }
}

const serializeWorkflowNodeInput = (
  input: WorkflowTemplateNodeInputForm,
): WorkflowTemplateNodeInput | undefined => {
  const normalizedPrompt = input.prompt.trim()
  const normalizedMarkerFileName = input.earlyExitMarkerFileName.trim()
  const payload: WorkflowTemplateNodeInput = {}

  if (normalizedPrompt) {
    payload.prompt = normalizedPrompt
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

const buildNodesForApi = (nodes: WorkflowTemplateNodeForm[]): WorkflowTemplateNode[] => {
  return normalizeNodes(nodes).map((node) => {
    const serializedInput = serializeWorkflowNodeInput(node.input)
    const input: WorkflowTemplateNodeInput = {
      ...serializedInput,
      ...(node.input.loopEnabled && node.maxLoops !== undefined && node.maxLoops > 1
        ? { maxLoops: node.maxLoops }
        : {}),
    }

    return {
      nodeOrder: node.nodeOrder,
      name: node.name,
      type: node.type,
      requiresApproval: node.requiresApproval,
      requiresArtifact: node.requiresArtifact,
      input: Object.keys(input).length > 0 ? input : undefined,
    }
  })
}

const buildWorkflowNode = (nodeOrder: number): WorkflowTemplateNodeForm => ({
  nodeOrder,
  name: `step-${nodeOrder}`,
  type: 'agent',
  requiresApproval: true,
  requiresArtifact: false,
  maxLoops: 1,
  input: createEmptyWorkflowNodeInput(),
})

const emptyForm = (): PlatformWorkflowFormState => ({
  name: '',
  description: '',
  nodes: [buildWorkflowNode(1)],
})

export function usePlatformGlobalWorkflowTemplates(message: {
  success: (t: string) => void
  error: (t: string) => void
}) {
  const loading = ref(false)
  const submitting = ref(false)
  const templates = ref<WorkflowTemplate[]>([])
  const modalOpen = ref(false)
  const mode = ref<'create' | 'edit'>('create')
  const editingId = ref('')
  const validationMessage = ref('')
  const workflowEditorActiveNodeIndex = ref(0)
  const form = ref<PlatformWorkflowFormState>(emptyForm())
  const deleteModalOpen = ref(false)
  const deleteTarget = ref<WorkflowTemplate | null>(null)
  const deleting = ref(false)

  const sortedTemplates = computed(() => [...templates.value])

  const syncActiveNodeIndex = () => {
    const max = form.value.nodes.length - 1
    workflowEditorActiveNodeIndex.value = Math.min(
      Math.max(workflowEditorActiveNodeIndex.value, 0),
      Math.max(max, 0),
    )
  }

  const loadTemplates = async () => {
    loading.value = true
    try {
      templates.value = await fetchAllPages((page, limit) =>
        workflowApi.list({ scope: 'global', page, limit }),
      )
    } catch (e) {
      message.error(toErrorMessage(e, '加载失败'))
    } finally {
      loading.value = false
    }
  }

  const validate = (): string => {
    if (!form.value.name.trim()) {
      return '请填写平台工作流名称'
    }
    const nodes = normalizeNodes(form.value.nodes)
    if (nodes.length === 0) {
      return '至少需要一个节点'
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (!node?.name.trim()) {
        return `节点 #${i + 1} 名称不能为空`
      }
      if (node.input.loopEnabled && !node.input.earlyExitMarkerFileName.trim()) {
        return `节点 #${i + 1} 已启用循环，请填写 Marker 文件名`
      }
    }
    return ''
  }

  const openCreate = () => {
    mode.value = 'create'
    editingId.value = ''
    form.value = emptyForm()
    workflowEditorActiveNodeIndex.value = 0
    validationMessage.value = ''
    modalOpen.value = true
  }

  const openEdit = (t: WorkflowTemplate) => {
    mode.value = 'edit'
    editingId.value = t.id
    form.value = {
      name: t.name,
      description: t.description ?? '',
      nodes: (t.nodesJson ?? []).map((n, i) => nodeFromApi(n, i)),
    }
    if (form.value.nodes.length === 0) {
      form.value.nodes = emptyForm().nodes
    }
    workflowEditorActiveNodeIndex.value = 0
    validationMessage.value = ''
    modalOpen.value = true
  }

  const closeModal = () => {
    modalOpen.value = false
  }

  const addNode = () => {
    form.value.nodes.push(buildWorkflowNode(form.value.nodes.length + 1))
    form.value.nodes = normalizeNodes(form.value.nodes)
    workflowEditorActiveNodeIndex.value = form.value.nodes.length - 1
  }

  const removeNode = (index: number) => {
    if (form.value.nodes.length <= 1) {
      return
    }
    form.value.nodes.splice(index, 1)
    form.value.nodes = normalizeNodes(form.value.nodes)
    syncActiveNodeIndex()
  }

  const submit = async () => {
    const err = validate()
    if (err) {
      validationMessage.value = err
      return
    }
    validationMessage.value = ''
    const nodes = buildNodesForApi(form.value.nodes)
    submitting.value = true
    try {
      if (mode.value === 'create') {
        await workflowApi.create({
          name: form.value.name.trim(),
          description: form.value.description.trim() || undefined,
          scope: 'global',
          nodes,
          isActive: true,
        })
        message.success('已创建平台工作流')
      } else {
        await workflowApi.update(editingId.value, {
          name: form.value.name.trim(),
          description: form.value.description.trim() || undefined,
          nodes,
        })
        message.success('已保存')
      }
      modalOpen.value = false
      await loadTemplates()
    } catch (e) {
      message.error(toErrorMessage(e, '提交失败'))
    } finally {
      submitting.value = false
    }
  }

  const confirmDelete = (t: WorkflowTemplate) => {
    deleteTarget.value = t
    deleteModalOpen.value = true
  }

  const remove = async () => {
    const t = deleteTarget.value
    if (!t) {
      return
    }
    deleting.value = true
    try {
      await workflowApi.remove(t.id)
      message.success('已删除')
      deleteModalOpen.value = false
      deleteTarget.value = null
      await loadTemplates()
    } catch (e) {
      message.error(toErrorMessage(e, '删除失败'))
    } finally {
      deleting.value = false
    }
  }

  return {
    loading,
    submitting,
    templates,
    sortedTemplates,
    modalOpen,
    mode,
    validationMessage,
    workflowEditorActiveNodeIndex,
    form,
    deleteModalOpen,
    deleteTarget,
    deleting,
    formatWorkflowNodeTabLabel,
    loadTemplates,
    openCreate,
    openEdit,
    closeModal,
    addNode,
    removeNode,
    submit,
    confirmDelete,
    remove,
  }
}
