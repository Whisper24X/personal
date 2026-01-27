/**
 * 优惠券相关服务接口
 */

import request from '@/service/axios.interceptor'
import {
  CouponItem,
  CouponListResponse,
  CouponQueryParams,
  CouponStatusChangeParams,
  CreateCouponParams,
  CouponInfoResponse,
  CouponQuantitySummaryResponse,
} from './service.type'

/**
 * 获取优惠券列表
 * @param params 查询参数
 * @returns 优惠券列表响应
 */
export const getCouponList = (
  params: CouponQueryParams,
): Promise<CouponListResponse> => {
  const queryParams: any = {
    page: params.page,
    pageSize: params.pageSize,
  }

  // 如果有其他查询参数，可以在这里添加
  if (params.name) {
    queryParams['name'] = params.name
  }

  if (params.pushType) {
    queryParams['pushType'] = params.pushType
  }

  if (params.status) {
    queryParams['status'] = params.status
  }

  return request.post('/api/shadow/v1/coupon/list', queryParams)
}

/**
 * 更新优惠券状态
 * @param params 状态变更参数
 * @returns 操作结果
 */
export const updateCouponStatus = (params: CouponStatusChangeParams) => {
  return request.post('/api/shadow/v1/coupon/updateStatus', {
    id: params.id,
    status: params.status,
  })
}

/**
 * 创建优惠券
 * @param couponData 优惠券数据
 * @returns 操作结果
 */
export const createCoupon = (couponData: CreateCouponParams) => {
  return request.post('/api/shadow/v1/coupon/create', couponData)
}

/**
 * 获取优惠券详情
 * @param id 优惠券ID
 * @returns 优惠券详情
 */
export const getCouponInfo = (id: string) => {
  return request.get(`/api/shadow/v1/coupon/info?id=${id}`)
}

/**
 * 获取优惠券数量统计
 * @param id 优惠券ID
 * @returns 数量统计
 */
export const getCouponQuantitySummary = (id: string) => {
  return request.get(`/api/shadow/v1/coupon/quantitySummary?id=${id}`)
}

/**
 * 获取系统数据日志列表
 * @param params 查询参数
 * @returns 日志列表
 */
export const getSysDataLogList = (params: {
  page: number
  pageSize: number
  module: string
  operatorId: string
}) => {
  return request.post('/shadow/v1/sys_data_log/list', params)
}
