/**
 * 子订单管理相关类型定义
 */

/**
 * 子订单查询参数
 */
export interface SubOrderQueryParams {
  orderNumber?: string
  goodName?: string
  channelId?: string
  paymentTimeStart?: string
  paymentTimeEnd?: string
  orderStatus?: string
  phone?: string
  goodType?: string
  refundTimeStart?: string
  refundTimeEnd?: string
  serviceStatus?: string
  parentOrderId?: string
  campTimeStart?: string
  campTimeEnd?: string
  page: number
  pageSize: number
}

/**
 * 子订单列表项
 */
export interface SubOrderItem {
  id: string
  parentOrderId: string
  channelId: string
  goodId: string
  channelGoodId: string
  orderNumber: string
  goodName?: string
  channelName?: string
  orderPrice: number // 单位：分
  receiptAmount?: number // 实收金额：单位分
  discountAmount?: number // 优惠金额：单位分
  paymentTime: string
  ph: string // 联系电话
  phone?: string // 联系方式（别名）
  status: string
  createdAt: string
  updatedAt: string
  updatedBy?: string
  updatedByName?: string
  originOrderNumber?: string // 原始订单编号（拆单前）
  parentRemark?: string // 家长备注
  paymentDeadline?: string // 支付截止时间
  userCouponId?: string // 用户优惠券ID
  payId?: string // 支付订单号
  refundId?: string // 退款单ID
  refundAmount?: number // 退款金额：单位分
  refundReason?: string // 退款原因
  courseAppointmentDraft?: string // 预约草稿
  refundTime?: string // 退款时间
  goodType?: string // 商品类型：single_day单日营，multi_day多日营
  platformFee?: number // 平台手续费：单位分
  serviceStatus?: string // 服务状态：pending待预约，success已预约，completed已出行
  talentUId?: string // 达人uid
  talentUid?: string // 达人uid（别名）
  talentCommission?: number // 达人佣金：单位分
  campTime?: string // 参营时间
  talentName?: string // 达人名称
  platformDiscountAmount?: number // 平台优惠金额：单位分
  paymentDiscountAmount?: number // 支付优惠金额：单位分
  shopDiscountAmount?: number // 店铺优惠金额：单位分
  actualInsured?: number // 保险费：单位分
}

/**
 * 子订单列表响应
 */
export interface SubOrderListResponse {
  list: SubOrderItem[]
  total?: number // 可选，如果接口不返回则使用 list.length
}

/**
 * 子订单状态选项
 */
export const SUB_ORDER_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'pendingPayment' },
  { label: '支付成功', value: 'pending' },
  { label: '交易关闭', value: 'closed' },
  { label: '已退款', value: 'refunded' },
  { label: '部分退款', value: 'partialRefunded' },
  { label: '退款中', value: 'refunding' },
  { label: '退款失败', value: 'failedRefund' },
]

/**
 * 默认订单渠道选项（仅在API加载前使用）
 */
export const CHANNEL_OPTIONS = [{ label: '全部', value: '' }]

/**
 * 服务状态选项
 */
export const SERVICE_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待预约', value: 'pending' },
  { label: '已预约', value: 'success' },
  { label: '已出行', value: 'completed' },
]

/**
 * 商品类型选项
 */
export const GOOD_TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '单日营', value: 'single' },
  { label: '多日营', value: 'multi' },
]

/**
 * 订单状态类型处理函数
 */

// 获取服务状态对应的标签类型
export const getServiceStatusType = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'success':
      return 'success'
    case 'completed':
      return 'info'
    default:
      return ''
  }
}

// 获取服务状态对应的中文描述
export const getServiceStatusLabel = (status: string): string => {
  const option = SERVICE_STATUS_OPTIONS.find((item) => item.value === status)
  if (option) {
    return option.label
  }
  return '未知状态'
}

// 获取商品类型对应的中文描述
export const getGoodTypeLabel = (type: string): string => {
  const option = GOOD_TYPE_OPTIONS.find((item) => item.value === type)
  if (option) {
    return option.label
  }
  return '--'
}

// 获取订单状态对应的标签类型
export const getStatusType = (status: string): string => {
  switch (status) {
    case 'pendingPayment':
      return 'warning'
    case 'pending':
      return 'success'
    case 'closed':
      return 'info'
    case 'refunding':
      return 'warning'
    case 'refunded':
      return 'danger'
    case 'partialRefunded':
      return 'warning'
    case 'failedRefund':
      return 'danger'
    default:
      return ''
  }
}

// 获取订单状态对应的中文描述
export const getStatusLabel = (status: string): string => {
  const option = SUB_ORDER_STATUS_OPTIONS.find((item) => item.value === status)
  if (option) {
    return option.label
  }
  return '未知状态'
}

