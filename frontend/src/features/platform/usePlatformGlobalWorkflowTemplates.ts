import { computed, ref } from 'vue'
import { workflowApi } from '@/api/workflow'
import type {
  WorkflowTemplate,
  WorkflowTemplateNode,
  WorkflowNodeType,
} from '@/types/api/workflow'
import { fetchAllPages } from '@shared/utils/pagination'
import { toErrorMessage } from '@api/shared/to-error-message'

export type PlatformWorkflowNodeForm = {
  nodeOrder: number
  name: string
  type: WorkflowNodeType
  requiresApproval: boolean
  requiresArtifact: boolean
  prompt: string
}

export type PlatformWorkflowFormState = {
  name: string
  description: string
  seedOnBusinessLineCreate: boolean
  businessLineSeedOrder: number
  isActive: boolean
  nodes: PlatformWorkflowNodeForm[]
}

const normalizeNodes = (nodes: PlatformWorkflowNodeForm[]) => {
  return [...nodes]
    .sort((a, b) => a.nodeOrder - b.nodeOrder)
    .map((node, index) => ({
      ...node,
      nodeOrder: index + 1,
      name: node.name.trim() || `step-${index + 1}`,
      requiresApproval: Boolean(node.requiresApproval),
      requiresArtifact: Boolean(node.requiresArtifact),
      prompt: node.prompt.trim(),
    }))
}

const nodeFromApi = (node: WorkflowTemplateNode, index: number): PlatformWorkflowNodeForm => {
  const input = node.input ?? {}
  const prompt = typeof input.prompt === 'string' ? input.prompt : ''
  return {
    nodeOrder: node.nodeOrder ?? index + 1,
    name: node.name,
    type: (node.type as WorkflowNodeType) ?? 'agent',
    requiresApproval: Boolean(node.requiresApproval),
    requiresArtifact: Boolean(node.requiresArtifact),
    prompt,
  }
}

const buildNodesForApi = (nodes: PlatformWorkflowNodeForm[]): WorkflowTemplateNode[] => {
  return normalizeNodes(nodes).map((node) => ({
    nodeOrder: node.nodeOrder,
    name: node.name,
    type: node.type,
    requiresApproval: node.requiresApproval,
    requiresArtifact: node.requiresArtifact,
    input: node.prompt ? { prompt: node.prompt } : {},
  }))
}

const emptyForm = (): PlatformWorkflowFormState => ({
  name: '',
  description: '',
  seedOnBusinessLineCreate: false,
  businessLineSeedOrder: 0,
  isActive: true,
  nodes: [
    {
      nodeOrder: 1,
      name: 'step-1',
      type: 'agent',
      requiresApproval: true,
      requiresArtifact: false,
      prompt: '',
    },
  ],
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
  const activeNodeIndex = ref(0)
  const form = ref<PlatformWorkflowFormState>(emptyForm())
  const deleteModalOpen = ref(false)
  const deleteTarget = ref<WorkflowTemplate | null>(null)
  const deleting = ref(false)

  const sortedTemplates = computed(() => [...templates.value])

  const syncActiveNodeIndex = () => {
    const max = form.value.nodes.length - 1
    activeNodeIndex.value = Math.min(Math.max(activeNodeIndex.value, 0), Math.max(max, 0))
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
      if (!nodes[i]?.name.trim()) {
        return `节点 #${i + 1} 名称不能为空`
      }
    }
    return ''
  }

  const openCreate = () => {
    mode.value = 'create'
    editingId.value = ''
    form.value = emptyForm()
    activeNodeIndex.value = 0
    validationMessage.value = ''
    modalOpen.value = true
  }

  const openEdit = (t: WorkflowTemplate) => {
    mode.value = 'edit'
    editingId.value = t.id
    form.value = {
      name: t.name,
      description: t.description ?? '',
      seedOnBusinessLineCreate: Boolean(t.seedOnBusinessLineCreate),
      businessLineSeedOrder: t.businessLineSeedOrder ?? 0,
      isActive: t.isActive !== false,
      nodes: (t.nodesJson ?? []).map((n, i) => nodeFromApi(n, i)),
    }
    if (form.value.nodes.length === 0) {
      form.value.nodes = emptyForm().nodes
    }
    activeNodeIndex.value = 0
    validationMessage.value = ''
    modalOpen.value = true
  }

  const closeModal = () => {
    modalOpen.value = false
  }

  const addNode = () => {
    const nextOrder = form.value.nodes.length + 1
    form.value.nodes.push({
      nodeOrder: nextOrder,
      name: `step-${nextOrder}`,
      type: 'agent',
      requiresApproval: true,
      requiresArtifact: false,
      prompt: '',
    })
    activeNodeIndex.value = form.value.nodes.length - 1
  }

  const removeNode = (index: number) => {
    if (form.value.nodes.length <= 1) {
      return
    }
    form.value.nodes.splice(index, 1)
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
          isActive: form.value.isActive,
          seedOnBusinessLineCreate: form.value.seedOnBusinessLineCreate,
          businessLineSeedOrder: form.value.businessLineSeedOrder,
        })
        message.success('已创建平台工作流')
      } else {
        await workflowApi.update(editingId.value, {
          name: form.value.name.trim(),
          description: form.value.description.trim() || undefined,
          nodes,
          isActive: form.value.isActive,
          seedOnBusinessLineCreate: form.value.seedOnBusinessLineCreate,
          businessLineSeedOrder: form.value.businessLineSeedOrder,
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
    activeNodeIndex,
    form,
    deleteModalOpen,
    deleteTarget,
    deleting,
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
