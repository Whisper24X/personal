import type { StepSummaryRequestItem } from '@/types/api/tasks'
import { STORAGE_KEYS } from '@/types/common/storage'

const PREFIX = STORAGE_KEYS.stepSummariesCachePrefix

function fnv1a32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 16 hex chars，用于缓存 key 后缀 */
export function fingerprintHex16(
  taskNodeId: string | null | undefined,
  agentCliId: string,
  items: StepSummaryRequestItem[],
): string {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id))
  const payload = JSON.stringify({
    taskNodeId: taskNodeId ?? '',
    agentCliId,
    items: sorted,
  })
  const h1 = fnv1a32(payload)
  const h2 = fnv1a32(`${payload}\u0000`)
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

export function buildStepSummaryCacheKey(
  taskId: string,
  taskNodeId: string | null | undefined,
  agentCliId: string,
  items: StepSummaryRequestItem[],
): string {
  const fp = fingerprintHex16(taskNodeId, agentCliId, items)
  return `${PREFIX}:${encodeURIComponent(taskId)}:${fp}`
}

export function readStepSummaryCache(
  key: string,
  requiredIds: string[],
): Record<string, string> | null {
  if (requiredIds.length === 0) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const rec = parsed as Record<string, string>
    for (const id of requiredIds) {
      const v = rec[id]
      if (typeof v !== 'string' || !v.trim()) return null
    }
    return rec
  } catch {
    return null
  }
}

export function writeStepSummaryCache(key: string, data: Record<string, string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // QuotaExceededError 等：跳过写入，不影响功能
  }
}

/** 删除某任务下所有步骤摘要缓存条目 */
export function removeStepSummaryCacheForTask(taskId: string): void {
  const prefix = `${PREFIX}:${encodeURIComponent(taskId)}:`
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      localStorage.removeItem(key)
    }
  }
}
