// 订单状态枚举
export enum OrderStatus {
  /** 待付款 */
  PENDING_PAYMENT = "pendingPayment",
  /** 待预约 */
  PENDING = "pending",
  /** 已预约 */
  SUCCESS = "success",
  /** 已完成 */
  COMPLETED = "completed",
  /** 退款中 */
  REFUNDING = "refunding",
  /** 退款失败 */
  FAILEDREFUND = "failedRefund",
  /** 已退款 */
  REFUNDED = "refunded",
  /** 交易关闭 */
  CLOSED = "closed"
}

// 订单信息接口
export interface OrderInfo {
  id: string
  orderNo: string
  orderPrice: number
  status: OrderStatus
  createTime: string
  updateTime: string
}

// 商品信息接口
export interface GoodInfo {
  id: string
  name: string
  mainImage: string[]
  detailImages: string[]
  appointmentRules?: string
  content?: {
    goodCategories?: GoodCategory[]
  }
}

// 商品分类接口
export interface GoodCategory {
  id: string
  name: string
  useTimes: number
  courses: Course[]
}

// 课程接口
export interface Course {
  id: string
  name: string
  price: number
  categoryId: string
  isAppointment?: boolean
}

// 课程分类接口（用于页面显示）
export interface CourseCategory {
  id: string
  name: string
  courses: Course[]
}

// 渠道信息接口
export interface ChannelInfo {
  id: string
  name: string
  verificationCodeType: "none" | "image" | "text"
}

// 订单详情响应接口
export interface OrderDetailResponse {
  orderInfo: OrderInfo
  goodInfo: GoodInfo
  channelInfo: ChannelInfo
}

// 预约信息接口
export interface AppointmentInfo {
  id: string
  orderId: string
  categoryId: string
  courseId: string
  date: string
  period: string
  studentName: string
  studentIdentityCard: string
  studentSex: string
  studentAge: number
  parentName: string
  parentPhone: string
  parentAccompany: string
  verificationCode?: string
  parentRemark?: string
  createTime: string
  updateTime: string
}

// 课程库存信息接口
export interface CourseStockInfo {
  date: string
  stockRemain: number
}

// 时间段接口
export interface TimeSlot {
  period: string
  stock: number
  stockRemain: number
  available?: boolean
}

// 课程库存选择器响应接口
export interface CourseStockSelectorResponse {
  availableDates: CourseStockInfo[]
  timeSlots: TimeSlot[]
  items: any[]
}

// 预约创建请求接口
export interface CreateAppointmentRequest {
  orderId: string
  categoryId: string
  courseId: string
  date: string
  period: string
  studentName: string
  studentIdentityCard: string
  studentSex: string
  studentAge: number
  parentName: string
  parentPhone: string
  parentAccompany: string
  verificationCode?: string
  parentRemark?: string
}

// 预约更新请求接口
export interface UpdateAppointmentRequest extends CreateAppointmentRequest {
  id: string
}
