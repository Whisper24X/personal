import { get, post } from "@/api/request"

// 优惠券接口类型定义
export interface CouponInfo {
  /**
   * 优惠券ID
   */
  id: string
  /**
   * 优惠券名称
   */
  name: string
  /**
   * 优惠金额(单位:元)
   */
  discountAmount: number
  /**
   * 推送方式:public:公开;private:私密
   */
  pushType: string
  /**
   * 优惠券类型:common:通用;good:商品
   */
  couponType: string
  /**
   * 门槛金额:为0则表示无门槛(单位:元)
   */
  minAmount: number
  /**
   * 使用开始时间
   */
  validStartTime: string
  /**
   * 使用结束时间
   */
  validEndTime: string
  /**
   * 领取开始时间
   */
  claimStartTime: string
  /**
   * 领取结束时间
   */
  claimEndTime: string
  /**
   * 每人限领张数
   */
  limitPerUser: number
  /**
   * 优惠券领取后多少天内有效
   */
  couponValidDays: number
  /**
   * 已领取数量
   */
  receivedCount: number
  // 兼容旧字段
  /**
   * 优惠券名称（兼容字段）
   */
  couponName: string
  /**
   * 领取时间（兼容字段）
   */
  claimTime: string
  /**
   * 过期时间（兼容字段）
   */
  expireTime: string
  /**
   * 状态：已核销:used；未核销:unUsed；已过期:expired；已锁定:locked；
   */
  status: string
  /**
   * 用户ID（兼容字段）
   */
  userId: string
  /**
   * 使用时间（兼容字段）
   */
  useTime: string
}

export interface CouponListResponse {
  list: CouponInfo[]
}

export interface CouponStatsResponse {
  available: number
  used: number
  expired: number
}

export interface UseCouponParams {
  couponId: string
  orderId?: string
}

export interface UseCouponResponse {
  success: boolean
  message: string
  discountAmount?: number // 优惠金额(单位:元)
}
export interface GetCouponListParams {
  goodId?: string
}
/**
 * 获取优惠券列表
 * @param params 查询参数
 * @returns Promise<CouponListResponse>
 */
export const getCouponList = (params: GetCouponListParams): Promise<CouponListResponse> => {
  return post<CouponListResponse>("/yanxue/wechat/v1/coupon/list", params)
}
/**
 * 获取我的优惠券列表
 * @param goodId 商品ID（可选）
 * @returns Promise<CouponListResponse>
 */
export const getMyCouponList = (goodId?: string): Promise<CouponListResponse> => {
  const params = goodId ? { goodId } : {}
  return get<CouponListResponse>("/yanxue/wechat/v1/user_coupon/getMyCouponList", params)
}

/**
 * 获取优惠券统计信息
 * @returns Promise<CouponStatsResponse>
 */
export const getCouponStats = (): Promise<CouponStatsResponse> => {
  return get<CouponStatsResponse>("/yanxue/wechat/v1/coupon/stats")
}

/**
 * 使用优惠券
 * @param params 使用参数
 * @returns Promise<UseCouponResponse>
 */
export const useCoupon = (params: UseCouponParams): Promise<UseCouponResponse> => {
  return post<UseCouponResponse>("/yanxue/wechat/v1/coupon/use", params)
}

/**
 * 领取优惠券
 * @param couponId 优惠券ID
 * @returns Promise<{ id: string }>
 */
export const claimCoupon = (couponId: string): Promise<{ id: string }> => {
  return post<{ id: string }>("/yanxue/wechat/v1/user_coupon/create", {
    couponId
  })
}

/**
 * 获取优惠券详情
 * @param couponId 优惠券ID
 * @returns Promise<{couponInfo: CouponInfo}>
 */
export const getCouponDetail = (couponId: string): Promise<{ couponInfo: CouponInfo }> => {
  return get<{ couponInfo: CouponInfo }>("/yanxue/wechat/v1/coupon/getCouponInfoById", {
    couponId
  })
}

// 商品接口类型定义
export interface ProductInfo {
  goodId: string
  goodName: string
  price: number
  mainImage: string
  detailImages: string[]
}

export interface CouponProductsResponse {
  list: ProductInfo[]
  total: number
  page: number
  pageSize: number
}

/**
 * 获取优惠券适用的商品列表
 * @param couponId 优惠券ID
 * @returns Promise<CouponProductsResponse>
 */
export const getCouponAdaptGoodInfoList = (couponId: string): Promise<CouponProductsResponse> => {
  return post<CouponProductsResponse>("/yanxue/wechat/v1/coupon/getCouponAdaptGoodInfoList", {
    couponId
  })
}
