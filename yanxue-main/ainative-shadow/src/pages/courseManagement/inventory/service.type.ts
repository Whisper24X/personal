/**
 * 课程库存查询参数
 */
export interface CourseInventoryQueryParams {
  /** 课程ID */
  courseId?: string
  /** 课程日期范围 */
  courseDateRange?: [string, string] | null
  /** 状态 putOff-下架，putOn-上架 */
  status?: string
  /** 课程类型：单日营：single;多日营：multi */
  courseType?: string
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

/**
 * 课程库存项 - 严格按照API响应结构
 */
export interface CourseInventoryItem {
  /** 库存ID */
  id: string
  /** 课程ID */
  courseId: string
  /** 课程名称 */
  courseName: string
  /** 课程日期 格式：2025-01-01 */
  date: string
  /** 课程时间 格式：10:00-12:00 */
  period: string
  /** 库存数量 */
  stock: number
  /** 库存剩余 */
  stockRemain: number
  /** 预约人数量 */
  stockSuccess: number
  /** 状态 上架putOn 下架putOff */
  status: string
  /** 群聊二维码 */
  groupQrCode?: string
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
 * 课程库存查询返回数据 - 严格按照API响应结构
 */
export interface CourseInventoryListResponse {
  /** 总数 */
  total: number
  /** 记录列表 */
  list: CourseInventoryItem[]
}

/**
 * 库存状态枚举
 */
export enum InventoryStatus {
  /** 充足 */
  SUFFICIENT = 0,
  /** 紧张 */
  LOW = 1,
  /** 售罄 */
  SOLD_OUT = 2,
}

/**
 * 库存状态选项
 */
export const INVENTORY_STATUS_OPTIONS = [
  { label: '全部', value: -1 },
  { label: '充足', value: InventoryStatus.SUFFICIENT },
  { label: '紧张', value: InventoryStatus.LOW },
  { label: '售罄', value: InventoryStatus.SOLD_OUT },
]

/**
 * 库存表状态枚举
 */
export enum StockStatus {
  /** 下架 */
  DISABLED = 0,
  /** 上架 */
  ENABLED = 1,
}

/**
 * 库存表状态选项
 */
export const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '已下架', value: 'putOff' },
  { label: '已上架', value: 'putOn' },
]

/**
 * 课程选择器返回数据
 */
export interface CourseSelectorResponse {
  /** 课程列表 */
  list: CourseSelectorItem[]
}

/**
 * 课程选择器项
 */
export interface CourseSelectorItem {
  /** 课程ID */
  id: string
  /** 课程名称 */
  courseName: string
  /** 课程类型 */
  courseType: 'single' | 'multi'
}

/**
 * 课程库存信息
 */
export interface CourseStockInfo {
  id: string
  courseId: string
  date: string
  period: string
  stock: number
  reservedCount: number
  status: number
}

/**
 * 课程库存信息响应
 */
export interface CourseStockInfoResponse {
  info: CourseStockInfo
}

/**
 * 课程类型枚举
 */
export enum CourseType {
  /** 单日营 */
  SINGLE = 'single',
  /** 多日营 */
  MULTI = 'multi',
}

/**
 * 课程类型选项
 */
export const COURSE_TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '单日营', value: CourseType.SINGLE },
  { label: '多日营', value: CourseType.MULTI },
]

/**
 * 课程库存选择器项
 */
export interface CourseStockSelectorItem {
  /** 日期 格式：2025-01-01 */
  date: string
  /** 时间段 格式：10:00-12:00 */
  period: string
  /** 库存 */
  stock: number
  /** 剩余库存 */
  stockRemain: number
}

/**
 * 课程库存选择器响应
 */
export interface CourseStockSelectorResponse {
  /** 日期和时间段 */
  items: CourseStockSelectorItem[]
}

/**
 * 更新群聊二维码请求参数
 */
export interface UpdateGroupQrCodeParams {
  /** id */
  id: string
  /** 二维码 */
  groupQrCode: string
}
