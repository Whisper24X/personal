/**
 * 页面类型常量
 */
export const PAGE_TYPES = {
  PRODUCT: "product",
  ORDER: "order"
} as const

/**
 * 页面标题映射
 */
export const PAGE_TITLES = {
  [PAGE_TYPES.PRODUCT]: "商品详情",
  [PAGE_TYPES.ORDER]: "订单详情"
} as const

/**
 * 订单状态常量
 */
export const ORDER_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  REFUNDED: "refunded"
} as const

/**
 * 有效的预约状态列表
 */
export const VALID_APPOINTMENT_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.SUCCESS,
  "pending", // 兼容旧版本
  "success" // 兼容旧版本
] as const

/**
 * 页面路由常量
 */
export const ROUTES = {
  APPOINTMENT: "/pages/appointment/index/index",
  APPOINTMENT_RECORDS: "/pages/appointment/records/index",
  ORDER_SUBMIT: "/pages/order/submit/index",
  ORDER_CONFIRM_NO_APPOINTMENT: "/pages/order/confirm-no-appointment/index",
  ORDER_PENDING_PAYMENT: "/pages/order/pending-payment/index",
  ORDER_TRANSACTION_CLOSED: "/pages/order/transaction-closed/index",
  ORDER_PAYMENT_SUCCESS: "/pages/order/payment-success/index",
  USER_LOGIN: "/pages/user/login/index"
} as const
