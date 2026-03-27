import type { NormalizedEntry, NormalizedEntryType } from '../types'

export interface CodexTaskGroup {
  type: 'task'
  title: string
  description: string
  tools: NormalizedEntry[]
}

export interface CodexOtherGroup {
  type: 'other'
  entry: NormalizedEntry
}

export type CodexMessageGroup = CodexTaskGroup | CodexOtherGroup

const TOOL_TYPES: Set<NormalizedEntryType> = new Set([
  'tool_use',
  'tool_result',
  'command_run',
  'file_edit',
  'file_read',
  'thinking',
])

const STANDALONE_EVENT_TYPES = new Set([
  'thread_started',
  'turn_started',
  'turn_completed',
  'patch_begin',
  'patch_end',
])

function isStandaloneCodexEvent(entry: NormalizedEntry): boolean {
  const eventType =
    typeof entry.metadata?.codexEventType === 'string' ? entry.metadata.codexEventType : null
  return (
    entry.type === 'system_message' && Boolean(eventType && STANDALONE_EVENT_TYPES.has(eventType))
  )
}

function isStandaloneCodexCard(entry: NormalizedEntry): boolean {
  return (
    entry.type === 'system_message' &&
    (entry.metadata?.codexCardType === 'todo_list' ||
      entry.metadata?.codexCardType === 'file_change')
  )
}

function hasRenderableTaskContent(group: CodexTaskGroup): boolean {
  if (group.description) return true

  return group.tools.some(
    (entry) => entry.type !== 'tool_result' && entry.type !== 'system_message',
  )
}

function isThinkingOnlyTaskGroup(group: CodexTaskGroup | null): boolean {
  if (!group || group.tools.length === 0) return false
  return group.tools.every((e) => e.type === 'thinking')
}

export function groupCodexEntries(entries: NormalizedEntry[]): CodexMessageGroup[] {
  const groups: CodexMessageGroup[] = []
  let currentTaskGroup: CodexTaskGroup | null = null

  const flushTaskGroup = () => {
    if (currentTaskGroup && hasRenderableTaskContent(currentTaskGroup)) {
      groups.push(currentTaskGroup)
    }

    currentTaskGroup = null
  }

  for (const entry of entries) {
    if (entry.type === 'assistant_message') {
      const leadingThinking: NormalizedEntry[] | null =
        currentTaskGroup && isThinkingOnlyTaskGroup(currentTaskGroup)
          ? [...currentTaskGroup.tools]
          : null
      if (leadingThinking) {
        currentTaskGroup = null
      }
      flushTaskGroup()
      currentTaskGroup = {
        type: 'task',
        title: entry.content.length > 80 ? `${entry.content.slice(0, 80)}...` : entry.content,
        description: entry.content,
        tools: leadingThinking ?? [],
      }
    } else if (isStandaloneCodexEvent(entry) || isStandaloneCodexCard(entry)) {
      flushTaskGroup()
      groups.push({ type: 'other', entry })
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
