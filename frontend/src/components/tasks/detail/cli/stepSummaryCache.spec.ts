import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StepSummaryRequestItem } from '@/types/api/tasks'
import { STORAGE_KEYS } from '@/types/common/storage'
import {
  buildStepSummaryCacheKey,
  fingerprintHex16,
  readStepSummaryCache,
  removeStepSummaryCacheForTask,
  writeStepSummaryCache,
} from './stepSummaryCache'

describe('stepSummaryCache', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() {
          return storage.size
        },
        key(i: number) {
          return [...storage.keys()][i] ?? null
        },
        getItem(key: string) {
          return storage.get(key) ?? null
        },
        setItem(key: string, value: string) {
          storage.set(key, String(value))
        },
        removeItem(key: string) {
          storage.delete(key)
        },
        clear() {
          storage.clear()
        },
      },
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  const sampleItems = (): StepSummaryRequestItem[] => [
    { id: 't0-s0', rawText: 'a' },
    { id: 't0-s1', rawText: 'b' },
  ]

  it('fingerprintHex16 对相同输入稳定、对 items 顺序不敏感', () => {
    const a = sampleItems()
    const b = [{ id: 't0-s1', rawText: 'b' }, { id: 't0-s0', rawText: 'a' }]
    expect(fingerprintHex16(null, 'claude-code', a)).toBe(fingerprintHex16(null, 'claude-code', b))
    expect(fingerprintHex16(null, 'claude-code', a)).not.toBe(fingerprintHex16(null, 'codex', a))
  })

  it('buildStepSummaryCacheKey 包含 taskId 与稳定 hash', () => {
    const items = sampleItems()
    const k1 = buildStepSummaryCacheKey('task-abc', null, 'claude-code', items)
    const k2 = buildStepSummaryCacheKey('task-abc', null, 'claude-code', items)
    expect(k1).toBe(k2)
    expect(k1.startsWith(`${STORAGE_KEYS.stepSummariesCachePrefix}:`)).toBe(true)
    expect(k1).toContain(encodeURIComponent('task-abc'))
  })

  it('readStepSummaryCache 在 id 全覆盖时返回对象', () => {
    const items = sampleItems()
    const key = buildStepSummaryCacheKey('t1', undefined, 'x', items)
    writeStepSummaryCache(key, { 't0-s0': '一', 't0-s1': '二' })
    expect(readStepSummaryCache(key, ['t0-s0', 't0-s1'])).toEqual({ 't0-s0': '一', 't0-s1': '二' })
  })

  it('readStepSummaryCache 在缺 id 或空串时返回 null', () => {
    const items = sampleItems()
    const key = buildStepSummaryCacheKey('t1', undefined, 'x', items)
    writeStepSummaryCache(key, { 't0-s0': '一' })
    expect(readStepSummaryCache(key, ['t0-s0', 't0-s1'])).toBe(null)
    writeStepSummaryCache(key, { 't0-s0': '一', 't0-s1': '  ' })
    expect(readStepSummaryCache(key, ['t0-s0', 't0-s1'])).toBe(null)
  })

  it('removeStepSummaryCacheForTask 只删该 task 前缀', () => {
    const tid = 'task-del'
    const k1 = buildStepSummaryCacheKey(tid, null, 'a', sampleItems())
    const k2 = buildStepSummaryCacheKey('other', null, 'a', sampleItems())
    writeStepSummaryCache(k1, { 't0-s0': 'x', 't0-s1': 'y' })
    writeStepSummaryCache(k2, { 't0-s0': 'x', 't0-s1': 'y' })
    removeStepSummaryCacheForTask(tid)
    expect(localStorage.getItem(k1)).toBe(null)
    expect(localStorage.getItem(k2)).not.toBe(null)
  })
})
