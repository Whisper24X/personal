/** 计划项依赖：succ 依赖 pred（pred 必须先完成）=> 有向边 pred -> succ */
export function buildPlanItemAdjacency(
  items: Array<{ id: string; dependsOnItemIds: string[] }>,
): Map<string, string[]> {
  const ids = new Set(items.map((i) => i.id));
  const adj = new Map<string, string[]>();
  for (const item of items) {
    for (const pred of item.dependsOnItemIds ?? []) {
      if (!ids.has(pred)) {
        continue;
      }
      if (!adj.has(pred)) {
        adj.set(pred, []);
      }
      adj.get(pred)!.push(item.id);
    }
  }
  return adj;
}

/** 检测有向图是否存在环（DFS 三态） */
export function directedGraphHasCycle(
  nodeIds: Set<string>,
  adj: Map<string, string[]>,
): boolean {
  const state = new Map<string, 0 | 1 | 2>();

  const dfs = (u: string): boolean => {
    if (state.get(u) === 1) {
      return true;
    }
    if (state.get(u) === 2) {
      return false;
    }
    state.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      if (!nodeIds.has(v)) {
        continue;
      }
      if (dfs(v)) {
        return true;
      }
    }
    state.set(u, 2);
    return false;
  };

  for (const id of nodeIds) {
    if (dfs(id)) {
      return true;
    }
  }
  return false;
}

/**
 * 物化任务时的创建顺序：仅考虑 targetIds 之间的依赖，前置计划项必须先于后继创建。
 * 与 frontend/src/utils/goal-plan-materialize-order.ts 保持一致。
 */
export function topologicalMaterializeOrder(
  targetIds: string[],
  itemsById: Map<string, { dependsOnItemIds: string[] }>,
): string[] {
  const unique = [...new Set(targetIds)];
  if (unique.length === 0) {
    return [];
  }

  const idSet = new Set(unique);
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of unique) {
    indegree.set(id, 0);
  }
  for (const id of unique) {
    const item = itemsById.get(id);
    if (!item) {
      continue;
    }
    for (const pred of item.dependsOnItemIds ?? []) {
      if (!idSet.has(pred)) {
        continue;
      }
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
      if (!adj.has(pred)) {
        adj.set(pred, []);
      }
      adj.get(pred)!.push(id);
    }
  }

  const queue = unique.filter((id) => (indegree.get(id) ?? 0) === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);
    for (const v of adj.get(u) ?? []) {
      const next = (indegree.get(v) ?? 0) - 1;
      indegree.set(v, next);
      if (next === 0) {
        queue.push(v);
      }
    }
  }

  if (result.length !== unique.length) {
    throw new Error('GOAL_PLAN_MATERIALIZE_CYCLE');
  }

  return result;
}
