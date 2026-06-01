import { post } from "./request"

/**
 * 商品推荐分类表信息
 */
export interface GoodRecommendationCategoryInfo {
  /**
   * 商品内容JSON数组，格式：[{"goodId": "uuid", "sortOrder": 1}]
   */
  goodItems: GoodItem[]
  /**
   * 分类图标URL
   */
  icon?: string
  /**
   * id
   */
  id?: string
  /**
   * 分类名称
   */
  name: string
  /**
   * 排序号，数字越小排序越靠前
   */
  sortOrder?: number
  /**
   * 状态：-1-下架，1-上架
   */
  status?: number
}

/**
 * 商品项
 */
export interface GoodItem {
  /**
   * 商品id
   */
  goodId?: string
  /**
   * 商品名称
   */
  goodName?: string
  /**
   * 主图URL
   */
  mainImage?: string
  /**
   * 价格(单位:分)
   */
  price?: number
  /**
   * 排序号，数字越小排序越靠前
   */
  sortOrder?: number
  /**
   * 是否在首页展示
   */
  isShowInHomepage?: boolean
  /**
   * 商品标签列表
   */
  label?: string[]
}

/**
 * 获取商品推荐分类列表
 * @param page 页码
 * @param pageSize 每页数量
 * @returns 商品推荐分类列表和总数
 */
export const getGoodRecommendationCategoryList = (page: number = 1, pageSize: number = 10) => {
  return post<{
    list?: GoodRecommendationCategoryInfo[]
    total?: number
  }>("/yanxue/wechat/v1/good_recommendation_category/list", {
    page,
    pageSize
  })
}
