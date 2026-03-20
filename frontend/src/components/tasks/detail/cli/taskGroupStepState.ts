import type { NormalizedEntry } from './types'
import { getString } from './utils'

/** 与 claude-code / cursor-agent / gemini TaskGroupCard.isRunning 一致 */
export function claudeLikeToolsRunning(tools: NormalizedEntry[]): boolean {
  return tools.some((t) => t.metadata?.status === 'running' || t.metadata?.status === 'pending')
}

export function claudeLikeToolsFailed(tools: NormalizedEntry[]): boolean {
  return tools.some((t) => t.metadata?.status === 'failed')
}

/** 与 codex TaskGroupCard 中 groupItems + isRunning 一致 */
function codexBuildToolPairItems(tools: NormalizedEntry[]): Array<{
  kind: 'tool'
  tool: NormalizedEntry
  result?: NormalizedEntry
}> {
  const items: Array<{ kind: 'tool'; tool: NormalizedEntry; result?: NormalizedEntry }> = []
  const resultQueues = new Map<string, NormalizedEntry[]>()
  const consumedResultIds = new Set<string>()

  tools.forEach((entry) => {
    if (entry.type !== 'tool_result') return
    const toolUseId = getString(entry.metadata?.toolUseId)
    if (!toolUseId) return
    const queue = resultQueues.get(toolUseId) ?? []
    queue.push(entry)
    resultQueues.set(toolUseId, queue)
  })

  for (let i = 0; i < tools.length; i += 1) {
    const entry = tools[i]
    if (!entry) continue
    if (entry.type === 'tool_result') continue
    if (entry.type === 'system_message') continue
    if (entry.type === 'thinking') continue

    let result: NormalizedEntry | undefined
    const toolUseId = getString(entry.metadata?.toolUseId)
    if (toolUseId) {
      const queue = resultQueues.get(toolUseId)
      const nextResult = queue?.shift()
      if (nextResult) {
        result = nextResult
        consumedResultIds.add(nextResult.id)
      }
    }

    const next = tools[i + 1]
    if (!result && next && next.type === 'tool_result' && !consumedResultIds.has(next.id)) {
      result = next
      consumedResultIds.add(next.id)
    }
    items.push({ kind: 'tool', tool: entry, result })
  }
  return items
}

export function codexToolsRunning(tools: NormalizedEntry[]): boolean {
  return codexBuildToolPairItems(tools).some(
    (item) =>
      !item.result &&
      (item.tool.metadata?.status === 'running' || item.tool.metadata?.status === 'pending'),
  )
}

export type TaskStepState = 'running' | 'done' | 'failed'

export function claudeLikeTaskStepState(tools: NormalizedEntry[]): TaskStepState {
  if (claudeLikeToolsFailed(tools)) return 'failed'
  if (claudeLikeToolsRunning(tools)) return 'running'
  return 'done'
}

export function codexTaskStepState(tools: NormalizedEntry[]): TaskStepState {
  if (codexBuildToolPairItems(tools).some((item) => item.tool.metadata?.status === 'failed')) return 'failed'
  if (codexToolsRunning(tools)) return 'running'
  return 'done'
}

export function opencodeTaskStepState(status: 'running' | 'success' | 'failed'): TaskStepState {
  if (status === 'failed') return 'failed'
  if (status === 'running') return 'running'
  return 'done'
}

/** 步骤条展示：最多 9 个字，超出用 …（含省略号共占 9 格：前 8 字 + …） */
const TASK_STEP_LABEL_MAX_CHARS = 9

/** 完整标题（用于 hover / tooltip，不截断） */
export function taskGroupFullLabel(group: { title: string; description: string }, fallbackIndex: number): string {
  const raw = group.title?.trim() || group.description?.trim().split('\n')[0]?.trim() || ''
  return raw || `步骤 ${fallbackIndex}`
}

export function taskGroupLabel(group: { title: string; description: string }, fallbackIndex: number): string {
  const text = taskGroupFullLabel(group, fallbackIndex)
  if (text.length <= TASK_STEP_LABEL_MAX_CHARS) return text
  return `${text.slice(0, TASK_STEP_LABEL_MAX_CHARS - 1)}…`
}

export const ASSISTANT_STEP_BAR_MIN_TASKS = 2

export type StepBarModel = { steps: { label: string; fullLabel: string; state: TaskStepState }[] }

/** 仅「步骤 N」占位标题且无正文，视为无意义开头（与 opencode 默认 title 等） */
function isPlaceholderStepTitleOnly(title: string, description: string): boolean {
  const t = title.trim()
  const d = description.trim()
  if (!t && !d) return true
  return d === '' && /^步骤\s*\d+$/u.test(t)
}

/** 去掉开头无标题且无正文、或仅有「步骤 N」占位标题的 task 组 */
export function dropLeadingEmptyTaskGroups<T extends { title: string; description: string }>(tasks: T[]): T[] {
  let start = 0
  while (start < tasks.length) {
    const g = tasks[start]
    if (!g) break
    if (isPlaceholderStepTitleOnly(g.title, g.description)) start += 1
    else break
  }
  return tasks.slice(start)
}

/** 会话已产出「最终结果」类条目时，最后一个 task 组视为收尾/结论，不纳入步骤条 */
export function tasksForStepBarExcludingFinalTask<T extends { title: string; description: string; tools: unknown[] }>(
  tasks: T[],
  shouldExcludeLastTask: boolean,
): T[] {
  if (!shouldExcludeLastTask || tasks.length <= 1) return tasks
  return tasks.slice(0, -1)
}

/** 先去掉开头空 task，再按「最终结果」去掉末尾 task */
export function prepareTaskGroupsForStepBar<T extends { title: string; description: string; tools: unknown[] }>(
  tasks: T[],
  shouldExcludeLastTask: boolean,
): T[] {
  return tasksForStepBarExcludingFinalTask(dropLeadingEmptyTaskGroups(tasks), shouldExcludeLastTask)
}

export function buildStepBarClaudeLike(
  tasks: Array<{ title: string; description: string; tools: NormalizedEntry[] }>,
): StepBarModel | null {
  if (tasks.length < ASSISTANT_STEP_BAR_MIN_TASKS) return null
  return {
    steps: tasks.map((g, i) => ({
      label: taskGroupLabel(g, i + 1),
      fullLabel: taskGroupFullLabel(g, i + 1),
      state: claudeLikeTaskStepState(g.tools),
    })),
  }
}

export function buildStepBarCodex(
  tasks: Array<{ title: string; description: string; tools: NormalizedEntry[] }>,
): StepBarModel | null {
  if (tasks.length < ASSISTANT_STEP_BAR_MIN_TASKS) return null
  return {
    steps: tasks.map((g, i) => ({
      label: taskGroupLabel(g, i + 1),
      fullLabel: taskGroupFullLabel(g, i + 1),
      state: codexTaskStepState(g.tools),
    })),
  }
}

export function buildStepBarOpencode(
  tasks: Array<{ title: string; description: string; status: 'running' | 'success' | 'failed' }>,
): StepBarModel | null {
  if (tasks.length < ASSISTANT_STEP_BAR_MIN_TASKS) return null
  return {
    steps: tasks.map((g, i) => ({
      label: taskGroupLabel(g, i + 1),
      fullLabel: taskGroupFullLabel(g, i + 1),
      state: opencodeTaskStepState(g.status),
    })),
  }
}
