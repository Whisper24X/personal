import type { TaskDependencyEdge } from '@/types/api/goals'
import type { Task } from '@/types/api/tasks'

const MAX_LABEL_LEN = 32

type TaskNodeClassName = 'taskTodo' | 'taskActive' | 'taskDone'

function taskNodeClass(status: Task['status']): TaskNodeClassName {
  switch (status) {
    case 'done':
      return 'taskDone'
    case 'in_progress':
    case 'in_review':
      return 'taskActive'
    default:
      return 'taskTodo'
  }
}

/** Mermaid 安全节点 id（与计划项 P_ 区分） */
export function goalTaskNodeId(taskId: string): string {
  return `T_${taskId.replace(/-/g, '_')}`
}

function mermaidNodeLabel(title: string): string {
  let s = title.trim() || '（无标题）'
  s = s.replace(/"/g, "'").replace(/\r?\n/g, ' ').replace(/\s+/g, ' ')
  if (s.length > MAX_LABEL_LEN) {
    s = `${s.slice(0, MAX_LABEL_LEN - 1)}…`
  }
  return s
}

function buildTaskAdjacencyFromEdges(
  edges: TaskDependencyEdge[],
  taskIds: Set<string>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!taskIds.has(e.predecessorTaskId) || !taskIds.has(e.successorTaskId)) {
      continue
    }
    if (!adj.has(e.predecessorTaskId)) {
      adj.set(e.predecessorTaskId, [])
    }
    adj.get(e.predecessorTaskId)!.push(e.successorTaskId)
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

export function taskDependencyHasCycle(
  tasks: Task[],
  edges: TaskDependencyEdge[],
): boolean {
  if (tasks.length === 0) {
    return false
  }
  const taskIds = new Set(tasks.map((t) => t.id))
  const adj = buildTaskAdjacencyFromEdges(edges, taskIds)
  return directedGraphHasCycle(taskIds, adj)
}

/**
 * 任务依赖：predecessor → successor（前置阻塞后继）。
 * 无任务时返回 null。
 */
export function buildTaskDependencyMermaid(
  tasks: Task[],
  edges: TaskDependencyEdge[],
): string | null {
  if (tasks.length === 0) {
    return null
  }
  const taskIds = new Set(tasks.map((t) => t.id))
  const lines: string[] = [
    '%%{init: {"themeVariables": {"fontSize": "11px"}}}%%',
    'flowchart LR',
  ]
  for (const t of tasks) {
    lines.push(`  ${goalTaskNodeId(t.id)}["${mermaidNodeLabel(t.title)}"]`)
  }
  for (const e of edges) {
    if (!taskIds.has(e.predecessorTaskId) || !taskIds.has(e.successorTaskId)) {
      continue
    }
    lines.push(
      `  ${goalTaskNodeId(e.predecessorTaskId)} --> ${goalTaskNodeId(e.successorTaskId)}`,
    )
  }

  lines.push(
    '  classDef taskTodo fill:#f3f4f6,stroke:#9ca3af,stroke-width:1px,color:#374151',
    '  classDef taskActive fill:#fef08a,stroke:#ca8a04,stroke-width:1.5px,color:#422006',
    '  classDef taskDone fill:#86efac,stroke:#15803d,stroke-width:1.5px,color:#052e16',
  )

  const byClass: Record<TaskNodeClassName, string[]> = {
    taskTodo: [],
    taskActive: [],
    taskDone: [],
  }
  for (const t of tasks) {
    byClass[taskNodeClass(t.status)].push(goalTaskNodeId(t.id))
  }
  for (const [className, nodeIds] of Object.entries(byClass)) {
    if (nodeIds.length > 0) {
      lines.push(`  class ${nodeIds.join(',')} ${className}`)
    }
  }

  return lines.join('\n')
}

export function taskDependencyMermaidMarkdown(
  tasks: Task[],
  edges: TaskDependencyEdge[],
): string {
  const src = buildTaskDependencyMermaid(tasks, edges)
  if (!src) {
    return ''
  }
  return `\`\`\`mermaid\n${src}\n\`\`\``
}
