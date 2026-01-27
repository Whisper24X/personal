import http from '@/service/axios.interceptor'
import type {
  EvaluationListRequest,
  EvaluationListResponse,
  ExportEvaluationListRequest,
  ExportEvaluationListResponse,
} from './service.type'

export const getEvaluationList = (params: EvaluationListRequest) =>
  http.post<EvaluationListResponse>('/api/shadow/v1/evaluation/list', params)

export const exportEvaluationList = (params: ExportEvaluationListRequest) =>
  http.post<ExportEvaluationListResponse>(
    '/api/shadow/v1/evaluation/export',
    params,
  )
