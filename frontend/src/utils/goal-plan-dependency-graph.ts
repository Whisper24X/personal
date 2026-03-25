import type { GoalPlanItem } from '@/types/api/goals'

type PlanNodeClassName = 'planApproved' | 'planMaterialized' | 'planDraft' | 'planCancelled'

/** Mermaid class 名：已确认（黄）、已创建任务（绿）、草稿、已取消 */
function planItemNodeClass(status: GoalPlanItem['status']): PlanNodeClassName {
  switch (status) {
    case 'task_created':
      return 'planMaterialized'
    case 'approved':
      return 'planApproved'
    case 'cancelled':
      return 'planCancelled'
    default:
      return 'planDraft'
  }
}

/** 节点标题截断长度（配合 LR 小图） */
const MAX_LABEL_LEN = 32

/** Mermaid 安全节点 id（与 backend goal-plan-dag 中节点 id 一致，仅作展示） */
export function planItemNodeId(planItemId: string): string {
  return `P_${planItemId.replace(/-/g, '_')}`
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

/** 与 backend goal-plan-dag.ts 中 directedGraphHasCycle 一致 */
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

/**
 * 生成 Mermaid flowchart LR 源码（从左到右）；无计划项时返回 null。
 * 边语义：pred → item（前置须先完成）。
 */
export function buildPlanDependencyMermaid(items: GoalPlanItem[]): string | null {
  if (items.length === 0) {
    return null
  }
  const ids = new Set(items.map((i) => i.id))
  const lines: string[] = [
    '%%{init: {"themeVariables": {"fontSize": "11px", "fontFamily": "ui-sans-serif, system-ui, sans-serif"}, "flowchart": {"curve": "basis", "padding": 6, "diagramPadding": 8, "nodeSpacing": 40, "rankSpacing": 44, "useMaxWidth": true}}}%%',
    'flowchart LR',
  ]
  for (const item of items) {
    lines.push(`  ${planItemNodeId(item.id)}["${mermaidNodeLabel(item.title)}"]`)
  }
  for (const item of items) {
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
  for (const item of items) {
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

export function planDependencyMermaidMarkdown(items: GoalPlanItem[]): string {
  const src = buildPlanDependencyMermaid(items)
  if (!src) {
    return ''
  }
  return `\`\`\`mermaid\n${src}\n\`\`\``
}
