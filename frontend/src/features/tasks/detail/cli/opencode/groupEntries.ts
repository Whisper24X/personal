import type { NormalizedEntry, NormalizedEntryType } from '../types'
import { getString } from '../utils'

export interface OpencodeTaskGroup {
  type: 'task'
  title: string
  description: string
  tools: NormalizedEntry[]
  status: 'running' | 'success' | 'failed'
  summary: string
  stepIndex: number
}

export interface OpencodeOtherGroup {
  type: 'other'
  entry: NormalizedEntry
}

export type OpencodeMessageGroup = OpencodeTaskGroup | OpencodeOtherGroup

export type OpencodeToolPairItem = { kind: 'tool'; tool: NormalizedEntry; result?: NormalizedEntry }
export type OpencodeThinkingItem = { kind: 'thinking'; entry: NormalizedEntry }
export type OpencodeSystemItem = { kind: 'system'; entry: NormalizedEntry }
export type OpencodeGroupItem = OpencodeToolPairItem | OpencodeThinkingItem | OpencodeSystemItem

const TOOL_TYPES: Set<NormalizedEntryType> = new Set([
  'tool_use',
  'tool_result',
  'command_run',
  'file_edit',
  'file_read',
  'thinking',
])

function createTaskGroup(stepIndex: number): OpencodeTaskGroup {
  return {
    type: 'task',
    title: `步骤 ${stepIndex}`,
    description: '',
    tools: [],
    status: 'running',
    summary: '等待执行',
    stepIndex,
  }
}

function isStepStart(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.opencodeEventType) === 'step_start'
}

function isStepFinish(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.opencodeEventType) === 'step_finish'
}

function computeGroupStatus(group: OpencodeTaskGroup): OpencodeTaskGroup['status'] {
  if (
    group.tools.some((entry) => {
      const status = entry.metadata?.status
      return status === 'failed' || entry.type === 'error'
    })
  ) {
    return 'failed'
  }

  if (
    group.tools.some((entry) => {
      const status = entry.metadata?.status
      return status === 'pending' || status === 'running'
    })
  ) {
    return 'running'
  }

  return 'success'
}

function updateGroupSummary(group: OpencodeTaskGroup): void {
  const toolCount = group.tools.filter((entry) => entry.type !== 'tool_result').length
  const failureCount = group.tools.filter((entry) => {
    if (entry.type === 'tool_result') {
      return entry.metadata?.status === 'failed'
    }

    const status = entry.metadata?.status
    if (status !== 'failed') return false

    const toolUseId = entry.metadata?.toolUseId
    if (!toolUseId) return true

    return !group.tools.some((candidate) => {
      return candidate.type === 'tool_result' && candidate.metadata?.toolUseId === toolUseId
    })
  }).length
  const resultCount = group.tools.filter((entry) => entry.type === 'tool_result').length
  const parts: string[] = []

  if (group.summary && group.summary !== '等待执行') {
    parts.push(group.summary)
  }

  if (toolCount > 0) {
    parts.push(`${toolCount} 个操作`)
  }
  if (resultCount > 0) {
    parts.push(`${resultCount} 个结果`)
  }
  if (failureCount > 0) {
    parts.push(`${failureCount} 个失败`)
  }

  if (!parts.length) {
    parts.push(group.status === 'running' ? '等待执行' : '执行完成')
  }

  group.summary = parts.join(' · ')
}

function finalizeGroup(group: OpencodeTaskGroup): OpencodeTaskGroup {
  const nextGroup = {
    ...group,
    tools: [...group.tools],
  }

  nextGroup.status = computeGroupStatus(nextGroup)
  updateGroupSummary(nextGroup)
  return nextGroup
}

export function groupOpencodeEntries(entries: NormalizedEntry[]): OpencodeMessageGroup[] {
  const groups: OpencodeMessageGroup[] = []
  let currentTaskGroup: OpencodeTaskGroup | null = null
  let stepIndex = 0

  const flushTaskGroup = () => {
    if (!currentTaskGroup) return
    if (currentTaskGroup.tools.length > 0 || currentTaskGroup.description) {
      groups.push(finalizeGroup(currentTaskGroup))
    }
    currentTaskGroup = null
  }

  const ensureTaskGroup = () => {
    if (currentTaskGroup) return currentTaskGroup
    stepIndex += 1
    currentTaskGroup = createTaskGroup(stepIndex)
    return currentTaskGroup
  }

  for (const entry of entries) {
    if (isStepStart(entry)) {
      flushTaskGroup()
      stepIndex += 1
      currentTaskGroup = createTaskGroup(stepIndex)
      continue
    }

    if (isStepFinish(entry)) {
      const group = ensureTaskGroup()
      group.summary = entry.content
      group.status = computeGroupStatus(group)
      flushTaskGroup()
      continue
    }

    if (entry.type === 'assistant_message' || entry.type === 'user_message' || entry.type === 'error') {
      flushTaskGroup()
      groups.push({ type: 'other', entry })
      continue
    }

    if (TOOL_TYPES.has(entry.type) || entry.type === 'system_message') {
      ensureTaskGroup().tools.push(entry)
      continue
    }

    flushTaskGroup()
    groups.push({ type: 'other', entry })
  }

  flushTaskGroup()

  return groups
}

export function buildOpencodeTaskGroupItems(group: OpencodeTaskGroup): OpencodeGroupItem[] {
  const items: OpencodeGroupItem[] = []
  const tools = group.tools
  const usedResultIds = new Set<string>()

  const findMatchingResult = (
    startIndex: number,
    toolUseId?: string,
  ): NormalizedEntry | undefined => {
    if (toolUseId) {
      for (let index = startIndex + 1; index < tools.length; index += 1) {
        const candidate = tools[index]
        if (!candidate || candidate.type !== 'tool_result' || usedResultIds.has(candidate.id)) continue
        if (candidate.metadata?.toolUseId === toolUseId) {
          usedResultIds.add(candidate.id)
          return candidate
        }
      }
    }

    const next = tools[startIndex + 1]
    if (next && next.type === 'tool_result' && !usedResultIds.has(next.id)) {
      usedResultIds.add(next.id)
      return next
    }

    return undefined
  }

  for (let index = 0; index < tools.length; index += 1) {
    const entry = tools[index]
    if (!entry || isStepStart(entry) || isStepFinish(entry)) continue

    if (entry.type === 'tool_result') continue

    if (entry.type === 'thinking') {
      items.push({ kind: 'thinking', entry })
      continue
    }

    if (entry.type === 'system_message') {
      items.push({ kind: 'system', entry })
      continue
    }

    items.push({
      kind: 'tool',
      tool: entry,
      result: findMatchingResult(index, entry.metadata?.toolUseId as string | undefined),
    })
  }

  return items
}
