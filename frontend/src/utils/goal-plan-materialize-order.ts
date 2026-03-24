/**
 * 物化任务时的创建顺序：仅考虑 targetIds 之间的依赖，前置任务必须先于后继创建。
 * 与 backend/src/goals/goal-plan-dag.ts 中 topologicalMaterializeOrder 保持一致。
 */
export function topologicalMaterializeOrder(
  targetIds: string[],
  planItems: Array<{ id: string; dependsOnItemIds: string[] }>,
): string[] {
  const unique = [...new Set(targetIds)]
  if (unique.length === 0) {
    return []
  }

  const itemsById = new Map(planItems.map((p) => [p.id, p]))
  const idSet = new Set(unique)
  const indegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const id of unique) {
    indegree.set(id, 0)
  }
  for (const id of unique) {
    const item = itemsById.get(id)
    if (!item) {
      continue
    }
    for (const pred of item.dependsOnItemIds ?? []) {
      if (!idSet.has(pred)) {
        continue
      }
      indegree.set(id, (indegree.get(id) ?? 0) + 1)
      if (!adj.has(pred)) {
        adj.set(pred, [])
      }
      adj.get(pred)!.push(id)
    }
  }

  const queue = unique.filter((id) => (indegree.get(id) ?? 0) === 0)
  const result: string[] = []

  while (queue.length > 0) {
    const u = queue.shift()!
    result.push(u)
    for (const v of adj.get(u) ?? []) {
      const next = (indegree.get(v) ?? 0) - 1
      indegree.set(v, next)
      if (next === 0) {
        queue.push(v)
      }
    }
  }

  if (result.length !== unique.length) {
    throw new Error('GOAL_PLAN_MATERIALIZE_CYCLE')
  }

  return result
}
