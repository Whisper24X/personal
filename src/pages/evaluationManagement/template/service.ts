import http from '@/service/axios.interceptor'
import type {
  EvaluationTemplateForm,
  EvaluationTemplateListResponse,
  EvaluationTemplateDetailResponse,
} from './service.type'

/**
 * 获取评价模板列表
 * @param params 查询参数
 */
export const getEvaluationTemplateList = (params: any) =>
  http.post<EvaluationTemplateListResponse>(
    '/api/shadow/v1/evaluation_template/list',
    {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      templateName: params.templateName || undefined,
    },
  )

/**
 * 获取评价模板详情
 * @param id 模板ID
 */
export const getEvaluationTemplateDetail = (id: string | number) =>
  http.get<EvaluationTemplateDetailResponse>(
    '/api/shadow/v1/evaluation_template/info',
    {
      id: String(id),
    },
  )

/**
 * 创建评价模板
 * @param data 模板数据
 */
export const createEvaluationTemplate = (data: EvaluationTemplateForm) =>
  http.post('/api/shadow/v1/evaluation_template/create', data)

/**
 * 更新评价模板
 * @param data 模板数据
 */
export const updateEvaluationTemplate = (data: EvaluationTemplateForm) =>
  http.post('/api/shadow/v1/evaluation_template/update', data)

/**
 * 删除评价模板
 * @param id 模板ID
 */
export const deleteEvaluationTemplate = (id: string | number) =>
  http.post('/api/shadow/v1/evaluation_template/delete', {
    id: String(id),
  })
