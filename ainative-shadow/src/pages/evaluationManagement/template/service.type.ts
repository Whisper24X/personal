/**
 * 评价模板项目接口
 * @interface EvaluationTemplateItem
 */
export interface EvaluationTemplateItem {
  /** 模板ID */
  id: string | number
  /** 模板名称 */
  templateName: string
  /** 所属业务 */
  business: string
  /** 评价对象 */
  evaluationObject: string
  /** 评价维度 */
  evaluationDimension: string[]
  /** 评价标签 */
  evaluationLabel: string[]
  /** 温馨提示 */
  tips: string
  /** 创建人 */
  updatedByName: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 评价模板表单接口
 * @interface EvaluationTemplateForm
 */
export interface EvaluationTemplateForm {
  /** 模板ID，新增时为空 */
  id?: string | number
  /** 模板名称 */
  templateName: string
  /** 所属业务 */
  business: string
  /** 评价对象 */
  evaluationObject: string
  /** 评价维度 */
  evaluationDimension: string[]
  /** 评价标签 */
  evaluationLabel: string[]
  /** 温馨提示 */
  tips: string
  /** 是否为编辑模式 */
  isEdit?: boolean
}

/**
 * 评价模板列表响应
 */
export interface EvaluationTemplateListResponse {
  list: EvaluationTemplateItem[]
  total: number
}

/**
 * 评价模板详情响应
 */
export interface EvaluationTemplateDetailResponse {
  info: EvaluationTemplateItem
}

/**
 * 业务类型选项
 */
export const BUSINESS_TYPE_OPTIONS = [
  { label: '研学', value: 'research' },
  { label: '自习室', value: 'studyRoom' },
  { label: '课程', value: 'course' },
]

/**
 * 获取业务类型标签
 * @param value 业务类型值
 * @returns 业务类型标签
 */
export const getBusinessTypeLabel = (value: string): string => {
  const option = BUSINESS_TYPE_OPTIONS.find((item) => item.value === value)
  return option ? option.label : value
}

/**
 * 获取业务类型值
 * @param label 业务类型标签
 * @returns 业务类型值
 */
export const getBusinessTypeValue = (label: string): string => {
  const option = BUSINESS_TYPE_OPTIONS.find((item) => item.label === label)
  return option ? option.value : ''
}
