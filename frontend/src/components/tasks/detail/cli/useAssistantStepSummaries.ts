import { onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import { tasksApi } from '@/api/tasks'
import type { TaskMessage } from '@/types/api/tasks'
import { extractStepSummaryItems } from './stepSummaryExtract'
import {
  buildStepSummaryCacheKey,
  readStepSummaryCache,
  writeStepSummaryCache,
} from './stepSummaryCache'

const DEBOUNCE_MS = 450
const MAX_ITEMS = 40

export function useAssistantStepSummaries(
  taskId: () => string | undefined,
  taskNodeId: () => string | null | undefined,
  agentCliId: () => string,
  messages: () => TaskMessage[],
): { summaryById: Ref<Record<string, string>> } {
  const summaryById = shallowRef<Record<string, string>>({})
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  const run = () => {
    const tidVal = taskId()
    if (!tidVal) {
      summaryById.value = {}
      return
    }

    const items = extractStepSummaryItems(agentCliId(), messages()).slice(0, MAX_ITEMS)
    if (!items.length) {
      summaryById.value = {}
      return
    }

    const cacheKey = buildStepSummaryCacheKey(tidVal, taskNodeId(), agentCliId(), items)
    const requiredIds = items.map((i) => i.id)
    const cached = readStepSummaryCache(cacheKey, requiredIds)
    if (cached) {
      summaryById.value = cached
      return
    }

    const mySeq = ++seq
    void tasksApi
      .stepSummaries(tidVal, {
        items,
        taskNodeId: taskNodeId() ?? undefined,
      })
      .then((res) => {
        if (mySeq !== seq) return
        const next: Record<string, string> = {}
        for (const row of res.items) {
          if (row.id && row.summary?.trim()) {
            next[row.id] = row.summary.trim()
          }
        }
        summaryById.value = next
        if (items.every((i) => next[i.id]?.trim())) {
          writeStepSummaryCache(cacheKey, next)
        }
      })
      .catch(() => {
        if (mySeq !== seq) return
        summaryById.value = {}
      })
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      run()
    }, DEBOUNCE_MS)
  }

  watch(
    () => [taskId(), taskNodeId(), agentCliId(), messages()] as const,
    () => {
      schedule()
    },
    { deep: true, immediate: true },
  )

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  return { summaryById }
}
