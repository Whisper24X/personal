import { post, get } from "./request"

// 评价相关接口类型定义
export interface CreateEvaluationRequest {
  appointmentId?: string
  childName?: string
  courseName?: string
  courseTime?: string
  dimensionScore?: string[]
  evaluationLabel?: string[]
  feedBack?: string
  feedBackImage?: string[]
  parentName?: string
  phone?: string
  totalScore?: number
}

export interface CreateEvaluationResponse {
  id: string
}

export interface EvaluationTemplateInfo {
  business?: string
  evaluationDimension?: string[]
  evaluationLabel?: string[]
  evaluationObject?: string
  id?: string
  templateName?: string
  tips?: string
}

export interface EvaluationTemplateResponse {
  info?: EvaluationTemplateInfo
}

/**
 * 创建评价
 */
export const createEvaluation = (data: CreateEvaluationRequest) => {
  return post<CreateEvaluationResponse>("/yanxue/wechat/v1/evaluation/create", data)
}

/**
 * 获取评价模板
 */
export const getEvaluationTemplate = (templateName: string) => {
  return get<EvaluationTemplateResponse>("/yanxue/wechat/v1/evaluation_template/info", {
    templateName
  })
}
