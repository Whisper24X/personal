export type AssistantTurn<T> = { kind: 'user'; item: T } | { kind: 'assistant'; items: T[] }

/**
 * 以用户消息为界，将连续的助手侧分组合并为一批（单消息泡内由上层再渲染）。
 */
export function mergeAssistantTurns<T>(groups: T[], isUserMessage: (g: T) => boolean): AssistantTurn<T>[] {
  const out: AssistantTurn<T>[] = []
  let batch: T[] = []

  const flush = () => {
    if (batch.length) {
      out.push({ kind: 'assistant', items: batch })
      batch = []
    }
  }

  for (const g of groups) {
    if (isUserMessage(g)) {
      flush()
      out.push({ kind: 'user', item: g })
    } else {
      batch.push(g)
    }
  }
  flush()
  return out
}
