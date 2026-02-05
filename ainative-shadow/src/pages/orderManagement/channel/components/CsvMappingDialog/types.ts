import { STATUS_OPTIONS } from '../../service.type'

export interface FieldMapping {
  systemField: string
  csvField: string
  required: boolean
}

export interface StatusMapping {
  csvValue: string
  systemValue: string
}

export interface CsvMappingForm {
  channelId: string
  fieldMappings: FieldMapping[]
  statusMappings: StatusMapping[]
  serviceStatusMappings: StatusMapping[]
  fieldMappingId: string
  statusMappingId: string
  serviceStatusMappingId: string
}

export interface ChannelOption {
  label: string
  value: string
}

export const SYSTEM_FIELDS = [
  { label: '订单编号', value: '订单编号' },
  { label: '渠道商品Id', value: '渠道商品Id' },
  { label: '订单金额', value: '订单金额' },
  { label: '联系方式', value: '联系方式' },
  { label: '支付时间', value: '支付时间' },
  { label: '订单状态', value: '订单状态' },
  { label: '商品件数', value: '商品件数' },
  { label: '商品名称', value: '商品名称' },
  { label: '商品类型', value: '商品类型' },
  { label: '卖家实收金额', value: '卖家实收金额' },
  { label: '优惠金额', value: '优惠金额' },
  { label: '平台优惠金额', value: '平台优惠金额' },
  { label: '店铺优惠金额', value: '店铺优惠金额' },
  { label: '支付优惠金额', value: '支付优惠金额' },
  { label: '保险费', value: '保险费' },
  { label: '平台手续费', value: '平台手续费' },
  { label: '退款时间', value: '退款时间' },
  { label: '退款金额', value: '退款金额' },
  { label: '达人名称', value: '达人名称' },
  { label: '达人uid', value: '达人uid' },
  { label: '达人佣金', value: '达人佣金' },
]

// 订单状态映射选项（主订单）
export const ORDER_STATUS_MAPPING_OPTIONS = [
  { label: '待支付', value: 'pendingPayment' },
  { label: '支付成功', value: 'pending' },
  { label: '交易关闭', value: 'closed' },
  { label: '已退款', value: 'refunded' },
  { label: '退款中', value: 'refunding' },
  { label: '退款失败', value: 'failedRefund' },
]

// 服务状态映射选项
export const SERVICE_STATUS_MAPPING_OPTIONS = [
  { label: '待预约', value: 'pending' },
  { label: '已预约', value: 'success' },
  { label: '已出行', value: 'completed' },
]

// 保留原有的STATUS_MAPPING_OPTIONS以兼容
export const STATUS_MAPPING_OPTIONS = STATUS_OPTIONS.filter(
  (item) => item.value !== '',
)
