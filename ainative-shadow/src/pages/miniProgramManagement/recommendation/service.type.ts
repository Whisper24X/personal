/**
 * 推荐管理相关类型定义
 */

/**
 * 推荐分类查询参数
 */
export interface RecommendationQueryParams {
    categoryName?: string
    status?: string
    page: number
    pageSize: number
}

/**
 * 推荐分类商品项
 */
export interface GoodItem {
    goodId: string
    sortOrder: number
}

/**
 * 推荐分类列表项
 */
export interface RecommendationItem {
    id: string
    name: string
    icon: string
    status: number
    sortOrder: number
    goodItems: GoodItem[]
    createdAt: string
    updatedAt: string
    updatedBy: string
    updatedByName: string
}

/**
 * 推荐分类列表响应
 */
export interface RecommendationListResponse {
    list: RecommendationItem[]
    total: number
}

/**
 * 创建推荐分类请求
 */
export interface CreateRecommendationRequest {
    name: string
    icon: string
    sortOrder: number
    goodItems?: GoodItem[]
}

/**
 * 更新推荐分类请求
 */
export interface UpdateRecommendationRequest {
    id: string
    name: string
    icon: string
    sortOrder: number
    goodItems?: GoodItem[]
}

/**
 * 分类状态选项
 */
export const STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '上架', value: 1 },
    { label: '下架', value: -1 }
]

/**
 * 分类状态类型处理函数
 */
export const getStatusType = (status: number): string => {
    switch (status) {
        case 1:
            return 'success'
        case -1:
            return 'danger'
        default:
            return ''
    }
}

/**
 * 获取分类状态对应的中文描述
 */
export const getStatusLabel = (status: number): string => {
    const option = STATUS_OPTIONS.find(item => item.value === status)
    if (option) {
        return option.label
    }
    return '未知状态'
}