/**
 * 优惠券相关类型定义
 */

// 优惠券状态枚举
export enum CouponStatus {
  PUT_OFF = 'putOff', // 下架
  PUT_ON = 'putOn', // 上架
}

// 优惠券类型枚举
export enum CouponType {
  COMMON = 'common', // 通用
  GOOD = 'good', // 商品
}

// 推送方式枚举
export enum PushMethod {
  PRIVATE = 'private', // 私密
  PUBLIC = 'public', // 公开
}

// 优惠券数据接口
export interface CouponItem {
  id: string // 优惠券ID
  name: string // 优惠券名称
  discountAmount: number // 优惠金额
  pushType: string // 推送方式：public:公开；private:私密
  couponType: string // 优惠券类型：common:通用；good:商品
  adaptGoodInfo: string[] // 适用商品信息
  minAmount: number // 门槛金额：为0则表示无门槛
  validStartTime: string // 使用开始时间
  validEndTime: string // 使用结束时间
  claimStartTime: string // 领取开始时间
  claimEndTime: string // 领取结束时间
  totalStock: number // 投放张数
  limitPerUser: number // 每人限领张数
  remark: string // 备注
  shareQRCode: string // 分享二维码
  createdAt: string // 创建时间
  updatedAt: string // 更新时间
  status: string // 状态：putOn:上架；putOff:下架
  couponValidDays: number // 优惠券领取后几天内有效
}

// 查询参数接口
export interface CouponQueryParams {
  name?: string // 优惠券名称
  pushType?: string // 推送方式：public:公开；private:私密
  status?: string // 状态：putOn:上架；putOff:下架
  page: number // 页码
  pageSize: number // 页数
}

// 列表响应接口
export interface CouponListResponse {
  list: CouponItem[]
  total: number
}

// 状态变更参数接口
export interface CouponStatusChangeParams {
  id: string
  status: string
}

// 创建优惠券请求参数
export interface CreateCouponParams {
  id: string // 优惠券ID
  name: string // 优惠券名称
  discountAmount: number // 优惠金额
  pushType: string // 推送方式：public:公开；private:私密
  couponType: string // 优惠券类型：common:通用；good:商品
  adaptGoodInfo: string[] // 适用商品信息
  minAmount: number // 门槛金额：为0则表示无门槛
  validStartTime: string // 使用开始时间
  validEndTime: string // 使用结束时间
  claimStartTime: string // 领取开始时间
  claimEndTime: string // 领取结束时间
  totalStock: number // 投放张数
  limitPerUser: number // 每人限领张数
  remark: string // 备注
  shareQRCode: string // 分享二维码
  couponValidDays: number // 优惠券领取后几天内有效
}

// 优惠券详情响应
export interface CouponInfoResponse {
  info: CouponItem
}

// 优惠券数量统计响应
export interface CouponQuantitySummaryResponse {
  remainingQuantity: number // 剩余数量
  totalQuantity: number // 投放数量
  receivedQuantity: number // 领取数量
  usedQuantity: number // 使用数量
}

// 状态选项
export const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '上架', value: 'putOn' },
  { label: '下架', value: 'putOff' },
]

// 推送方式选项
export const PUSH_METHOD_OPTIONS = [
  { label: '全部', value: '' },
  { label: '公开', value: 'public' },
  { label: '私密', value: 'private' },
]

// 获取状态标签
export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'putOn':
      return '上架'
    case 'putOff':
      return '下架'
    default:
      return '未知'
  }
}

// 获取状态类型（用于el-tag的type属性）
export const getStatusType = (status: string): string => {
  switch (status) {
    case 'putOn':
      return 'success'
    case 'putOff':
      return 'danger'
    default:
      return 'info'
  }
}

// 系统数据日志信息
export interface SysDataLogInfo {
  id: string // 主键ID（UUID自动生成）
  operationType: string // 操作类型
  operatorId: string // 操作数据Id
  oldData: string // 旧数据
  newData: string // 新数据
  createdAt: string // 创建时间
  updatedBy: string // 操作人
  updatedByName: string // 操作人名称
  module: string // 功能模块
}

// 系统数据日志列表查询参数
export interface GetSysDataLogListReq {
  page: number // 页码
  pageSize: number // 页数
  module: string // 模块:优惠券；合同模版；
  operatorId: string // 操作对象ID
}

// 系统数据日志列表响应
export interface GetSysDataLogListReply {
  total: number // 总数
  list: SysDataLogInfo[] // 列表数据
}
