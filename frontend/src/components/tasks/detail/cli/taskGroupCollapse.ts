/**
 * 本轮对话已结束时：所有 task 组折叠详情；最终结果由同轮 `other` 类型块（最终回答、Completed 等）展示。
 * @returns undefined 表示本轮未结束或未应用，沿用卡片内 isRunning 逻辑
 */
export function collapseDetailWhenTurnDone(
  turnFinished: boolean,
  index: number,
  items: Array<{ type: string }>,
): boolean | undefined {
  if (!turnFinished || items[index]?.type !== 'task') return undefined
  return true
}
