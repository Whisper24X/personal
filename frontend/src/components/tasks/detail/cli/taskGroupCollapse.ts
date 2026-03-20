/** 用于「本轮结束后折叠非最后 task」：返回各 task 行在 turn.items 中的下标 */
export function indicesOfTaskGroups(items: Array<{ type: string }>): number[] {
  return items.flatMap((g, i) => (g.type === 'task' ? [i] : []))
}

export function isLastTaskGroupAtIndex(items: Array<{ type: string }>, idx: number): boolean {
  const taskIdxs = indicesOfTaskGroups(items)
  return taskIdxs.length > 0 && taskIdxs[taskIdxs.length - 1] === idx
}

/**
 * 本轮对话已结束时：非最后一个 task 折叠详情；最后一个 task 展开。
 * @returns undefined 表示本轮未结束或未应用，沿用卡片内 isRunning 逻辑
 */
export function collapseDetailWhenTurnDone(
  turnFinished: boolean,
  index: number,
  items: Array<{ type: string }>,
): boolean | undefined {
  if (!turnFinished || items[index]?.type !== 'task') return undefined
  return !isLastTaskGroupAtIndex(items, index)
}
