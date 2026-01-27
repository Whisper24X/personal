/**
 * 订单管理相关类型定义
 */

/**
 * 订单查询参数
 */
export interface OrderQueryParams {
  goodName?: string
  channel?: string
  paymentTime?: string
  orderStatus?: string
  page: number
  pageSize: number
}

/**
 * 订单列表项
 */
export interface OrderItem {
  id: string
  orderNumber: string
  goodName: string
  goodId: string
  channelGoodId: string
  channel: string
  channelName: string
  channelId: string
  orderAmount: number
  orderPrice: number
  receiptAmount: number
  discountAmount: number
  contactMethod: string
  phone: string
  paymentTime: string
  orderStatus: string
  status: string
  createdAt: string
  updatedAt: string
  updatedByName: string
  payId?: string // 支付订单号
  refundId?: string // 退款订单号
  refundReason?: string // 退款原因
  refundAmount?: number // 退款金额
  parentRemark?: string // 订单备注
  refundTime?: string // 退款时间
  goodType?: string // 商品类型：single_day单日营，multi_day多日营
  platformFee?: number // 平台手续费：单位分
  serviceStatus?: string // 服务状态：pending待预约，success已预约，completed已出行
  talentUid?: string // 达人ID
  talentName?: string // 达人名称
  talentCommission?: number // 达人佣金：单位分
  platformDiscountAmount?: number // 平台优惠金额：单位分
  paymentDiscountAmount?: number // 支付优惠金额：单位分
  shopDiscountAmount?: number // 店铺优惠金额：单位分
  actualInsured?: number // 保险费：单位分
}

/**
 * 订单列表响应
 */
export interface OrderListResponse {
  list: OrderItem[]
  total: number
}

/**
 * 创建订单请求
 */
export interface CreateOrderRequest {
  goodId: string
  channel: string
  orderAmount: number
  contactMethod: string
  paymentTime: string
  orderStatus: string
}

/**
 * 更新订单请求
 */
export interface UpdateOrderRequest {
  id: string
  goodId: string
  channel: string
  orderAmount: number
  contactMethod: string
  paymentTime: string
  orderStatus: string
}

/**
 * 更新订单状态请求
 */
export interface UpdateOrderStatusRequest {
  ids: string[]
  status: string
}

/**
 * 渠道列表项
 */
export interface ChannelItem {
  id: string
  name: string
}

/**
 * 渠道列表响应
 */
export interface ChannelListResponse {
  list: ChannelItem[]
}

/**
 * 订单状态选项（主订单）
 */
export const STATUS_OPTIONS = [
  { label: '待支付', value: 'pendingPayment' },
  { label: '支付成功', value: 'pending' },
  { label: '交易关闭', value: 'closed' },
  { label: '已退款', value: 'refunded' },
  { label: '退款中', value: 'refunding' },
  { label: '退款失败', value: 'failedRefund' },
]

/**
 * 子订单状态选项
 */
export const SUB_ORDER_STATUS_OPTIONS = [
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
  { label: '待预约', value: 'pending' },
  { label: '已预约', value: 'success' },
  { label: '已出行', value: 'completed' },
]

/**
 * 商品类型选项
 */
export const GOOD_TYPE_OPTIONS = [
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

/**
 * 订单状态类型处理函数
 */

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
  // 先从主订单状态选项中查找
  const mainOption = STATUS_OPTIONS.find((item) => item.value === status)
  if (mainOption) {
    return mainOption.label
  }
  // 如果主订单中没有，再从子订单状态选项中查找
  const subOption = SUB_ORDER_STATUS_OPTIONS.find(
    (item) => item.value === status,
  )
  if (subOption) {
    return subOption.label
  }
  return '未知状态'
}

/**
 * CSV字段映射项
 */
export interface CsvFieldMapping {
  systemField: string
  csvField: string
  required: boolean
}

/**
 * CSV状态值映射项
 */
export interface CsvStatusMapping {
  csvValue: string
  systemValue: string
}

/**
 * CSV映射配置
 */
export interface CsvMappingConfig {
  channelId: string
  channelName: string
  fieldMappings: CsvFieldMapping[]
  statusMappings: CsvStatusMapping[]
  serviceStatusMappings?: CsvStatusMapping[]
  fieldMappingId?: string // 字段映射ID，可选
  statusMappingId?: string // 状态映射ID，可选
  serviceStatusMappingId?: string // 服务状态映射ID，可选
}

/**
 * CSV映射配置响应
 */
export interface CsvMappingConfigResponse {
  config: CsvMappingConfig | null
}

/**
 * 动态字段映射项
 */
export interface DynamicFieldMapping {
  sysDynamicFieldName: string
  csvDynamicFieldName: string
}

/**
 * 动态字段映射列表项
 */
export interface DynamicFieldMappingItem {
  id: string
  channel: string
  mappingType: string
  data: DynamicFieldMapping[]
}

/**
 * 动态字段映射响应
 */
export interface DynamicFieldMappingResponse {
  total: number
  list: DynamicFieldMappingItem[]
}

/**
 * 子订单列表项（按API文档定义）
 */
export interface SubOrderItem {
  id: string
  parentOrderId: string
  channelId: string
  goodId: string
  channelGoodId: string
  orderNumber: string
  orderPrice: number // 订单金额：单位分
  paymentTime: string
  phone: string // 联系方式
  status: string // 订单状态
  createdAt: string
  updatedAt: string
  updatedBy: string
  goodName?: string // 商品名称
  channelName?: string // 渠道名称
  discountAmount?: number // 优惠金额：单位分
  updatedByName?: string // 操作人名称
  payId?: string // 支付订单号
  refundId?: string // 退款订单号
  refundReason?: string // 退款原因
  refundAmount?: number // 退款金额
  parentRemark?: string // 家长备注
  refundTime?: string // 退款时间
  goodType?: string // 商品类型：single:单日营；multi：多日营
  platformFee?: number // 平台手续费：单位分
  serviceStatus?: string // 服务状态：pending待预约 success已预约 completed已完成
  talentUid?: string // 达人ID
  talentName?: string // 达人名称
  talentCommission?: number // 达人佣金：单位分
  receiptAmount?: number // 实收金额：单位分
  campTime?: string // 参营时间
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
}
