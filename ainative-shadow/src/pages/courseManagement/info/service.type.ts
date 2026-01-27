/**
 * 课程列表查询参数
 */
export interface CourseListQuery {
  /** 页码 */
  page?: number
  /** 每页条数 */
  pageSize?: number
  /** 课程名称 */
  courseName?: string
  /** 课程状态 */
  status?: string
  /** 课程类型 */
  courseType?: string
}

/**
 * 课程信息项
 */
export interface CourseInfo {
  /** ID */
  id: string
  /** 课程名称 */
  courseName: string
  /** 课程类型 */
  courseType: 'single' | 'multi'
  /** 主图(多张) */
  mainImage: string[]
  /** 详情图(多张) */
  detailImages: string[]
  /** 价格(单位:分) */
  price: number
  /** 是否需要推送合同 */
  isPushContractRequired: boolean
  /** 状态 */
  status: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 更新人 */
  updatedBy: string
  /** 更新人名称 */
  updatedByName: string
}

/**
 * 课程列表响应
 */
export interface CourseListResponse {
  /** 记录列表 */
  list: CourseInfo[]
  /** 总数 */
  total: number
}

/**
 * 课程状态枚举
 */
export enum CourseStatus {
  /** 下架 */
  OFFLINE = 'putOff',
  /** 上架 */
  ONLINE = 'putOn',
}

/**
 * 课程状态选项
 */
export const COURSE_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '上架', value: CourseStatus.ONLINE },
  { label: '下架', value: CourseStatus.OFFLINE },
]

/**
 * 课程类型选项
 */
export const COURSE_TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '单日', value: 'single' },
  { label: '多日', value: 'multi' },
]

/**
 * 课程类型创建选项
 */
export const COURSE_TYPE_CREATE_OPTIONS = [
  { label: '单日', value: 'single' },
  { label: '多日', value: 'multi' },
]

/**
 * 创建课程请求
 */
export interface CreateCourseRequest {
  /** 课程名称 */
  courseName: string
  /** 课程类型 */
  courseType: 'single' | 'multi'
  /** 主图(多张) */
  mainImage: string[]
  /** 详情图(多张) */
  detailImages: string[]
  /** 价格(单位:分) */
  price: number
  /** 是否需要推送合同 */
  isPushContractRequired: boolean
}

/**
 * 创建课程响应
 */
export interface CreateCourseResponse {
  /** 课程ID */
  id: string
}

/**
 * 更新课程请求
 */
export interface UpdateCourseRequest {
  /** 课程ID */
  id: string
  /** 课程名称 */
  courseName: string
  /** 主图(多张) */
  mainImage: string[]
  /** 详情图(多张) */
  detailImages: string[]
  /** 价格(单位:分) */
  price: number
  /** 是否需要推送合同 */
  isPushContractRequired: boolean
}

/**
 * 更新课程响应
 */
export interface UpdateCourseResponse {}

/**
 * 删除课程请求
 */
export interface DeleteCourseRequest {
  /** 课程ID集合 */
  ids: string[]
}

/**
 * 删除课程响应
 */
export interface DeleteCourseResponse {}

/**
 * 更新课程状态请求
 */
export interface UpdateCourseStatusRequest {
  /** 课程ID */
  id: string
  /** 课程状态 上架putOn 下架putOff */
  status: string
}

/**
 * 更新课程状态响应
 */
export interface UpdateCourseStatusResponse {}

/**
 * 课程详情响应
 */
export interface GetCourseInfoResponse {
  /** 课程信息 */
  info: CourseInfo
}
