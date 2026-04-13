const STORAGE_PREFIX = 'ainative.goalGeneration.'

export type GoalGenerationPending = {
  prd?: boolean
  plan?: boolean
  startedAt?: number
  /** 点击「生成 PRD」时的 prdDocPath（空串表示当时无 PRD） */
  prdPathBaseline?: string
  /** 点击「生成任务计划」时的 planDocPath */
  planPathBaseline?: string
  /** 点击「生成任务计划」时扁平子任务数量 */
  planSubTaskBaselineCount?: number
}

export function normalizeGoalGenerationKey(goalId: string): string {
  return goalId.trim().toLowerCase()
}

function storageKey(goalId: string): string {
  return `${STORAGE_PREFIX}${normalizeGoalGenerationKey(goalId)}`
}

/** 整对象读写，避免丢字段 */
function readFull(key: string): GoalGenerationPending | null {
  const raw = readRaw(key)
  if (!raw?.trim()) {
    return null
  }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    if (o.prd !== true && o.plan !== true) {
      return null
    }
    return o as GoalGenerationPending
  } catch {
    return null
  }
}

function readRaw(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    const fromLocal = localStorage.getItem(key)
    if (fromLocal?.trim()) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(key, fromLocal)
        }
      } catch {
        /* ignore */
      }
      return fromLocal
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    const fromSession = sessionStorage.getItem(key)
    if (fromSession?.trim()) {
      try {
        localStorage?.setItem(key, fromSession)
      } catch {
        /* ignore */
      }
      return fromSession
    }
  }
  return null
}

function writeRaw(key: string, json: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, json)
    }
  } catch {
    /* ignore quota */
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, json)
    }
  } catch {
    /* ignore quota */
  }
}

function removeRaw(key: string): void {
  try {
    sessionStorage?.removeItem(key)
  } catch {
    /* ignore */
  }
  try {
    localStorage?.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function readGoalGenerationPending(goalId: string): GoalGenerationPending | null {
  if (!goalId.trim()) {
    return null
  }
  return readFull(storageKey(goalId))
}

export function setGoalGenerationPrdPending(
  goalId: string,
  pending: boolean,
  opts?: { prdPathBaseline?: string },
): void {
  if (!goalId.trim()) {
    return
  }
  const key = storageKey(goalId)
  const prev = readFull(key) ?? {}
  if (!pending) {
    delete prev.prd
    delete prev.prdPathBaseline
    if (!prev.plan) {
      removeRaw(key)
      return
    }
    writeRaw(key, JSON.stringify(prev))
    return
  }
  prev.prd = true
  prev.startedAt = prev.startedAt ?? Date.now()
  if (opts && 'prdPathBaseline' in opts) {
    prev.prdPathBaseline = opts.prdPathBaseline ?? ''
  } else if (prev.prdPathBaseline === undefined) {
    prev.prdPathBaseline = ''
  }
  writeRaw(key, JSON.stringify(prev))
}

export function setGoalGenerationPlanPending(
  goalId: string,
  pending: boolean,
  opts?: { planPathBaseline?: string; planSubTaskBaselineCount?: number },
): void {
  if (!goalId.trim()) {
    return
  }
  const key = storageKey(goalId)
  const prev = readFull(key) ?? {}
  if (!pending) {
    delete prev.plan
    delete prev.planPathBaseline
    delete prev.planSubTaskBaselineCount
    if (!prev.prd) {
      removeRaw(key)
      return
    }
    writeRaw(key, JSON.stringify(prev))
    return
  }
  prev.plan = true
  prev.startedAt = prev.startedAt ?? Date.now()
  if (opts) {
    if ('planPathBaseline' in opts) {
      prev.planPathBaseline = opts.planPathBaseline ?? ''
    } else if (prev.planPathBaseline === undefined) {
      prev.planPathBaseline = ''
    }
    if (typeof opts.planSubTaskBaselineCount === 'number') {
      prev.planSubTaskBaselineCount = opts.planSubTaskBaselineCount
    } else if (prev.planSubTaskBaselineCount === undefined) {
      prev.planSubTaskBaselineCount = 0
    }
  } else {
    if (prev.planPathBaseline === undefined) {
      prev.planPathBaseline = ''
    }
    if (prev.planSubTaskBaselineCount === undefined) {
      prev.planSubTaskBaselineCount = 0
    }
  }
  writeRaw(key, JSON.stringify(prev))
}

/**
 * 在 GET 详情后根据「生成前快照」判断是否已落库，再移除 pending。
 *
 * 禁止使用 goal.updatedAt：接口常在每次 GET 时刷新该字段，会与客户端 startedAt 比较误判「已完成」，
 * 进而在刷新页面后立刻删掉 localStorage 整键。
 *
 * 无快照字段的旧数据：不在此函数自动清除（依赖同页 POST 的 finally 或轮询超时）。
 */
function normDocPath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/^\/+/, '')
}

export function clearGoalGenerationPendingIfSatisfied(options: {
  goalId: string
  /** 用于避免「仍为 draft 时误判 PRD 已落库」；首次生成过程中 status 保持 draft，不应仅凭路径清 pending */
  goalStatus?: string
  currentPrdPath: string
  currentPlanPath: string
  currentPlanSubTaskCount: number
  prdClientRequestInFlight: boolean
  planClientRequestInFlight: boolean
}): void {
  const {
    goalId,
    goalStatus,
    currentPrdPath,
    currentPlanPath,
    currentPlanSubTaskCount,
    prdClientRequestInFlight,
    planClientRequestInFlight,
  } = options
  if (!goalId.trim()) {
    return
  }
  const key = storageKey(goalId)
  const prev = readFull(key)
  if (!prev) {
    return
  }

  const curPrd = currentPrdPath.trim()
  const curPlan = currentPlanPath.trim()

  if (prev.prd === true && !prdClientRequestInFlight) {
    if (prev.prdPathBaseline === undefined) {
      /* 旧数据：不根据 GET 自动清，避免误删 */
    } else {
      const base = prev.prdPathBaseline ?? ''
      const firstPrdAppeared =
        base === '' &&
        curPrd.length > 0 &&
        (goalStatus === undefined || goalStatus !== 'draft')
      const prdPathChanged =
        base !== '' &&
        curPrd !== '' &&
        normDocPath(base) !== normDocPath(curPrd)
      if (firstPrdAppeared || prdPathChanged) {
        delete prev.prd
        delete prev.prdPathBaseline
      }
    }
  }

  if (prev.plan === true && !planClientRequestInFlight) {
    if (prev.planPathBaseline === undefined && prev.planSubTaskBaselineCount === undefined) {
      /* 旧数据：不根据 GET 自动清 */
    } else {
      const basePath = prev.planPathBaseline ?? ''
      const baseCount = prev.planSubTaskBaselineCount ?? -1
      const firstPlanAppeared =
        basePath === '' &&
        curPlan.length > 0 &&
        currentPlanSubTaskCount > 0 &&
        (goalStatus === undefined || goalStatus === 'planned' || goalStatus === 'in_progress' || goalStatus === 'done' || goalStatus === 'archived')
      const planPathChanged =
        basePath !== '' &&
        curPlan !== '' &&
        normDocPath(basePath) !== normDocPath(curPlan)
      const subTasksGrew =
        baseCount >= 0 && currentPlanSubTaskCount > baseCount
      if (firstPlanAppeared || planPathChanged || subTasksGrew) {
        delete prev.plan
        delete prev.planPathBaseline
        delete prev.planSubTaskBaselineCount
      }
    }
  }

  if (!prev.prd && !prev.plan) {
    removeRaw(key)
    return
  }
  writeRaw(key, JSON.stringify(prev))
}
