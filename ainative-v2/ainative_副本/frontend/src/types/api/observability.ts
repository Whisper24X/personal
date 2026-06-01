export type ObservabilityStatusCount = {
  todo: number
  inProgress: number
  inReview: number
  done: number
}

export type ObservabilityAlert = {
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
}

export type ObservabilityMetrics = {
  generatedAt: string
  totalProjects: number
  totalTasks: number
  statusCounts: ObservabilityStatusCount
  successRate: number
  averageDurationMinutes?: number | null
  queueLength: number
  runningTasks: number
  maxConcurrency: number
  concurrencyUsage: number
  staleRunning: number
  dispatchLagSeconds?: number | null
  workerHeartbeatSkew?: number | null
  alerts: ObservabilityAlert[]
}
