<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goalsApi } from '@/api/goals'
import { projectsApi } from '@/api/projects'
import { workflowApi } from '@/api/workflow'
import type { GoalDetail as GoalDetailType, GoalPlanItem } from '@/types/api/goals'
import type { WorkflowTemplate } from '@/types/api/workflow'
import { useMessage } from '@/hooks'
import { toErrorMessage } from '@/utils/http/to-error-message'
import { fetchAllPages } from '@/utils/pagination'
import { topologicalMaterializeOrder } from '@/utils/goal-plan-materialize-order'
import {
  planDependencyMermaidMarkdown,
  planItemsDependencyHasCycle,
} from '@/utils/goal-plan-dependency-graph'
import {
  taskDependencyHasCycle,
  taskDependencyMermaidMarkdown,
} from '@/utils/goal-task-dependency-graph'
import AppSelect from '@/components/core/select'
import MarkdownPreview from '@/components/knowledge-base/MarkdownPreview.vue'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const GOAL_SELECT_PANEL_Z_INDEX = 130
const GOAL_SELECT_PANEL_PLACEMENT = 'top' as const

defineOptions({
  name: 'GoalDetailView',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()

const goalId = computed(() => String(route.params.goalId ?? ''))
const loading = ref(false)
const deleting = ref(false)
const materializing = ref(false)
const detail = ref<GoalDetailType | null>(null)
const tab = ref<'prd' | 'plan' | 'tasks'>('prd')

const workflowTemplates = ref<WorkflowTemplate[]>([])
const loadingWorkflowTemplates = ref(false)
const savingPlanItemWorkflowId = ref<string | null>(null)

const planItemDetailOpen = ref(false)
const selectedPlanItem = ref<GoalPlanItem | null>(null)

const planItemEditSummary = ref('')
const planItemEditAcceptance = ref('')
const planItemEditSuggestedPrompt = ref('')
const savingPlanItemText = ref(false)

const prdEditorOpen = ref(false)
const prdEditorContent = ref('')
const prdEditorLoading = ref(false)
const prdEditorSaving = ref(false)

const planItemStatusLabel: Record<GoalPlanItem['status'], string> = {
  draft: '草稿',
  approved: '已确认',
  task_created: '已物化',
  cancelled: '已取消',
}

function openPlanItemDetail(item: GoalPlanItem) {
  selectedPlanItem.value = item
  planItemDetailOpen.value = true
}

function onPlanItemSheetOpen(open: boolean) {
  planItemDetailOpen.value = open
  if (!open) {
    selectedPlanItem.value = null
  }
}

watch(
  () => [planItemDetailOpen.value, selectedPlanItem.value?.id] as const,
  () => {
    const item = selectedPlanItem.value
    if (!planItemDetailOpen.value || !item) {
      return
    }
    planItemEditSummary.value = item.summary ?? ''
    planItemEditAcceptance.value = item.acceptanceCriteria ?? ''
    planItemEditSuggestedPrompt.value = item.suggestedPrompt ?? ''
  },
)

function resetPlanItemTextDraft() {
  const item = selectedPlanItem.value
  if (!item) {
    return
  }
  planItemEditSummary.value = item.summary ?? ''
  planItemEditAcceptance.value = item.acceptanceCriteria ?? ''
  planItemEditSuggestedPrompt.value = item.suggestedPrompt ?? ''
}

async function savePlanItemText() {
  if (!detail.value || !selectedPlanItem.value || !goalId.value) {
    return
  }
  savingPlanItemText.value = true
  try {
    const updated = await goalsApi.patchPlanItem(goalId.value, selectedPlanItem.value.id, {
      summary: planItemEditSummary.value,
      acceptanceCriteria: planItemEditAcceptance.value,
      suggestedPrompt: planItemEditSuggestedPrompt.value,
    })
    const idx = detail.value.planItems.findIndex((p) => p.id === updated.id)
    if (idx >= 0) {
      detail.value.planItems[idx] = updated
    }
    selectedPlanItem.value = updated
    message.success('已保存')
  } catch (e) {
    message.error(toErrorMessage(e, '保存计划项失败'))
  } finally {
    savingPlanItemText.value = false
  }
}

function onPrdEditorOpen(open: boolean) {
  prdEditorOpen.value = open
}

async function openPrdEditor() {
  const d = detail.value
  const path = d?.goal.prdDocPath?.trim()
  const projectId = d?.goal.projectId
  if (!d || !path || !projectId) {
    return
  }
  prdEditorOpen.value = true
  prdEditorLoading.value = true
  try {
    const res = await projectsApi.readDoc(projectId, path)
    prdEditorContent.value = res.content
  } catch (e) {
    message.error(toErrorMessage(e, '读取 PRD 失败'))
    prdEditorOpen.value = false
  } finally {
    prdEditorLoading.value = false
  }
}

async function savePrdEditor() {
  const d = detail.value
  const path = d?.goal.prdDocPath?.trim()
  const projectId = d?.goal.projectId
  if (!d || !path || !projectId) {
    return
  }
  prdEditorSaving.value = true
  try {
    await projectsApi.updateDoc(projectId, { path, content: prdEditorContent.value })
    message.success('PRD 已保存')
    prdEditorOpen.value = false
    await loadPrdPreview()
  } catch (e) {
    message.error(toErrorMessage(e, '保存 PRD 失败'))
  } finally {
    prdEditorSaving.value = false
  }
}

function workflowNameForPlanItem(item: GoalPlanItem): string {
  const id = item.workflowTemplateId?.trim()
  if (!id) {
    return ''
  }
  const t = workflowTemplates.value.find((w) => w.id === id)
  return t?.name ?? id
}

function dependencyTitlesForPlanItem(item: GoalPlanItem): string[] {
  const d = detail.value
  if (!d) {
    return []
  }
  const byId = new Map(d.planItems.map((p) => [p.id, p]))
  return item.dependsOnItemIds.map((depId) => byId.get(depId)?.title ?? depId)
}

/** 前置依赖未全部物化时不可确认；返回阻塞原因文案，否则 null */
function planItemApproveBlockedReason(item: GoalPlanItem): string | null {
  if (item.status !== 'draft') {
    return null
  }
  const d = detail.value
  if (!d) {
    return null
  }
  const byId = new Map(d.planItems.map((p) => [p.id, p]))
  for (const predId of item.dependsOnItemIds ?? []) {
    const pred = byId.get(predId)
    if (!pred) {
      continue
    }
    if (pred.status !== 'task_created' || !pred.taskId?.trim()) {
      return `请先物化前置计划项「${pred.title}」后再确认本项`
    }
  }
  return null
}

/** 前置任务未全部完成(done)时不可物化新建任务 */
function planItemMaterializeBlockedReason(item: GoalPlanItem): string | null {
  const d = detail.value
  if (!d) {
    return null
  }
  const planById = new Map(d.planItems.map((p) => [p.id, p]))
  for (const predId of item.dependsOnItemIds ?? []) {
    const pred = planById.get(predId)
    if (!pred) {
      continue
    }
    if (!pred.taskId?.trim()) {
      return `请先物化前置计划项「${pred.title}」后再物化本项`
    }
    const task = d.tasks.find((t) => t.id === pred.taskId)
    if (!task) {
      return '前置任务数据缺失，请刷新后重试'
    }
    if (task.status !== 'done') {
      return `前置任务「${task.title}」未完成，请完成后再物化本项`
    }
  }
  return null
}

const prdPreviewLoading = ref(false)
const prdPreviewError = ref('')
const prdPreviewContent = ref('')
let prdPreviewRequestToken = 0

async function loadPrdPreview() {
  const d = detail.value
  if (!d || tab.value !== 'prd') {
    return
  }
  const path = d.goal.prdDocPath?.trim()
  const projectId = d.goal.projectId
  if (!path || !projectId) {
    prdPreviewContent.value = ''
    prdPreviewError.value = ''
    prdPreviewLoading.value = false
    return
  }
  prdPreviewRequestToken += 1
  const token = prdPreviewRequestToken
  prdPreviewLoading.value = true
  prdPreviewError.value = ''
  try {
    const res = await projectsApi.readDoc(projectId, path)
    if (token !== prdPreviewRequestToken) {
      return
    }
    prdPreviewContent.value = res.content
  } catch (e) {
    if (token !== prdPreviewRequestToken) {
      return
    }
    prdPreviewContent.value = ''
    prdPreviewError.value = toErrorMessage(e, '读取 PRD 失败')
  } finally {
    if (token === prdPreviewRequestToken) {
      prdPreviewLoading.value = false
    }
  }
}

watch(
  () =>
    [tab.value, detail.value?.goal.prdDocPath, detail.value?.goal.projectId] as const,
  () => {
    if (tab.value === 'prd' && detail.value?.goal.prdDocPath?.trim()) {
      void loadPrdPreview()
    }
  },
)

const statusLabel = {
  draft: '草稿',
  prd_generated: 'PRD 已生成',
  prd_confirmed: 'PRD 已确认',
  planned: '计划已生成',
  in_progress: '执行中',
  done: '完成',
  archived: '归档',
} as const

const workflowTemplateOptionsBase = computed(() =>
  workflowTemplates.value.map((template) => ({
    label: template.name,
    value: template.id,
  })),
)

/** 依赖各计划项 id/status，确认/物化/更新后图表与 MarkdownPreview 会刷新 */
const planDepsMarkdown = computed(() => {
  const items = detail.value?.planItems ?? []
  void items.map((i) => `${i.id}:${i.status}`)
  return planDependencyMermaidMarkdown(items)
})

const planDepsGraphKey = computed(() =>
  (detail.value?.planItems ?? []).map((i) => `${i.id}:${i.status}`).join('|'),
)

const taskDepsMarkdown = computed(() => {
  const tasks = detail.value?.tasks ?? []
  const edges = detail.value?.taskDependencies ?? []
  void tasks.map((t) => `${t.id}:${t.status}`)
  void edges.map((e) => `${e.predecessorTaskId}->${e.successorTaskId}`)
  return taskDependencyMermaidMarkdown(tasks, edges)
})

const taskDepsHasCycle = computed(() =>
  taskDependencyHasCycle(detail.value?.tasks ?? [], detail.value?.taskDependencies ?? []),
)

const taskDepsGraphKey = computed(() => {
  const tasks = detail.value?.tasks ?? []
  const edges = detail.value?.taskDependencies ?? []
  return [
    tasks.map((t) => `${t.id}:${t.status}`).join('|'),
    edges.map((e) => `${e.predecessorTaskId}->${e.successorTaskId}`).join('|'),
  ].join('#')
})

const planDepsHasCycle = computed(() =>
  planItemsDependencyHasCycle(detail.value?.planItems ?? []),
)

/** 顶部操作按钮：无 PRD → 仅生成 PRD；有 PRD 无计划项 → 仅生成拆解计划；有计划项 → 仅物化 */
const goalHasPrd = computed(() => Boolean(detail.value?.goal.prdDocPath?.trim()))
const goalHasPlanItems = computed(() => (detail.value?.planItems.length ?? 0) > 0)

function workflowOptionsForPlanItem(workflowTemplateId: string | null | undefined) {
  const base = workflowTemplateOptionsBase.value
  const id = workflowTemplateId?.trim()
  if (id && !base.some((option) => option.value === id)) {
    return [
      { label: '（已选模板不在列表中，请重新选择）', value: id },
      ...base,
    ]
  }
  return base
}

const loadWorkflowTemplatesForProject = async (projectId: string) => {
  if (!projectId) {
    workflowTemplates.value = []
    return
  }
  loadingWorkflowTemplates.value = true
  try {
    workflowTemplates.value = await fetchAllPages((page, limit) =>
      workflowApi.list({
        page,
        limit,
        isActive: true,
        scope: 'project',
        projectId,
      }),
    )
  } catch (error) {
    workflowTemplates.value = []
    message.error(toErrorMessage(error, '加载项目工作流列表失败'))
  } finally {
    loadingWorkflowTemplates.value = false
  }
}

async function load() {
  if (!goalId.value) return
  loading.value = true
  try {
    detail.value = await goalsApi.get(goalId.value)
    const pid = detail.value.goal.projectId
    await loadWorkflowTemplatesForProject(pid)
  } catch (e) {
    message.error(toErrorMessage(e, '加载 Goal 失败'))
  } finally {
    loading.value = false
    if (tab.value === 'prd' && detail.value?.goal.prdDocPath?.trim()) {
      void loadPrdPreview()
    }
  }
}

onMounted(load)

function goTask(taskId: string) {
  /** 必须带 projectId，否则 permission-guard 会把 params.id（任务 id）误当项目 id，从而被重定向到工作台 /dashboard */
  const pid = detail.value?.goal.projectId?.trim()
  router.push({
    name: 'task-detail',
    params: { id: taskId },
    ...(pid ? { query: { projectId: pid } } : {}),
  })
}

function goTaskFromSheet(taskId: string) {
  onPlanItemSheetOpen(false)
  goTask(taskId)
}

function goalGenerationAgentPayload() {
  const g = detail.value?.goal
  if (!g?.agentCliId?.trim() || !g?.agentCliConfigId?.trim()) {
    return {}
  }
  return {
    agentCliId: g.agentCliId.trim(),
    agentCliConfigId: g.agentCliConfigId.trim(),
  }
}

async function runGeneratePrd() {
  const g = detail.value?.goal
  if (!g?.agentCliId?.trim() || !g?.agentCliConfigId?.trim()) {
    message.warning('缺少业务线 Agent 配置，无法生成 PRD。创建 Goal 时需选择 CLI 与工具配置，或更新 Goal 后重试。')
    return
  }
  try {
    await goalsApi.generatePrd(goalId.value, {
      overwrite: true,
      ...goalGenerationAgentPayload(),
    })
    message.success('PRD 已生成')
    await load()
  } catch (e) {
    message.error(toErrorMessage(e, '生成 PRD 失败'))
  }
}

async function runGeneratePlan() {
  const g = detail.value?.goal
  if (!g?.agentCliId?.trim() || !g?.agentCliConfigId?.trim()) {
    message.warning('缺少业务线 Agent 配置，无法生成拆解计划。创建 Goal 时需选择 CLI 与工具配置，或更新 Goal 后重试。')
    return
  }
  try {
    await goalsApi.generatePlan(goalId.value, {
      granularity: 'standard',
      overwrite: true,
      ...goalGenerationAgentPayload(),
    })
    message.success('拆解计划已生成')
    await load()
  } catch (e) {
    message.error(toErrorMessage(e, '生成拆解计划失败'))
  }
}

async function approveItem(item: GoalPlanItem) {
  const blocked = planItemApproveBlockedReason(item)
  if (blocked) {
    message.warning(blocked)
    return
  }
  try {
    await goalsApi.patchPlanItem(goalId.value, item.id, { status: 'approved' })
    message.success('已确认计划项')
    await load()
  } catch (e) {
    message.error(toErrorMessage(e, '确认计划项失败'))
  }
}

async function setPlanItemWorkflow(item: GoalPlanItem, workflowTemplateId: string) {
  if (!goalId.value || !detail.value) return
  if (!workflowTemplateId.trim()) {
    message.warning('请先为计划项配置工作流')
    return
  }
  if ((item.workflowTemplateId ?? '') === workflowTemplateId) {
    return
  }
  savingPlanItemWorkflowId.value = item.id
  try {
    const updated = await goalsApi.patchPlanItem(goalId.value, item.id, {
      workflowTemplateId,
    })
    const idx = detail.value.planItems.findIndex((p) => p.id === item.id)
    if (idx >= 0) {
      detail.value.planItems[idx] = updated
    }
  } catch (e) {
    message.error(toErrorMessage(e, '保存工作流失败'))
  } finally {
    savingPlanItemWorkflowId.value = null
  }
}

async function materializeSelected() {
  if (!detail.value) return
  const rawIds =
    detail.value.planItems
      .filter((i) => i.status === 'approved' && !i.taskId)
      .map((i) => i.id) ?? []
  if (rawIds.length === 0) {
    message.warning('没有可物化的已确认计划项')
    return
  }
  let orderedIds: string[]
  try {
    orderedIds = topologicalMaterializeOrder(rawIds, detail.value.planItems)
  } catch {
    message.error('计划项依赖成环，无法按顺序物化')
    return
  }

  for (const planItemId of orderedIds) {
    const item = detail.value.planItems.find((p) => p.id === planItemId)
    if (!item?.workflowTemplateId?.trim()) {
      message.warning(
        `请先在「拆解计划」中为「${item?.title ?? planItemId}」配置工作流后再物化`,
      )
      return
    }
    const matBlocked = planItemMaterializeBlockedReason(item)
    if (matBlocked) {
      message.warning(matBlocked)
      return
    }
  }

  materializing.value = true
  try {
    for (const planItemId of orderedIds) {
      await goalsApi.materializeTasks(goalId.value, [planItemId])
    }
    message.success(
      orderedIds.length === 1 ? '已创建任务' : `已依次创建 ${orderedIds.length} 个任务`,
    )
    await load()
  } catch (e) {
    message.error(toErrorMessage(e, '物化任务失败'))
  } finally {
    materializing.value = false
  }
}

async function removeGoal() {
  if (!detail.value) return
  if (
    !window.confirm(
      `确定删除「${detail.value.goal.title}」吗？删除后无法从此列表恢复。`,
    )
  ) {
    return
  }
  deleting.value = true
  try {
    const pid = detail.value.goal.projectId
    await goalsApi.remove(goalId.value)
    message.success('已删除')
    await router.push({ name: 'project-goals', params: { projectId: pid } })
  } catch (e) {
    message.error(toErrorMessage(e, '删除 Goal 失败'))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-4">
    <div v-if="loading" class="text-muted-foreground flex flex-1 items-center justify-center text-sm">
      加载中...
    </div>
    <template v-else-if="detail">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="mb-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="text-muted-foreground text-xs hover:underline"
              @click="router.back()"
            >
              返回
            </button>
            <span class="text-muted-foreground text-xs" aria-hidden="true">·</span>
            <button
              type="button"
              class="text-destructive text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
              :disabled="deleting"
              @click="removeGoal"
            >
              {{ deleting ? '删除中…' : '删除目标' }}
            </button>
          </div>
          <h1 class="text-lg font-semibold">{{ detail.goal.title }}</h1>
          <p class="text-muted-foreground max-w-3xl text-sm">
            {{ detail.goal.summary || '无摘要' }} · 状态：{{
              statusLabel[detail.goal.status]
            }}
          </p>
          <p
            class="text-muted-foreground mt-1 flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 text-xs"
          >
            <span>
              进度：{{ detail.progress.doneTasks }} / {{ detail.progress.totalTasks }} 已完成
            </span>
            <span aria-hidden="true">·</span>
            <span>
              关联资料 {{ detail.sourceDocs.length }} 条 · 计划项 {{ detail.planItems.length }} 条
            </span>
            <span aria-hidden="true">·</span>
            <span>任务依赖边 {{ detail.taskDependencies.length }}</span>
          </p>
        </div>
        <div class="flex max-w-xl flex-col items-end gap-2">
          <p class="max-w-md text-right text-xs text-muted-foreground">
            生成 PRD / 拆解计划使用在「新建 Goal」时保存的 Agent CLI 配置。物化前请在「拆解计划」中为每条已确认项配置工作流。
          </p>
          <div class="flex flex-wrap justify-end gap-2">
            <button
              v-if="!goalHasPrd"
              type="button"
              class="border-input bg-background h-9 rounded-md border px-3 text-sm"
              @click="runGeneratePrd"
            >
              生成 PRD
            </button>
            <button
              v-else-if="goalHasPrd && !goalHasPlanItems"
              type="button"
              class="border-input bg-background h-9 rounded-md border px-3 text-sm"
              @click="runGeneratePlan"
            >
              生成拆解计划
            </button>
            <button
              v-else
              type="button"
              class="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm disabled:opacity-50"
              :disabled="materializing"
              @click="materializeSelected"
            >
              {{ materializing ? '物化中…' : '物化已确认项' }}
            </button>
          </div>
        </div>
      </div>

      <div class="border-border flex flex-wrap gap-1 border-b text-sm">
        <button
          v-for="t in ['prd', 'plan', 'tasks'] as const"
          :key="t"
          type="button"
          class="px-3 py-2 font-medium"
          :class="tab === t ? 'border-primary text-foreground border-b-2' : 'text-muted-foreground'"
          @click="tab = t"
        >
          {{
            {
              prd: 'PRD',
              plan: '拆解计划',
              tasks: '任务',
            }[t]
          }}
        </button>
      </div>

      <div v-if="tab === 'prd'" class="min-h-0 flex-1 overflow-auto">
        <p v-if="!detail.goal.prdDocPath" class="text-muted-foreground text-sm">尚未生成 PRD</p>
        <template v-else>
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p class="text-muted-foreground text-xs">文档路径：{{ detail.goal.prdDocPath }}</p>
            <button
              type="button"
              class="border-input bg-background h-8 shrink-0 rounded-md border px-2.5 text-xs disabled:opacity-50"
              :disabled="prdPreviewLoading || prdEditorSaving"
              @click="openPrdEditor"
            >
              编辑
            </button>
          </div>
          <div v-if="prdPreviewLoading" class="text-muted-foreground py-6 text-sm">加载 PRD 中…</div>
          <p v-else-if="prdPreviewError" class="text-destructive text-sm">{{ prdPreviewError }}</p>
          <div v-else class="bg-muted/20 rounded-md border border-border p-4">
            <MarkdownPreview :content="prdPreviewContent" />
          </div>
        </template>
      </div>

      <div v-else-if="tab === 'plan'" class="min-h-0 flex-1 overflow-auto">
        <section v-if="detail.planItems.length > 0" class="mb-4">
          <h3 class="text-foreground mb-1.5 text-xs font-medium">计划依赖</h3>
          <p v-if="planDepsHasCycle" class="text-destructive mb-2 text-xs">
            检测到计划项依赖存在环，请修正后再物化。
          </p>
          <div
            class="bg-muted/20 max-h-44 overflow-x-auto overflow-y-auto rounded-md border border-border p-2 [&_.markdown-preview]:text-xs"
          >
            <MarkdownPreview :key="planDepsGraphKey" :content="planDepsMarkdown" />
          </div>
        </section>
        <p
          v-if="!loadingWorkflowTemplates && workflowTemplates.length === 0"
          class="text-muted-foreground mb-3 text-xs text-amber-600 dark:text-amber-500"
        >
          当前项目暂无启用的工作流，请先在项目下创建并启用后再为计划项配置工作流。
        </p>
        <table class="w-full text-left text-xs">
          <thead class="bg-muted/50">
            <tr>
              <th class="p-2">标题</th>
              <th class="p-2">状态</th>
              <th class="min-w-[200px] p-2">配置工作流</th>
              <th class="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in detail.planItems"
              :key="item.id"
              class="hover:bg-muted/50 cursor-pointer border-b"
              @click="openPlanItemDetail(item)"
            >
              <td class="hover:text-primary p-2 hover:underline">{{ item.title }}</td>
              <td class="p-2">{{ planItemStatusLabel[item.status] }}</td>
              <td class="p-2 align-middle" @click.stop>
                <template v-if="item.status === 'approved' && !item.taskId">
                  <AppSelect
                    :model-value="item.workflowTemplateId ?? ''"
                    aria-label="计划项配置工作流"
                    :block="true"
                    :options="workflowOptionsForPlanItem(item.workflowTemplateId)"
                    :disabled="
                      loadingWorkflowTemplates ||
                      workflowTemplates.length === 0 ||
                      savingPlanItemWorkflowId === item.id
                    "
                    :panel-z-index="GOAL_SELECT_PANEL_Z_INDEX"
                    :panel-placement="GOAL_SELECT_PANEL_PLACEMENT"
                    size="sm"
                    trigger-class="min-w-[180px] rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm"
                    @update:model-value="(v) => setPlanItemWorkflow(item, String(v ?? ''))"
                  />
                </template>
                <span v-else-if="item.taskId" class="text-muted-foreground">已物化</span>
                <span v-else class="text-muted-foreground">—</span>
              </td>
              <td class="p-2" @click.stop>
                <button
                  v-if="item.status === 'draft'"
                  type="button"
                  class="text-primary text-xs underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                  :disabled="!!planItemApproveBlockedReason(item)"
                  :title="planItemApproveBlockedReason(item) ?? undefined"
                  @click="approveItem(item)"
                >
                  确认
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="tab === 'tasks'" class="min-h-0 flex-1 overflow-auto">
        <section v-if="detail.tasks.length > 0" class="mb-4">
          <h3 class="text-foreground mb-1.5 text-xs font-medium">任务依赖</h3>
          <p v-if="taskDepsHasCycle" class="text-destructive mb-2 text-xs">
            检测到任务依赖存在环，请检查依赖关系。
          </p>
          <div
            class="bg-muted/20 max-h-44 overflow-x-auto overflow-y-auto rounded-md border border-border p-2 [&_.markdown-preview]:text-xs"
          >
            <MarkdownPreview :key="taskDepsGraphKey" :content="taskDepsMarkdown" />
          </div>
        </section>
        <ul class="text-sm">
          <li v-for="t in detail.tasks" :key="t.id" class="border-b py-2">
            <button type="button" class="text-primary hover:underline" @click="goTask(t.id)">
              {{ t.title }}
            </button>
            <span class="text-muted-foreground ml-2 text-xs">{{ t.status }}</span>
          </li>
        </ul>
        <p v-if="detail.tasks.length === 0" class="text-muted-foreground text-sm">暂无任务</p>
      </div>

      <Sheet :open="planItemDetailOpen" @update:open="onPlanItemSheetOpen">
        <SheetContent
          side="right"
          class="flex w-full max-h-[100vh] flex-col gap-0 overflow-hidden sm:max-w-2xl"
        >
          <template v-if="selectedPlanItem">
            <SheetHeader class="text-left">
              <SheetTitle class="pr-8 text-base leading-snug">{{ selectedPlanItem.title }}</SheetTitle>
            </SheetHeader>
            <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4 text-sm">
              <div>
                <div class="text-muted-foreground mb-1 text-xs">状态</div>
                <div>{{ planItemStatusLabel[selectedPlanItem.status] }}</div>
              </div>
              <div>
                <div class="text-muted-foreground mb-1 text-xs">顺序</div>
                <div>{{ selectedPlanItem.itemOrder }}</div>
              </div>
              <div>
                <label class="text-muted-foreground mb-1 block text-xs" for="goal-plan-item-summary"
                  >摘要</label
                >
                <textarea
                  id="goal-plan-item-summary"
                  v-model="planItemEditSummary"
                  rows="4"
                  class="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label
                  class="text-muted-foreground mb-1 block text-xs"
                  for="goal-plan-item-acceptance"
                  >验收标准</label
                >
                <textarea
                  id="goal-plan-item-acceptance"
                  v-model="planItemEditAcceptance"
                  rows="5"
                  class="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <label class="text-muted-foreground mb-1 block text-xs" for="goal-plan-item-prompt"
                  >建议提示词</label
                >
                <textarea
                  id="goal-plan-item-prompt"
                  v-model="planItemEditSuggestedPrompt"
                  rows="5"
                  class="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
              <div>
                <div class="text-muted-foreground mb-1 text-xs">依赖计划项</div>
                <ul
                  v-if="dependencyTitlesForPlanItem(selectedPlanItem).length > 0"
                  class="list-inside list-disc space-y-1"
                >
                  <li v-for="(t, idx) in dependencyTitlesForPlanItem(selectedPlanItem)" :key="idx">
                    {{ t }}
                  </li>
                </ul>
                <div v-else class="text-foreground">无</div>
              </div>
              <div>
                <div class="text-muted-foreground mb-1 text-xs">配置工作流</div>
                <div>{{ workflowNameForPlanItem(selectedPlanItem) || '—' }}</div>
              </div>
              <div v-if="selectedPlanItem.taskId">
                <div class="text-muted-foreground mb-1 text-xs">关联任务</div>
                <button
                  type="button"
                  class="text-primary text-sm underline"
                  @click="goTaskFromSheet(selectedPlanItem.taskId!)"
                >
                  查看任务
                </button>
              </div>
            </div>
            <SheetFooter class="border-border flex flex-row justify-end gap-2 border-t py-4">
              <button
                type="button"
                class="border-input bg-background h-9 rounded-md border px-3 text-sm"
                :disabled="savingPlanItemText"
                @click="resetPlanItemTextDraft"
              >
                取消
              </button>
              <button
                type="button"
                class="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm disabled:opacity-50"
                :disabled="savingPlanItemText"
                @click="savePlanItemText"
              >
                {{ savingPlanItemText ? '保存中…' : '保存' }}
              </button>
            </SheetFooter>
          </template>
        </SheetContent>
      </Sheet>

      <Sheet :open="prdEditorOpen" @update:open="onPrdEditorOpen">
        <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden sm:max-w-3xl">
          <SheetHeader class="text-left">
            <SheetTitle class="pr-8 text-base">编辑 PRD</SheetTitle>
          </SheetHeader>
          <div class="min-h-0 flex-1 overflow-auto py-2">
            <div v-if="prdEditorLoading" class="text-muted-foreground text-sm">加载中…</div>
            <textarea
              v-else
              v-model="prdEditorContent"
              class="border-input bg-background focus-visible:ring-ring font-mono h-[min(70vh,520px)] w-full resize-y rounded-md border p-3 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2"
              spellcheck="false"
            />
          </div>
          <SheetFooter class="border-border flex flex-row justify-end gap-2 border-t py-4">
            <button
              type="button"
              class="border-input bg-background h-9 rounded-md border px-3 text-sm"
              :disabled="prdEditorSaving || prdEditorLoading"
              @click="prdEditorOpen = false"
            >
              取消
            </button>
            <button
              type="button"
              class="bg-primary text-primary-foreground h-9 rounded-md px-3 text-sm disabled:opacity-50"
              :disabled="prdEditorSaving || prdEditorLoading"
              @click="savePrdEditor"
            >
              {{ prdEditorSaving ? '保存中…' : '保存' }}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </template>
  </div>
</template>
