import type { ObservabilityMetrics } from '@/types/api/observability'
import { apiHttp } from './http'

export const observabilityApi = {
  metrics() {
    return apiHttp.get<ObservabilityMetrics>('/observability/metrics')
  },
}
