import type { QueueStats } from '@/types/api/queue'
import { apiHttp } from './http'

export const queueApi = {
  stats() {
    return apiHttp.get<QueueStats>('/queue/stats')
  },
}
