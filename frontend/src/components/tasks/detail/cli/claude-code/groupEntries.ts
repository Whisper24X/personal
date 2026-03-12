import type { NormalizedEntry, NormalizedEntryType } from '../types'

export interface ClaudeTaskGroup {
  type: 'task'
  title: string
  description: string
  tools: NormalizedEntry[]
}

export interface ClaudeOtherGroup {
  type: 'other'
  entry: NormalizedEntry
}

export type ClaudeMessageGroup = ClaudeTaskGroup | ClaudeOtherGroup

export type ClaudeToolPairItem = { kind: 'tool'; tool: NormalizedEntry; result?: NormalizedEntry }
export type ClaudeThinkingItem = { kind: 'thinking'; entry: NormalizedEntry }
export type ClaudeSystemItem = { kind: 'system'; entry: NormalizedEntry }
export type ClaudeGroupItem = ClaudeToolPairItem | ClaudeThinkingItem | ClaudeSystemItem

const TOOL_TYPES: Set<NormalizedEntryType> = new Set([
  'tool_use',
  'tool_result',
  'command_run',
  'file_edit',
  'file_read',
  'thinking',
])

export function groupClaudeEntries(entries: NormalizedEntry[]): ClaudeMessageGroup[] {
  const groups: ClaudeMessageGroup[] = []
  let currentTaskGroup: ClaudeTaskGroup | null = null

  const flushTaskGroup = () => {
    if (currentTaskGroup && (currentTaskGroup.tools.length > 0 || currentTaskGroup.description)) {
      groups.push(currentTaskGroup)
      currentTaskGroup = null
    }
  }

  for (const entry of entries) {
    if (entry.type === 'assistant_message') {
      flushTaskGroup()
      currentTaskGroup = {
        type: 'task',
        title: entry.content.length > 80 ? `${entry.content.slice(0, 80)}...` : entry.content,
        description: entry.content,
        tools: [],
      }
    } else if (TOOL_TYPES.has(entry.type)) {
      if (!currentTaskGroup) {
        currentTaskGroup = {
          type: 'task',
          title: '',
          description: '',
          tools: [],
        }
      }
      currentTaskGroup.tools.push(entry)
    } else if (entry.type === 'user_message' || entry.type === 'error') {
      flushTaskGroup()
      groups.push({ type: 'other', entry })
    } else {
      if (currentTaskGroup && currentTaskGroup.tools.length > 0) {
        currentTaskGroup.tools.push(entry)
      } else {
        flushTaskGroup()
        groups.push({ type: 'other', entry })
      }
    }
  }

  flushTaskGroup()
  return groups
}

export function buildClaudeTaskGroupItems(group: ClaudeTaskGroup): ClaudeGroupItem[] {
  const items: ClaudeGroupItem[] = []
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

  for (let i = 0; i < tools.length; i += 1) {
    const entry = tools[i]
    if (!entry) continue

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
      result: findMatchingResult(i, entry.metadata?.toolUseId as string | undefined),
    })
  }

  return items
}
