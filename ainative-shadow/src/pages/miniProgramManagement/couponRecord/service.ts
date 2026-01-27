import request from '@/service/axios.interceptor'
import {
  CouponRecordQueryParams,
  CouponRecordListResponse,
} from './service.type'

/**
 * 获取用户优惠券领取记录列表
 * @param params 查询参数
 * @returns 用户优惠券领取记录列表响应
 */
export const getCouponRecordList = (
  params: CouponRecordQueryParams,
): Promise<CouponRecordListResponse> => {
  const requestParams: any = {
    page: params.page,
    pageSize: params.pageSize,
  }

  // 添加可选查询参数
  if (params.status) {
    requestParams.status = params.status
  }

  if (params.couponName) {
    requestParams.couponName = params.couponName
  }

  if (params.phone) {
    requestParams.phone = params.phone
  }

  if (params.claimStartTime) {
    requestParams.claimStartTime = params.claimStartTime
  }

  if (params.claimEndTime) {
    requestParams.claimEndTime = params.claimEndTime
  }

  if (params.expireTimeStartTime) {
    requestParams.expireTimeStartTime = params.expireTimeStartTime
  }

  if (params.expireTimeEndTime) {
    requestParams.expireTimeEndTime = params.expireTimeEndTime
  }

  return request.post('/api/shadow/v1/user_coupon/list', requestParams)
}
