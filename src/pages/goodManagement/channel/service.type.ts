/**
 * 渠道商品模块 - 服务类型定义
 */

// 商品内容
export interface GoodContent {
  goodCategories: GoodCategory[]
}

// 商品类别
export interface GoodCategory {
  categoryId?: string
  categoryName: string
  useTimes: number
  courses: CourseItem[]
}

// 课程项
export interface CourseItem {
  courseId: string
  courseName: string
}

// 商品信息
export interface GoodInfo {
  id: string
  name: string
  mainImage: string[]
  detailImages: string[]
  price: number // 商品价格，单位：分
  content: GoodContent
  sales: number
  status: string
  channel: string
  channelId: string
  channelGoodId: string
  platformGoodId: string
  createdAt: string
  updatedAt: string
  updatedByName: string
  // 新增：是否推送预约信息
  isPushAppointmentInfo?: boolean
  // 新增：商品标签
  label?: string[]
  // 新增：购买协议
  purchaseAgreementName?: string
  purchaseAgreementLink?: string
}

// 商品列表请求参数
export interface GetGoodListReq {
  page: number
  pageSize: number
  platformGoodId?: string
}

// 商品列表响应
export interface GetGoodListReply {
  total: number
  list: GoodInfo[]
}

// 更新商品状态请求
export interface UpdateGoodStatusReq {
  id: string
  status: string // 状态:delete:删除；putOn:上架；putOff:下架；pending:待上架
}

// 更新商品状态响应
export interface UpdateGoodStatusReply {
  isSucceed: boolean
}

// 创建商品请求
export interface CreateGoodReq {
  platformGoodId: string
  mainImages: string[]
  detailImages: string[]
  price: number // 商品价格，单位：分
  content: GoodContent
  channelId: string
  channelGoodId?: string
  // 新增：是否推送预约信息
  isPushAppointmentInfo?: boolean
  // 新增：商品标签
  label?: string[]
  // 新增：购买协议
  purchaseAgreementName?: string
  purchaseAgreementLink?: string
}

// 创建商品响应
export interface CreateGoodReply {
  id: string
}

// 更新商品请求
export interface UpdateGoodReq {
  id: string
  platformGoodId: string
  mainImages: string[]
  detailImages: string[]
  price: number // 商品价格，单位：分
  content: GoodContent
  channelId: string
  channelGoodId?: string
  // 新增：是否推送预约信息
  isPushAppointmentInfo?: boolean
  // 新增：商品标签
  label?: string[]
  // 新增：购买协议
  purchaseAgreementName?: string
  purchaseAgreementLink?: string
}

// 更新商品响应
export interface UpdateGoodReply {
  isSucceed: boolean
}

// 渠道信息
export interface ChannelInfo {
  id: string
  name: string
}

// 渠道列表响应
export interface GetChannelListReply {
  list: ChannelInfo[]
}

// 课程信息
export interface CourseInfo {
  id: string
  courseName: string
  // 新增：课程类型（单日营/多日营）
  courseType?: 'single' | 'multi'
}

// 课程列表响应
export interface GetCourseListReply {
  list: CourseInfo[]
}
