/**
 * 配置商品对话框相关类型定义
 */

/**
 * 商品数据接口定义
 */
export interface GoodItem {
  id: string
  name: string
  price: number // 商品价格，后端单位为分，前端转换为元显示
  imageUrl?: string
  category?: string
  description?: string
  disabled?: boolean
  expanded?: boolean
  isShowInHomepage?: boolean // 是否在首页展示
}

/**
 * 商品列表API响应类型定义
 */
export interface GoodListResponse {
  total: number
  list: Array<{
    id: string
    name: string
    mainImage: string[]
    detailImages: string[]
    price: number // 商品价格，后端单位为分，前端转换为元显示
    content: {
      goodCategories: Array<{
        categoryId: string
        categoryName: string
        useTimes: number
        courses: Array<{
          courseId: string
          courseName: string
          coursePrice: string
          isAppointment: boolean
        }>
      }>
    }
    sales: number
    status: string
    channel: string
    channelId: string
    channelGoodId: string
    platformGoodId: string
    createdAt: string
    updatedAt: string
    updatedBy: string
    updatedByName: string
  }>
}

/**
 * 商品列表查询参数
 */
export interface GoodListQueryParams {
  page: number
  pageSize: number
  channelName: string
}

/**
 * 批量获取商品参数
 */
export interface BatchGetGoodsParams {
  ids: string[]
}

/**
 * 商品配置参数
 */
export interface ConfigureGoodsParams {
  id: string
  goodItems: Array<{
    goodId: string
    sortOrder: number
    isShowInHomepage?: boolean // 是否在首页展示
  }>
}

/**
 * 推荐分类详情响应
 */
export interface RecommendationCategoryInfoResponse {
  info: {
    id: string
    name: string
    icon: string
    status: number
    sortOrder: number
    goodItems: Array<{
      goodId: string
      sortOrder: number
      goodName: string
      mainImage: string
      price: number // 商品价格，后端单位为分，前端转换为元显示
      isShowInHomepage?: boolean
    }>
    createdAt: string
    updatedAt: string
    updatedBy: string
    updatedByName: string
  }
}
