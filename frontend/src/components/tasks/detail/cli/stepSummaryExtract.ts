import type { StepSummaryRequestItem, TaskMessage } from '@/types/api/tasks'
import { parseClaudeCodeMessages } from './claude-code/parser'
import { groupClaudeEntries, type ClaudeMessageGroup, type ClaudeTaskGroup } from './claude-code/groupEntries'
import { parseCodexMessages } from './codex/parser'
import { groupCodexEntries, type CodexMessageGroup, type CodexTaskGroup } from './codex/groupEntries'
import { parseCursorAgentMessages } from './cursor-agent/parser'
import { groupCursorEntries, type CursorMessageGroup, type CursorTaskGroup } from './cursor-agent/groupEntries'
import { parseGeminiMessages } from './gemini/parser'
import { groupGeminiEntries, type GeminiMessageGroup, type GeminiTaskGroup } from './gemini/groupEntries'
import { parseOpencodeMessages } from './opencode/parser'
import { groupOpencodeEntries, type OpencodeMessageGroup, type OpencodeTaskGroup } from './opencode/groupEntries'
import { mergeAssistantTurns, type AssistantTurn } from './mergeAssistantTurns'
import type { NormalizedEntry } from './types'
import {
  ASSISTANT_STEP_BAR_MIN_TASKS,
  prepareTaskGroupsForStepBar,
  taskGroupFullLabel,
} from './taskGroupStepState'
import { getString } from './utils'

function isClaudeLikeResultEntry(entry: NormalizedEntry): boolean {
  return entry.metadata?.isResult === true
}

function isCodexTurnCompleted(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.codexEventType) === 'turn_completed'
}

function extractClaudeLike<T>(
  turns: AssistantTurn<T>[],
  pickTasks: (items: T[]) => Array<{ title: string; description: string; tools: NormalizedEntry[] }>,
  shouldExcludeLastTask: (items: T[]) => boolean,
): StepSummaryRequestItem[] {
  const items: StepSummaryRequestItem[] = []
  for (let tIdx = 0; tIdx < turns.length; tIdx += 1) {
    const turn = turns[tIdx]
    if (!turn || turn.kind !== 'assistant') continue
    const tasks = prepareTaskGroupsForStepBar(
      pickTasks(turn.items),
      shouldExcludeLastTask(turn.items),
    )
    if (tasks.length < ASSISTANT_STEP_BAR_MIN_TASKS) continue
    for (let i = 0; i < tasks.length; i += 1) {
      const g = tasks[i]
      if (!g) continue
      items.push({
        id: `t${tIdx}-s${i}`,
        rawText: taskGroupFullLabel(g, i + 1),
      })
    }
  }
  return items
}

function claudePickTasks(items: ClaudeMessageGroup[]) {
  return items.filter((g): g is ClaudeTaskGroup => g.type === 'task')
}

function claudeExcludeLast(items: ClaudeMessageGroup[]): boolean {
  return items.some((g) => g.type === 'other' && isClaudeLikeResultEntry(g.entry))
}

export function extractClaudeCodeStepSummaryItems(messages: TaskMessage[]): StepSummaryRequestItem[] {
  const entries = parseClaudeCodeMessages(messages)
  const groups = groupClaudeEntries(entries)
  const turns = mergeAssistantTurns(
    groups,
    (g: ClaudeMessageGroup) => g.type === 'other' && g.entry.type === 'user_message',
  )
  return extractClaudeLike(turns, claudePickTasks, claudeExcludeLast)
}

export function extractCursorStepSummaryItems(messages: TaskMessage[]): StepSummaryRequestItem[] {
  const entries = parseCursorAgentMessages(messages)
  const groups = groupCursorEntries(entries)
  const turns = mergeAssistantTurns(
    groups,
    (g: CursorMessageGroup) => g.type === 'other' && g.entry.type === 'user_message',
  )
  return extractClaudeLike(turns, (items) => items.filter((g): g is CursorTaskGroup => g.type === 'task'), (items) =>
    items.some((g) => g.type === 'other' && isClaudeLikeResultEntry(g.entry)),
  )
}

export function extractGeminiStepSummaryItems(messages: TaskMessage[]): StepSummaryRequestItem[] {
  const entries = parseGeminiMessages(messages)
  const groups = groupGeminiEntries(entries)
  const turns = mergeAssistantTurns(
    groups,
    (g: GeminiMessageGroup) => g.type === 'other' && g.entry.type === 'user_message',
  )
  return extractClaudeLike(turns, (items) => items.filter((g): g is GeminiTaskGroup => g.type === 'task'), (items) =>
    items.some((g) => g.type === 'other' && isClaudeLikeResultEntry(g.entry)),
  )
}

function extractCodex(messages: TaskMessage[]): StepSummaryRequestItem[] {
  const entries = parseCodexMessages(messages)
  const groups = groupCodexEntries(entries)
  const turns = mergeAssistantTurns(
    groups,
    (g: CodexMessageGroup) => g.type === 'other' && g.entry.type === 'user_message',
  )
  const items: StepSummaryRequestItem[] = []
  for (let tIdx = 0; tIdx < turns.length; tIdx += 1) {
    const turn = turns[tIdx]
    if (!turn || turn.kind !== 'assistant') continue
    const allTasks = turn.items.filter((g): g is CodexTaskGroup => g.type === 'task')
    const hasTurnOutcome = turn.items.some((g) => g.type === 'other' && isCodexTurnCompleted(g.entry))
    const tasks = prepareTaskGroupsForStepBar(allTasks, hasTurnOutcome)
    if (tasks.length < ASSISTANT_STEP_BAR_MIN_TASKS) continue
    for (let i = 0; i < tasks.length; i += 1) {
      const g = tasks[i]
      if (!g) continue
      items.push({
        id: `t${tIdx}-s${i}`,
        rawText: taskGroupFullLabel(g, i + 1),
      })
    }
  }
  return items
}

function extractOpencode(messages: TaskMessage[]): StepSummaryRequestItem[] {
  const entries = parseOpencodeMessages(messages)
  const groups = groupOpencodeEntries(entries)
  const turns = mergeAssistantTurns(
    groups,
    (g: OpencodeMessageGroup) => g.type === 'other' && g.entry.type === 'user_message',
  )
  const items: StepSummaryRequestItem[] = []
  for (let tIdx = 0; tIdx < turns.length; tIdx += 1) {
    const turn = turns[tIdx]
    if (!turn || turn.kind !== 'assistant') continue
    const allTasks = turn.items.filter((g): g is OpencodeTaskGroup => g.type === 'task')
    const hasFinalAssistant = turn.items.some(
      (g) => g.type === 'other' && g.entry.type === 'assistant_message',
    )
    const tasks = prepareTaskGroupsForStepBar(allTasks, hasFinalAssistant)
    if (tasks.length < ASSISTANT_STEP_BAR_MIN_TASKS) continue
    for (let i = 0; i < tasks.length; i += 1) {
      const g = tasks[i]
      if (!g) continue
      items.push({
        id: `t${tIdx}-s${i}`,
        rawText: taskGroupFullLabel(g, i + 1),
      })
    }
  }
  return items
}

export function extractStepSummaryItems(agentCliId: string, messages: TaskMessage[]): StepSummaryRequestItem[] {
  const id = agentCliId.trim()
  if (id === 'claude-code') return extractClaudeCodeStepSummaryItems(messages)
  if (id === 'cursor-agent' || id === 'cursor') return extractCursorStepSummaryItems(messages)
  if (id === 'gemini' || id === 'gemini-cli') return extractGeminiStepSummaryItems(messages)
  if (id === 'codex') return extractCodex(messages)
  if (id === 'opencode') return extractOpencode(messages)
  return []
}
