<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from '@/hooks'
import { workflowApi } from '@/api/workflow'
import type {
  WorkflowNodeType,
  WorkflowTemplate,
  WorkflowTemplateMode,
  WorkflowTemplateNode,
  WorkflowTemplateVersion,
} from '@/types/api/workflow'
import { toErrorMessage } from '@/utils/http/to-error-message'

const loading = ref(false)
const loadingMore = ref(false)
const submitting = ref(false)
const actionTemplateId = ref<string | null>(null)
const savingEditor = ref(false)
const validationMessage = ref('')
const editorValidationMessage = ref('')
const message = useMessage()

const templates = ref<WorkflowTemplate[]>([])
const versions = ref<WorkflowTemplateVersion[]>([])
const selectedTemplateId = ref('')
const editorNodes = ref<WorkflowTemplateNode[]>([])
const draggingNodeIndex = ref<number | null>(null)
const templatePage = ref(1)
const templateHasNextPage = ref(false)

const createForm = reactive({
  name: '',
  description: '',
  mode: 'conversation' as WorkflowTemplateMode,
  nodes: [
    {
      nodeOrder: 1,
      name: 'conversation-node',
      type: 'agent' as WorkflowNodeType,
      requiresApproval: false,
    },
  ] as WorkflowTemplateNode[],
})

const modeLabel: Record<WorkflowTemplateMode, string> = {
  conversation: '会话模式',
  workflow: '工作流模式',
}

const nodeTypeOptions: Array<{ label: string; value: WorkflowNodeType }> = [
  { label: 'agent', value: 'agent' },
  { label: 'skill', value: 'skill' },
  { label: 'mcp', value: 'mcp' },
  { label: 'manual', value: 'manual' },
]

const selectedTemplate = computed(() => {
  return templates.value.find((template) => template.id === selectedTemplateId.value) ?? null
})

const sortCreateNodes = () => {
  createForm.nodes = normalizeNodes(createForm.nodes)
}

const sortEditorNodes = () => {
  editorNodes.value = normalizeNodes(editorNodes.value)
}

const normalizeNodes = (nodes: WorkflowTemplateNode[]) => {
  return [...nodes]
    .sort((left, right) => left.nodeOrder - right.nodeOrder)
    .map((node, index) => ({
      ...node,
      nodeOrder: index + 1,
      name: node.name.trim() || `step-${index + 1}`,
      requiresApproval: Boolean(node.requiresApproval),
    }))
}

const resetCreateForm = () => {
  createForm.name = ''
  createForm.description = ''
  createForm.mode = 'conversation'
  createForm.nodes = [
    {
      nodeOrder: 1,
      name: 'conversation-node',
      type: 'agent',
      requiresApproval: false,
    },
  ]
}

const syncEditorNodes = (template: WorkflowTemplate | null) => {
  if (!template) {
    editorNodes.value = []
    return
  }

  if (template.nodesJson.length === 0) {
    editorNodes.value = [
      {
        nodeOrder: 1,
        name: template.mode === 'conversation' ? 'conversation-node' : 'step-1',
        type: 'agent',
        requiresApproval: false,
      },
    ]
    return
  }

  editorNodes.value = normalizeNodes(template.nodesJson)
}

const replaceTemplateInList = (nextTemplate: WorkflowTemplate) => {
  templates.value = templates.value.map((template) => {
    if (template.id !== nextTemplate.id) {
      return template
    }

    return nextTemplate
  })
}

const loadTemplateDetail = async (templateId: string) => {
  try {
    const detail = await workflowApi.detail(templateId)
    replaceTemplateInList(detail)

    if (selectedTemplateId.value === templateId) {
      syncEditorNodes(detail)
    }
  } catch (error) {
    message.error(toErrorMessage(error, '加载模板详情失败'))
  }
}

const loadTemplates = async (reset = true) => {
  const nextPage = reset ? 1 : templatePage.value + 1

  if (reset) {
    loading.value = true
    validationMessage.value = ''
    editorValidationMessage.value = ''
  } else {
    loadingMore.value = true
  }

  try {
    const response = await workflowApi.list({ page: nextPage, limit: 50 })

    if (reset) {
      templates.value = response.data
    } else {
      const existingIds = new Set(templates.value.map((template) => template.id))
      templates.value = templates.value.concat(
        response.data.filter((template) => !existingIds.has(template.id)),
      )
    }

    templatePage.value = nextPage
    templateHasNextPage.value = response.hasNextPage

    if (reset) {
      const fallbackTemplateId = response.data[0]?.id ?? ''
      if (!selectedTemplateId.value || !response.data.some((template) => template.id === selectedTemplateId.value)) {
        selectedTemplateId.value = fallbackTemplateId
      }

      if (selectedTemplateId.value) {
        await loadVersions(selectedTemplateId.value)
      } else {
        versions.value = []
        editorNodes.value = []
      }
    }
  } catch (error) {
    message.error(toErrorMessage(error, '加载工作流模板失败'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadVersions = async (templateId: string) => {
  selectedTemplateId.value = templateId
  editorValidationMessage.value = ''

  try {
    versions.value = await workflowApi.versions(templateId)
    await loadTemplateDetail(templateId)
  } catch (error) {
    versions.value = []
    message.error(toErrorMessage(error, '加载模板版本失败'))
  }
}

const ensureCreateNodeShape = () => {
  if (createForm.mode === 'conversation') {
    createForm.nodes = [
      {
        nodeOrder: 1,
        name: createForm.nodes[0]?.name?.trim() || 'conversation-node',
        type: createForm.nodes[0]?.type ?? 'agent',
        requiresApproval: Boolean(createForm.nodes[0]?.requiresApproval),
      },
    ]
    return
  }

  if (createForm.nodes.length === 0) {
    createForm.nodes = [
      {
        nodeOrder: 1,
        name: 'step-1',
        type: 'agent',
        requiresApproval: false,
      },
    ]
  }

  sortCreateNodes()
}

const validateNodes = (nodes: WorkflowTemplateNode[], mode: WorkflowTemplateMode) => {
  if (nodes.length === 0) {
    return '至少需要一个节点'
  }

  if (mode === 'conversation' && nodes.length !== 1) {
    return 'conversation 模式只允许 1 个节点'
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const currentNode = nodes[index]
    if (!currentNode || !currentNode.name.trim()) {
      return `节点 #${index + 1} 名称不能为空`
    }
  }

  return ''
}

const addCreateNode = () => {
  createForm.nodes.push({
    nodeOrder: createForm.nodes.length + 1,
    name: `step-${createForm.nodes.length + 1}`,
    type: 'agent',
    requiresApproval: false,
  })

  sortCreateNodes()
}

const removeCreateNode = (index: number) => {
  if (createForm.nodes.length <= 1) {
    return
  }

  createForm.nodes.splice(index, 1)
  sortCreateNodes()
}

const createTemplate = async () => {
  if (!createForm.name.trim()) {
    validationMessage.value = '模板名称不能为空'
    return
  }

  ensureCreateNodeShape()

  const nodes = normalizeNodes(createForm.nodes)
  const nodeValidationMessage = validateNodes(nodes, createForm.mode)
  if (nodeValidationMessage) {
    validationMessage.value = nodeValidationMessage
    return
  }

  submitting.value = true
  validationMessage.value = ''

  try {
    await workflowApi.create({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      mode: createForm.mode,
      nodes,
      isActive: true,
    })

    resetCreateForm()
    await loadTemplates()
    message.success('创建工作流模板成功')
  } catch (error) {
    message.error(toErrorMessage(error, '创建工作流模板失败'))
  } finally {
    submitting.value = false
  }
}

const toggleTemplateActive = async (template: WorkflowTemplate) => {
  actionTemplateId.value = template.id

  try {
    await workflowApi.update(template.id, {
      isActive: !template.isActive,
    })

    await loadTemplates()
    message.success('更新模板状态成功')
  } catch (error) {
    message.error(toErrorMessage(error, '更新模板状态失败'))
  } finally {
    actionTemplateId.value = null
  }
}

const publishTemplate = async (template: WorkflowTemplate) => {
  actionTemplateId.value = template.id

  try {
    await workflowApi.publish(template.id)
    await loadTemplates()
    await loadVersions(template.id)
    message.success('发布模板成功')
  } catch (error) {
    message.error(toErrorMessage(error, '发布模板失败'))
  } finally {
    actionTemplateId.value = null
  }
}

const publishSelectedTemplate = async () => {
  if (!selectedTemplate.value) {
    return
  }

  await publishTemplate(selectedTemplate.value)
}

const removeTemplate = async (template: WorkflowTemplate) => {
  if (!window.confirm(`确认删除模板「${template.name}」吗？`)) {
    return
  }

  actionTemplateId.value = template.id

  try {
    await workflowApi.remove(template.id)
    if (selectedTemplateId.value === template.id) {
      selectedTemplateId.value = ''
      versions.value = []
      editorNodes.value = []
    }
    await loadTemplates()
    message.success('删除模板成功')
  } catch (error) {
    message.error(toErrorMessage(error, '删除模板失败'))
  } finally {
    actionTemplateId.value = null
  }
}

const addEditorNode = () => {
  if (selectedTemplate.value?.mode !== 'workflow') {
    return
  }

  editorNodes.value.push({
    nodeOrder: editorNodes.value.length + 1,
    name: `step-${editorNodes.value.length + 1}`,
    type: 'agent',
    requiresApproval: false,
  })

  sortEditorNodes()
}

const removeEditorNode = (index: number) => {
  if (editorNodes.value.length <= 1) {
    return
  }

  editorNodes.value.splice(index, 1)
  sortEditorNodes()
}

const moveEditorNode = (fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return
  }

  if (fromIndex >= editorNodes.value.length || toIndex >= editorNodes.value.length) {
    return
  }

  const [movedNode] = editorNodes.value.splice(fromIndex, 1)
  if (!movedNode) {
    return
  }

  editorNodes.value.splice(toIndex, 0, movedNode)
  sortEditorNodes()
}

const moveEditorNodeUp = (index: number) => {
  moveEditorNode(index, index - 1)
}

const moveEditorNodeDown = (index: number) => {
  moveEditorNode(index, index + 1)
}

const handleEditorNodeDragStart = (index: number) => {
  draggingNodeIndex.value = index
}

const handleEditorNodeDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleEditorNodeDrop = (dropIndex: number) => {
  if (draggingNodeIndex.value === null) {
    return
  }

  moveEditorNode(draggingNodeIndex.value, dropIndex)
  draggingNodeIndex.value = null
}

const handleEditorNodeDragEnd = () => {
  draggingNodeIndex.value = null
}

const saveEditorNodes = async () => {
  if (!selectedTemplate.value) {
    return
  }

  const normalizedNodes = normalizeNodes(editorNodes.value)
  const validationMessage = validateNodes(normalizedNodes, selectedTemplate.value.mode)

  if (validationMessage) {
    editorValidationMessage.value = validationMessage
    return
  }

  savingEditor.value = true
  editorValidationMessage.value = ''

  try {
    const updatedTemplate = await workflowApi.reorderNodes(selectedTemplate.value.id, {
      nodes: normalizedNodes,
    })

    replaceTemplateInList(updatedTemplate)
    syncEditorNodes(updatedTemplate)
    await loadVersions(updatedTemplate.id)
    message.success('保存节点成功')
  } catch (error) {
    message.error(toErrorMessage(error, '保存节点失败'))
  } finally {
    savingEditor.value = false
  }
}

onMounted(() => {
  void loadTemplates()
})
</script>

<template>
  <div class="space-y-6 fade-up">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">工作流</p>
      <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">工作流模板管理</h1>
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        支持模板创建、启停、发布和版本查看，供任务创建时引用固定快照版本。
      </p>
    </section>

    <section class="panel-card p-5">
      <p class="text-sm font-semibold">创建模板</p>
      <form class="mt-4 space-y-4" @submit.prevent="createTemplate">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">模板名称</span>
            <input
              v-model="createForm.name"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="例如：默认代码修复流"
              type="text"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold text-muted-foreground">模式</span>
            <select
              v-model="createForm.mode"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              @change="ensureCreateNodeShape"
            >
              <option value="conversation">conversation</option>
              <option value="workflow">workflow</option>
            </select>
          </label>

          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-semibold text-muted-foreground">描述</span>
            <input
              v-model="createForm.description"
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="可选"
              type="text"
            />
          </label>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-muted-foreground">节点定义</p>
            <button
              v-if="createForm.mode === 'workflow'"
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
              type="button"
              @click="addCreateNode"
            >
              添加节点
            </button>
          </div>

          <div class="space-y-3">
            <div
              v-for="(node, index) in createForm.nodes"
              :key="`node-${index}`"
              class="grid gap-3 rounded-xl border border-border bg-background/70 p-3 md:grid-cols-[80px_1fr_180px_auto_auto]"
            >
              <label class="space-y-1">
                <span class="text-[11px] text-muted-foreground">顺序</span>
                <input
                  v-model.number="node.nodeOrder"
                  class="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  min="1"
                  type="number"
                  @change="sortCreateNodes"
                />
              </label>

              <label class="space-y-1">
                <span class="text-[11px] text-muted-foreground">节点名称</span>
                <input
                  v-model="node.name"
                  class="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  type="text"
                />
              </label>

              <label class="space-y-1">
                <span class="text-[11px] text-muted-foreground">类型</span>
                <select v-model="node.type" class="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                  <option v-for="option in nodeTypeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input v-model="node.requiresApproval" class="h-4 w-4" type="checkbox" />
                需要审批
              </label>

              <button
                v-if="createForm.mode === 'workflow'"
                class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:opacity-80"
                type="button"
                @click="removeCreateNode(index)"
              >
                删除
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            class="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting"
            type="submit"
          >
            {{ submitting ? '创建中...' : '创建模板' }}
          </button>
        </div>
      </form>

      <p v-if="validationMessage" class="mt-3 text-sm text-destructive">{{ validationMessage }}</p>
    </section>

    <section class="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <div class="panel-card overflow-hidden">
        <div class="border-b border-border px-5 py-4">
          <p class="text-sm font-semibold">模板列表</p>
        </div>

        <div v-if="loading" class="p-5 text-sm text-muted-foreground">加载中...</div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead class="border-b border-border bg-background/60">
              <tr class="text-xs font-semibold text-muted-foreground">
                <th class="px-5 py-3">模板</th>
                <th class="px-5 py-3">模式</th>
                <th class="px-5 py-3">节点数</th>
                <th class="px-5 py-3">版本</th>
                <th class="px-5 py-3">状态</th>
                <th class="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="template in templates" :key="template.id" class="transition hover:bg-background/70">
                <td class="px-5 py-4">
                  <button class="text-left" type="button" @click="loadVersions(template.id)">
                    <p class="font-semibold">{{ template.name }}</p>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ template.id }}</p>
                  </button>
                </td>
                <td class="px-5 py-4 text-muted-foreground">{{ modeLabel[template.mode] }}</td>
                <td class="px-5 py-4 text-muted-foreground">{{ template.nodesJson.length }}</td>
                <td class="px-5 py-4 text-muted-foreground">v{{ template.latestVersion }}</td>
                <td class="px-5 py-4">
                  <span
                    class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                    :class="template.isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'"
                  >
                    {{ template.isActive ? '启用中' : '已停用' }}
                  </span>
                </td>
                <td class="px-5 py-4">
                  <div class="flex justify-end gap-2">
                    <button
                      class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="actionTemplateId === template.id"
                      type="button"
                      @click="publishTemplate(template)"
                    >
                      发布
                    </button>
                    <button
                      class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="actionTemplateId === template.id"
                      type="button"
                      @click="toggleTemplateActive(template)"
                    >
                      {{ template.isActive ? '停用' : '启用' }}
                    </button>
                    <button
                      class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="actionTemplateId === template.id"
                      type="button"
                      @click="removeTemplate(template)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="templates.length === 0">
                <td class="px-5 py-6 text-sm text-muted-foreground" colspan="6">暂无工作流模板，请先创建。</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!loading && templateHasNextPage" class="border-t border-border px-5 py-4">
          <button
            class="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loadingMore"
            type="button"
            @click="loadTemplates(false)"
          >
            {{ loadingMore ? '加载中...' : '加载更多模板' }}
          </button>
        </div>
      </div>

      <div class="space-y-6">
        <div class="panel-card p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold">可视化节点编辑</p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ selectedTemplate ? `当前模板：${selectedTemplate.name}` : '请选择左侧模板后编辑节点' }}
              </p>
            </div>

            <div class="flex gap-2" v-if="selectedTemplate">
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savingEditor"
                type="button"
                @click="saveEditorNodes"
              >
                {{ savingEditor ? '保存中...' : '保存节点' }}
              </button>
              <button
                class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="actionTemplateId === selectedTemplate.id"
                type="button"
                @click="publishSelectedTemplate"
              >
                发布新版本
              </button>
            </div>
          </div>

          <p v-if="editorValidationMessage" class="mt-3 text-sm text-destructive">{{ editorValidationMessage }}</p>

          <template v-if="selectedTemplate">
            <div class="mt-4 space-y-2">
              <article
                v-for="(node, index) in editorNodes"
                :key="`editor-node-${index}-${node.name}`"
                class="rounded-xl border border-border bg-background/70 p-3 transition"
                :class="draggingNodeIndex === index ? 'ring-2 ring-primary/30 opacity-70' : ''"
                :draggable="selectedTemplate.mode === 'workflow'"
                @dragstart="handleEditorNodeDragStart(index)"
                @dragover="handleEditorNodeDragOver"
                @drop="handleEditorNodeDrop(index)"
                @dragend="handleEditorNodeDragEnd"
              >
                <div class="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <p>
                    <span class="font-semibold">#{{ index + 1 }}</span>
                    <span v-if="selectedTemplate.mode === 'workflow'" class="ml-2">拖拽可调整顺序</span>
                  </p>
                  <div class="flex gap-1" v-if="selectedTemplate.mode === 'workflow'">
                    <button
                      class="rounded border border-border px-2 py-0.5"
                      type="button"
                      :disabled="index === 0"
                      @click="moveEditorNodeUp(index)"
                    >
                      ↑
                    </button>
                    <button
                      class="rounded border border-border px-2 py-0.5"
                      type="button"
                      :disabled="index === editorNodes.length - 1"
                      @click="moveEditorNodeDown(index)"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div class="grid gap-2 md:grid-cols-[1fr_160px_auto_auto]">
                  <input
                    v-model="node.name"
                    class="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    placeholder="节点名称"
                    type="text"
                  />
                  <select v-model="node.type" class="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                    <option v-for="option in nodeTypeOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input v-model="node.requiresApproval" class="h-4 w-4" type="checkbox" />
                    需要审批
                  </label>
                  <button
                    v-if="selectedTemplate.mode === 'workflow'"
                    class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    :disabled="editorNodes.length <= 1"
                    @click="removeEditorNode(index)"
                  >
                    删除
                  </button>
                </div>
              </article>
            </div>

            <div class="mt-3" v-if="selectedTemplate.mode === 'workflow'">
              <button
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:shadow-md"
                type="button"
                @click="addEditorNode"
              >
                添加节点
              </button>
            </div>
          </template>
        </div>

        <div class="panel-card p-5">
          <p class="text-sm font-semibold">版本历史</p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ selectedTemplate ? `当前模板：${selectedTemplate.name}` : '选择左侧模板查看版本记录' }}
          </p>

          <ul class="mt-4 space-y-2">
            <li
              v-for="version in versions"
              :key="version.id"
              class="rounded-xl border border-border bg-background/70 px-3 py-2"
            >
              <p class="text-sm font-semibold">v{{ version.version }} · {{ version.name }}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ modeLabel[version.mode] }} · 节点 {{ version.nodesJson.length }}
              </p>
            </li>

            <li v-if="versions.length === 0" class="rounded-xl border border-border bg-background/70 px-3 py-3 text-sm text-muted-foreground">
              暂无版本记录。
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>
