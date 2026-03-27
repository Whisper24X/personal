import type {
  GoalPlanItem,
  GoalPlanItemStatus,
  GoalPlanSubTask,
} from '@/types/api/goals'

type PlanNodeClassName = 'planApproved' | 'planMaterialized' | 'planDraft' | 'planCancelled'

type PlanGraphNode = {
  id: string
  title: string
  status: GoalPlanItemStatus
  dependsOnItemIds: string[]
}

function planItemNodeClass(status: GoalPlanItemStatus): PlanNodeClassName {
  switch (status) {
    case 'task_created':
    case 'completed':
      return 'planMaterialized'
    case 'approved':
      return 'planApproved'
    case 'cancelled':
      return 'planCancelled'
    default:
      return 'planDraft'
  }
}

const MAX_LABEL_LEN = 32

export function planItemNodeId(planItemId: string): string {
  return `P_${planItemId.replace(/-/g, '_')}`
}

function subgraphIdForPlanItem(planItemId: string): string {
  return `SG_${planItemId.replace(/-/g, '_')}`
}

function mermaidNodeLabel(title: string): string {
  let s = title.trim() || '（无标题）'
  s = s.replace(/"/g, "'").replace(/\r?\n/g, ' ').replace(/\s+/g, ' ')
  if (s.length > MAX_LABEL_LEN) {
    s = `${s.slice(0, MAX_LABEL_LEN - 1)}…`
  }
  return s
}

function buildPlanItemAdjacency(
  items: Array<{ id: string; dependsOnItemIds: string[] }>,
): Map<string, string[]> {
  const ids = new Set(items.map((i) => i.id))
  const adj = new Map<string, string[]>()
  for (const item of items) {
    for (const pred of item.dependsOnItemIds ?? []) {
      if (!ids.has(pred)) {
        continue
      }
      if (!adj.has(pred)) {
        adj.set(pred, [])
      }
      adj.get(pred)!.push(item.id)
    }
  }
  return adj
}

function directedGraphHasCycle(
  nodeIds: Set<string>,
  adj: Map<string, string[]>,
): boolean {
  const state = new Map<string, 0 | 1 | 2>()

  const dfs = (u: string): boolean => {
    if (state.get(u) === 1) {
      return true
    }
    if (state.get(u) === 2) {
      return false
    }
    state.set(u, 1)
    for (const v of adj.get(u) ?? []) {
      if (!nodeIds.has(v)) {
        continue
      }
      if (dfs(v)) {
        return true
      }
    }
    state.set(u, 2)
    return false
  }

  for (const id of nodeIds) {
    if (dfs(id)) {
      return true
    }
  }
  return false
}

export function planItemsDependencyHasCycle(
  items: Array<{ id: string; dependsOnItemIds: string[] }>,
): boolean {
  if (items.length === 0) {
    return false
  }
  const nodeIds = new Set(items.map((i) => i.id))
  const adj = buildPlanItemAdjacency(items)
  return directedGraphHasCycle(nodeIds, adj)
}

function buildPlanDependencyMermaidCore(nodes: PlanGraphNode[]): string | null {
  if (nodes.length === 0) {
    return null
  }
  const ids = new Set(nodes.map((i) => i.id))
  const lines: string[] = [
    '%%{init: {"themeVariables": {"fontSize": "11px", "fontFamily": "ui-sans-serif, system-ui, sans-serif"}, "flowchart": {"curve": "basis", "padding": 6, "diagramPadding": 8, "nodeSpacing": 40, "rankSpacing": 44, "useMaxWidth": true}}}%%',
    'flowchart LR',
  ]
  for (const item of nodes) {
    lines.push(`  ${planItemNodeId(item.id)}["${mermaidNodeLabel(item.title)}"]`)
  }
  for (const item of nodes) {
    for (const pred of item.dependsOnItemIds ?? []) {
      if (!ids.has(pred)) {
        continue
      }
      lines.push(`  ${planItemNodeId(pred)} --> ${planItemNodeId(item.id)}`)
    }
  }

  lines.push(
    '  classDef planApproved fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f',
    '  classDef planMaterialized fill:#d1fae5,stroke:#059669,stroke-width:1.5px,color:#064e3b',
    '  classDef planDraft fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,color:#475569',
    '  classDef planCancelled fill:#f1f5f9,stroke:#94a3b8,stroke-width:1.5px,color:#64748b,stroke-dasharray: 4 3',
  )

  const byClass: Record<PlanNodeClassName, string[]> = {
    planApproved: [],
    planMaterialized: [],
    planDraft: [],
    planCancelled: [],
  }
  for (const item of nodes) {
    const cls = planItemNodeClass(item.status)
    byClass[cls].push(planItemNodeId(item.id))
  }
  for (const [className, nodeIds] of Object.entries(byClass)) {
    if (nodeIds.length > 0) {
      lines.push(`  class ${nodeIds.join(',')} ${className}`)
    }
  }

  lines.push('  linkStyle default stroke:#94a3b8,stroke-width:1.5px')

  return lines.join('\n')
}

function subTasksToGraphNodes(subtasks: GoalPlanSubTask[]): PlanGraphNode[] {
  return subtasks.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    dependsOnItemIds: s.dependsOnSubTaskIds ?? [],
  }))
}

/** 扁平图（无功能组框）；一般请用 {@link buildPlanDependencyMermaidFromPlanItems} */
export function buildPlanDependencyMermaidFromSubTasks(
  subtasks: GoalPlanSubTask[],
): string | null {
  return buildPlanDependencyMermaidCore(subTasksToGraphNodes(subtasks))
}

/**
 * 按功能组（subgraph + 虚线框）绘制子任务依赖图；跨组依赖仍用箭头连接。
 */
export function buildPlanDependencyMermaidFromPlanItems(
  planItems: GoalPlanItem[],
): string | null {
  const sorted = [...planItems].sort((a, b) => a.itemOrder - b.itemOrder)
  const allSubtasks: GoalPlanSubTask[] = []
  for (const g of sorted) {
    for (const s of g.subTasks ?? []) {
      allSubtasks.push(s)
    }
  }
  if (allSubtasks.length === 0) {
    return null
  }

  const idSet = new Set(allSubtasks.map((s) => s.id))
  const lines: string[] = [
    '%%{init: {"themeVariables": {"fontSize": "11px", "fontFamily": "ui-sans-serif, system-ui, sans-serif"}, "flowchart": {"curve": "basis", "padding": 6, "diagramPadding": 10, "nodeSpacing": 36, "rankSpacing": 40, "useMaxWidth": true}}}%%',
    'flowchart LR',
  ]

  for (const g of sorted) {
    const subs = g.subTasks ?? []
    if (subs.length === 0) {
      continue
    }
    const sg = subgraphIdForPlanItem(g.id)
    const title = mermaidNodeLabel(g.title || '功能组')
    lines.push(`  subgraph ${sg}["${title}"]`)
    lines.push(`    direction LR`)
    for (const s of subs) {
      lines.push(
        `    ${planItemNodeId(s.id)}["${mermaidNodeLabel(s.title)}"]`,
      )
    }
    lines.push(`  end`)
  }

  for (const s of allSubtasks) {
    for (const pred of s.dependsOnSubTaskIds ?? []) {
      if (!idSet.has(pred)) {
        continue
      }
      lines.push(`  ${planItemNodeId(pred)} --> ${planItemNodeId(s.id)}`)
    }
  }

  lines.push(
    '  classDef planApproved fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f',
    '  classDef planMaterialized fill:#d1fae5,stroke:#059669,stroke-width:1.5px,color:#064e3b',
    '  classDef planDraft fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,color:#475569',
    '  classDef planCancelled fill:#f1f5f9,stroke:#94a3b8,stroke-width:1.5px,color:#64748b,stroke-dasharray: 4 3',
  )

  const byClass: Record<PlanNodeClassName, string[]> = {
    planApproved: [],
    planMaterialized: [],
    planDraft: [],
    planCancelled: [],
  }
  for (const s of allSubtasks) {
    const cls = planItemNodeClass(s.status)
    byClass[cls].push(planItemNodeId(s.id))
  }
  for (const [className, nodeIds] of Object.entries(byClass)) {
    if (nodeIds.length > 0) {
      lines.push(`  class ${nodeIds.join(',')} ${className}`)
    }
  }

  lines.push('  linkStyle default stroke:#94a3b8,stroke-width:1.5px')

  for (const g of sorted) {
    if ((g.subTasks ?? []).length === 0) {
      continue
    }
    const sg = subgraphIdForPlanItem(g.id)
    lines.push(
      `  style ${sg} fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,stroke-dasharray:6 4,color:#64748b`,
    )
  }

  return lines.join('\n')
}

export function planDependencyMermaidMarkdown(planItems: GoalPlanItem[]): string {
  const src = buildPlanDependencyMermaidFromPlanItems(planItems)
  if (!src) {
    return ''
  }
  return `\`\`\`mermaid\n${src}\n\`\`\``
}
