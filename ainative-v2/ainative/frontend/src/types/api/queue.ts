export type QueueGlobalStats = {
  maxConcurrency: number
  running: number
  queued: number
  inReview: number
  done: number
  availableSlots: number
  saturationRate: number
  staleRunning: number
  dispatchLagSeconds?: number | null
  workerHeartbeatSkew?: number | null
}

export type ProjectQueueStats = {
  projectId: string
  projectName: string
  maxConcurrency: number
  running: number
  queued: number
  inReview: number
  done: number
}

export type QueueStats = {
  generatedAt: string
  global: QueueGlobalStats
  projects: ProjectQueueStats[]
}
