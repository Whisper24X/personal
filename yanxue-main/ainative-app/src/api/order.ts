import { get, post } from "./request"
/**
 * 订单状态枚举（订单支付状态）
 */
export enum OrderStatus {
  /** 待支付 */
  PENDING_PAYMENT = "pendingPayment",
  /** 支付成功 */
  PENDING = "pending",
  /** 订单关闭 */
  CLOSED = "closed",
  /** 已退款 */
  REFUNDED = "refunded",
  /** 退款中 */
  REFUNDING = "refunding",
  /** 退款失败 */
  FAILED_REFUND = "failedRefund"
}

/**
 * 服务状态枚举
 */
export enum ServiceStatus {
  /** 待预约 */
  PENDING = "pending",
  /** 已预约 */
  SUCCESS = "success",
  /** 已出行 */
  COMPLETED = "completed"
}

// 订单相关接口类型定义
export interface OrderInfo {
  id: string
  orderNumber: string
  goodId: string
  goodName: string
  goodType: string // single:单日营 multi:多日营
  channelId: string
  channelName: string
  orderPrice: number // 订单价格(单位:分)
  phone: string
  paymentTime: string
  status: string // 订单状态：pendingPayment待支付 pending支付成功 closed订单关闭 refunded已退款 refunding退款中 failedRefund退款失败
  serviceStatus?: string // 服务状态：pending待预约 success已预约 completed已出行
  discountAmount?: number // 优惠金额(单位:分)
  parentRemark?: string
  payId?: string
  refundId?: string
  refundReason?: string
  refundAmount?: number // 退款金额(单位:分)
  refundTime?: string
  userCouponId?: string
  paymentDeadline?: string
  createdAt: string
  updatedAt: string
}

// 商品类别
export interface GoodCategory {
  categoryId: string
  categoryName: string
  useTimes: number
  courses: CourseItem[]
}

// 课程项
export interface CourseItem {
  courseId: string
  courseName: string
  coursePrice: string
  isAppointment: boolean
}

// 商品内容
export interface GoodContent {
  goodCategories: GoodCategory[]
}

export interface GoodInfo {
  id: string
  name: string
  mainImage: string[] // 主图(多张)
  detailImages: string[] // 详情图(多张)
  price: number // 商品价格(单位:分)
  content: GoodContent
  status: string // putOff下架 putOn上架 pending待上架 delete删除
  createdAt: string
  updatedAt: string
  appointmentRules: string // 预约规则
  channelId: string
  channelGoodId: string
  platformGoodId: string
}

export interface ChannelInfo {
  id: string
  name: string
  verificationCodeType: string // none:无卷码 required:必须 optional:可有可无
}

/**
 * 获取用户订单列表
 */
export const getOrderList = (params: {
  page: number
  pageSize: number
  status?: string[] // 订单状态：pendingPayment待支付 pending支付成功 closed订单关闭 refunded已退款 refunding退款中 failedRefund退款失败
  serviceStatus?: string[] // 服务状态：pending待预约 success已预约 completed已出行
}) => {
  return post<{
    total: number
    orderList: OrderInfo[]
  }>("/yanxue/wechat/v1/order/list", params)
}

/**
 * 获取订单商品详情
 */
export const getOrderGoodInfo = (id: string) => {
  return post<{
    orderInfo: OrderInfo
    goodInfo: GoodInfo
    channelInfo: ChannelInfo
    courseAppointmentDraft?: any
  }>("/yanxue/wechat/v1/order/good/info", { id })
}

/**
 * 创建订单
 */
export const createOrder = (data: {
  goodId: string
  date: string
  period: string
  studentName: string
  studentIdentityCard: string
  studentSex: string
  studentAge: number
  parentName: string
  parentPhone: string
  parentSex: string
}) => {
  return post<{
    orderId: string
    orderNumber: string
  }>("/yanxue/wechat/v1/order/create", data)
}

/**
 * 创建无预约订单
 */
export const createOrderWithoutAppointment = (data: {
  goodId: string
  quantity?: number
  remark?: string
}) => {
  return post<{
    orderId: string
    orderNumber: string
  }>("/yanxue/wechat/v1/order/create-no-appointment", data)
}

/**
 * 创建小程序订单
 */
export const createMiniProgramOrder = (data: {
  goodId: string
  goodNums?: number
  parentRemark?: string
  userCouponId?: string
  courseAppointmentDraft?: any
}) => {
  return post<{
    orderId: string
  }>("/yanxue/wechat/v1/order/createMiniProgramOrder", data)
}

/**
 * 创建微信支付订单
 */
export const createWechatPaymentOrder = (data: { orderId: string; openId: string }) => {
  return post<{
    prePayId: string
    jsSdkOptions: string
  }>("/yanxue/wechat/v1/order/createWechatPaymentOrder", data)
}

/**
 * 查询订单支付状态
 */
export const getOrderPaymentStatus = (orderId: string) => {
  return get<{
    isFinishPay: boolean
  }>("/yanxue/wechat/v1/order/getOrderPaymentStatus", { orderId })
}

/**
 * 更改订单状态
 */
export const updateOrderStatus = (data: { orderId: string; status: string }) => {
  return post("/yanxue/wechat/v1/order/updateOrderStatus", data)
}
