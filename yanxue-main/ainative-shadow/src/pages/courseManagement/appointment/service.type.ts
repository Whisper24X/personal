/**
 * 预约状态相关
 */
// 状态项类型定义
interface StatusItem {
  label: string
  type: string
}

// 状态映射表类型
interface StatusMap {
  [key: string]: StatusItem
}

// 状态映射表
const STATUS_MAP: StatusMap = {
  success: {
    label: '已预约',
    type: 'success',
  },
  cancel: {
    label: '已取消',
    type: 'info',
  },
  completed: {
    label: '已完成',
    type: 'primary',
  },
}

// 预约状态配置对象
export const STATUS_CONFIG = {
  // 状态值定义
  BOOKED: 'booked',
  CANCEL: 'cancel',
  COMPLETED: 'completed',

  // 状态映射表
  STATUS_MAP,

  // 状态选项列表 - 通过STATUS_MAP自动生成
  OPTIONS: [
    { label: '全部', value: '' },
    ...Object.entries(STATUS_MAP).map(([value, { label }]) => ({
      label,
      value,
    })),
  ],
}

// 导出状态选项，保持向后兼容
export const STATUS_OPTIONS = STATUS_CONFIG.OPTIONS

/**
 * 获取状态标签类型
 * @param status 状态
 * @returns 标签类型
 */
export const getStatusType = (status: string): string => {
  return STATUS_CONFIG.STATUS_MAP[status]?.type || ''
}

/**
 * 获取状态标签文本
 * @param status 状态
 * @returns 标签文本
 */
export const getStatusLabel = (status: string): string => {
  console.log('getStatusLabel', status)
  return STATUS_CONFIG.STATUS_MAP[status]?.label || status
}

/**
 * 课程预约项 - 兼容新旧API响应结构
 */
export interface CourseAppointmentItem {
  /** 预约ID */
  id: string
  /** 订单编号 */
  orderId?: string
  /** 课程名称 */
  courseName?: string
  /** 商品ID */
  goodId?: string
  /** 商品名称 */
  goodName?: string
  /** 课程ID */
  courseId?: string
  /** 课程时间 */
  period: string
  /** 课程日期 格式：2025-01-01 */
  date: string
  /** 孩子姓名（旧API） */
  childName?: string
  /** 孩子姓名（新API） */
  studentName?: string
  /** 身份证号（旧API） */
  idNumber?: string
  /** 身份证号（新API） */
  studentIdentityCard?: string
  /** 性别（旧API） */
  gender?: string
  /** 性别（新API） */
  studentSex?: string
  /** 年龄（旧API） */
  age?: number
  /** 年龄（新API） */
  studentAge?: string
  /** 家长姓名 */
  parentName: string
  /** 家长手机号 */
  parentPhone: string
  /** 家长是否同行 */
  parentAccompany: boolean | string
  /** 核销券码 */
  verificationCode?: string
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
  /** 最后编辑人 */
  updatedByName?: string
  /** 最后编辑人ID */
  updatedBy?: string
  /** 状态 */
  status: string
  /** 合同状态 pending-未推送, pushed-已推送 */
  contractStatus?: string
  businessRemark?: string // 新增业务备注字段
  receiptAmount?: number // 实收金额字段，后端单位为分，前端转换为元显示
  /** 是否需要推送合同 */
  isPushContractRequired: boolean
}

/**
 * 课程预约查询相关
 */
// 课程预约查询参数
export interface CourseAppointmentQueryParams {
  /** 课程ID */
  courseId?: string
  /** 课程日期范围 */
  courseDateRange?: [string, string] | null
  /** 状态 */
  status?: string
  /** 合同状态 */
  contractStatus?: string
  /** 孩子姓名 */
  childName?: string
  /** 家长姓名 */
  parentName?: string
  /** 家长手机号 */
  parentPhone?: string
  /** 课程时间段 */
  period?: string
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

// 课程预约列表查询参数
export interface CourseAppointmentListParams {
  /** 课程ID */
  courseId?: string
  /** 开始日期 */
  startDate?: string
  /** 结束日期 */
  endDate?: string
  /** 状态 */
  status?: string
  /** 合同状态 */
  contractStatus?: string
  /** 孩子姓名 */
  childName?: string
  /** 家长姓名 */
  parentName?: string
  /** 家长手机号 */
  parentPhone?: string
  /** 课程时间段 */
  period?: string
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

// 课程预约查询返回数据
export interface CourseAppointmentListResponse {
  /** 总数 */
  total: number
  /** 记录列表 */
  list: CourseAppointmentItem[]
}

// 课程预约列表查询结果
export interface CourseAppointmentListResult {
  /** 总数 */
  total: number
  /** 记录列表 */
  list: CourseAppointmentItem[]
}

/**
 * 课程选择器相关
 */
// 课程选择器返回数据
export interface CourseSelectorResponse {
  /** 课程列表 */
  list: CourseSelectorItem[]
}

// 课程选择器项
export interface CourseSelectorItem {
  /** 课程ID */
  id: string
  /** 课程名称 */
  courseName: string
  /** 是否需要推送合同 */
  isPushContractRequired?: boolean
}

/**
 * 课程库存相关
 */
// 课程预约库存信息
export interface CourseStockItem {
  /** 日期 */
  date: string
  /** 时间段 */
  period: string
  /** 总库存 */
  stock: number
  /** 剩余库存 */
  stockRemain: number
}

// 课程预约库存选择器响应
export interface CourseStockSelectorResponse {
  items: CourseStockItem[]
}

/**
 * 课程时间段相关
 */
// 课程时间段响应
export interface CourseTimePeriodsResponse {
  periods: string[]
}

// 课程时间段
export interface CourseTimePeriod {
  value: string
  label: string
}

/**
 * 预约操作相关
 */
// 预约详情响应
export interface CourseAppointmentDetailResponse {
  info: CourseAppointmentItem
}

// 创建课程预约参数
export interface CreateCourseAppointmentParams {
  /** 订单ID */
  orderId: string
  /** 课程分类ID */
  categoryId?: string
  /** 课程ID */
  courseId: string
  /** 课程日期 */
  date: string
  /** 课程时间段 */
  period: string
  /** 学生姓名 */
  studentName: string
  /** 学生身份证号 */
  studentIdentityCard: string
  /** 学生性别 */
  studentSex: string
  /** 学生年龄 */
  studentAge: number
  /** 家长姓名 */
  parentName: string
  /** 家长手机号 */
  parentPhone: string
  /** 家长是否同行 */
  parentAccompany: string
}

// 更新课程预约状态参数
export interface UpdateCourseAppointmentStatusParams {
  /** 预约ID */
  id: string
  /** 状态 */
  status: string
}

/**
 * 合同相关
 */
// 合同状态选项
export const CONTRACT_STATUS_OPTIONS = [
  { label: '未推送', value: 'pending' },
  { label: '已推送', value: 'pushed' },
]

/**
 * 获取合同状态标签类型
 * @param status 状态
 * @returns 标签类型
 */
export const getContractStatusType = (status: string | undefined): string => {
  if (status === 'pushed') {
    return 'success'
  }
  return 'info'
}

/**
 * 获取合同状态标签文本
 * @param status 状态
 * @returns 标签文本
 */
export const getContractStatusLabel = (status: string | undefined): string => {
  if (status === 'pushed') {
    return '已推送'
  }
  return '未推送'
}

/**
 * 合同字段信息响应
 */
export interface ContractFieldInfoResponse {
  /**
   * 活动结束日期
   */
  activityEndDate?: string
  /**
   * 活动开始日期
   */
  activityStartDate?: string
  /**
   * 孩子身份证号
   */
  childId?: string
  /**
   * 孩子姓名
   */
  childName?: string
  /**
   * 活动费用
   */
  cost?: string
  /**
   * 活动费用大写
   */
  costCapital?: string
  /**
   * 家长姓名
   */
  parentName?: string
  /**
   * 家长手机号
   */
  parentPhone?: string
  /**
   * 付款截止日期
   */
  payEndDate?: string
  /**
   * 其他属性
   */
  [property: string]: any
}

/**
 * 推送合同响应
 */
export interface PushContractResponse {
  /**
   * 异步任务ID
   */
  asyncTaskId: string
}

/**
 * 异步任务结果
 */
export interface AsyncTaskResult {
  /**
   * 错误信息
   */
  errorInfo?: string
  /**
   * 状态：0-待处理 1-执行中 2-成功 3-失败
   */
  status?: number
  /**
   * 任务ID
   */
  taskId?: string
}

/**
 * 订单相关类型定义
 */
// 订单项
export interface OrderItem {
  /** 订单ID */
  id: string
  /** 订单编号 */
  orderNumber: string
  /** 商品名称 */
  goodName: string
  /** 商品ID */
  goodId: string
  /** 渠道ID */
  channelId: string
  /** 渠道名称 */
  channelName: string
  /** 渠道商品ID */
  channelGoodId: string
  /** 订单金额 */
  orderPrice: number
  /** 手机号 */
  phone: string
  /** 支付时间 */
  paymentTime: string
  /** 订单状态 */
  status: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 更新人ID */
  updatedBy: string
  /** 更新人名称 */
  updatedByName: string
}

// 通过手机号查询订单响应
export interface OrdersByPhoneResponse {
  /** 订单列表 */
  list: OrderItem[]
}

/**
 * 课程相关类型定义
 */
// 可用课程项
export interface AvailableCourseItem {
  /** 课程ID */
  id: string
  /** 课程名称 */
  courseName: string
  /** 课程类型 */
  courseType: string
  /** 课程描述 */
  description: string
  /** 可用库存 */
  availableStock: number
}

/**
 * 通过订单ID查询课程接口
 */
// 课程信息
export interface CourseItem {
  /** 课程ID */
  courseId: string
  /** 课程名称 */
  courseName: string
  /** 课程价格 */
  coursePrice: string
  /** 是否可预约 */
  isAppointment: boolean
}

// 课程分类信息
export interface CategoryItem {
  /** 分类ID */
  categoryId: string
  /** 分类名称 */
  categoryName: string
  /** 使用次数 */
  useTimes: number
  /** 已预约使用次数 */
  alreadyAppointmentUseTimes?: number
  /** 课程列表 */
  courses: CourseItem[]
}

// 商品信息
export interface GoodInfo {
  /** ID */
  id: string
  /** 名称 */
  name: string
  /** 主图 */
  mainImage: string[]
  /** 详情图 */
  detailImages: string[]
  /** 价格 */
  price: number // 商品价格，后端单位为分，前端转换为元显示
  /** 内容 */
  content: {
    /** 商品分类 */
    goodCategories: CategoryItem[]
  }
  /** 销量 */
  sales: number
  /** 状态 */
  status: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 渠道 */
  channel: string
  /** 渠道ID */
  channelId: string
  /** 渠道商品ID */
  channelGoodId: string
  /** 平台商品ID */
  platformGoodId: string
  /** 更新人ID */
  updatedBy: string
  /** 更新人名称 */
  updatedByName: string
  /** 商品类型：单日营 single，多日营 multi */
  goodType?: string
}

// 渠道信息
export interface ChannelInfo {
  /** ID */
  id: string
  /** 名称 */
  name: string
  /** 核销码类型 */
  verificationCodeType: string
}

// 通过订单ID查询可用课程响应
export interface CoursesByOrderIdResponse {
  /** 订单信息 */
  orderInfo: OrderItem
  /** 商品信息 */
  goodInfo: GoodInfo
  /** 渠道信息 */
  channelInfo: ChannelInfo
}
