/**
 * 用户优惠券记录相关类型定义
 */

// 用户优惠券记录信息
export interface CouponRecordItem {
  id: string // id
  userId: string // 用户ID
  couponId: string // 优惠券ID
  couponName: string // 优惠券名称
  status: string // 状态：已核销:used；未核销:unUsed；已过期:expired
  ph: string // 手机号
  pushType: string // 推送方式
  claimTime: string // 领取时间
  expireTime: string // 过期时间
  orderNumber: string // 订单编号
  useTime: string // 使用时间
  createdAt: string // 创建时间
  updatedAt: string // 更新时间
}

// 查询参数
export interface CouponRecordQueryParams {
  page: number // 页码
  pageSize: number // 页数
  status?: string // 状态
  couponName?: string // 优惠券名称
  phone?: string // 手机号
  claimStartTime?: string // 领取开始时间
  claimEndTime?: string // 领取结束时间
  expireTimeStartTime?: string // 过期开始时间
  expireTimeEndTime?: string // 过期结束时间
}

// 列表响应
export interface CouponRecordListResponse {
  total: number // 总数
  list: CouponRecordItem[] // 列表数据
}

// 状态选项
export const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '未核销', value: 'unUsed' },
  { label: '已核销', value: 'used' },
  { label: '已过期', value: 'expired' },
]

// 推送方式选项
export const PUSH_METHOD_OPTIONS = [
  { label: '公开', value: 'public' },
  { label: '私密', value: 'private' },
]

// 获取状态标签
export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'unUsed':
      return '未核销'
    case 'used':
      return '已核销'
    case 'expired':
      return '已过期'
    default:
      return '未知'
  }
}

// 获取状态类型（用于el-tag的type属性）
export const getStatusType = (status: string): string => {
  switch (status) {
    case 'unUsed':
      return 'warning'
    case 'used':
      return 'success'
    case 'expired':
      return 'info'
    default:
      return 'info'
  }
}

// 获取推送方式标签
export const getPushTypeLabel = (pushType: string): string => {
  switch (pushType) {
    case 'public':
      return '公开'
    case 'private':
      return '私密'
    default:
      return pushType
  }
}
