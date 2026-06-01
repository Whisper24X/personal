import { get, post } from "./request"

/**
 * 商品信息
 */
export interface GoodInfo {
  /**
   * 商品ID
   */
  id?: string
  /**
   * 商品名称
   */
  name?: string
  /**
   * 主图列表
   */
  mainImage?: string[]
  /**
   * 详情图片列表
   */
  detailImages?: string[]
  /**
   * 价格(单位:分)
   */
  price?: number
  /**
   * 商品内容
   */
  content?: {
    goodCategories?: GoodCategory[]
  }
  /**
   * 状态
   */
  status?: string
  /**
   * 创建时间
   */
  createdAt?: string
  /**
   * 更新时间
   */
  updatedAt?: string
  /**
   * 预约规则
   */
  appointmentRules?: string
  /**
   * 渠道ID
   */
  channelId?: string
  /**
   * 渠道商品ID
   */
  channelGoodId?: string
  /**
   * 平台商品ID
   */
  platformGoodId?: string
  /**
   * 是否推送预约信息
   */
  isPushAppointmentInfo?: boolean
  /**
   * 最大优惠金额
   */
  maxDiscountAmount?: number
  /**
   * 商品类型：single-单日营，multi-多日营，deposit-定金
   */
  goodType?: string
  /**
   * 库存数量，NULL表示无限库存
   */
  stock?: number | null
}

/**
 * 商品分类
 */
export interface GoodCategory {
  /**
   * 分类ID
   */
  categoryId?: string
  /**
   * 分类名称
   */
  categoryName?: string
  /**
   * 使用次数
   */
  useTimes?: number
  /**
   * 课程列表
   */
  courses?: Course[]
}

/**
 * 课程信息
 */
export interface Course {
  /**
   * 课程ID
   */
  courseId?: string
  /**
   * 课程名称
   */
  courseName?: string
  /**
   * 课程价格
   */
  coursePrice?: string
  /**
   * 是否可预约
   */
  isAppointment?: boolean
}

/**
 * 通过场景ID获取真实商品ID
 * @param sceneId  sceneId
 * @returns 真实商品ID信息
 */
export const getGoodIdBySceneId = (sceneId: string) => {
  return get<{
    page: string
    scene: string
  }>("/yanxue/wechat/v1/wx_xcx_qrcode/scene", {
    token: sceneId
  })
}

/**
 * 生成商品分享二维码
 * @param page 小程序页面路径
 * @param scene 场景参数（商品ID）
 * @returns 二维码图片URL
 */
export const generateQrCode = (page: string, scene: string) => {
  return post<{
    token: string
    url: string
  }>("/yanxue/wechat/v1/wx_xcx_qrcode/generate", {
    page,
    scene
  })
}

/**
 * 获取商品详情
 * @param id 商品ID
 * @returns 商品详情信息
 */
export const getGoodInfo = (id: string) => {
  return get<{
    info?: GoodInfo
  }>("/yanxue/wechat/v1/good/info", {
    id
  })
}
