/**
 * 推荐管理相关服务接口
 */
import request from '@/service/axios.interceptor'
import {
    RecommendationQueryParams,
    RecommendationListResponse,
    CreateRecommendationRequest,
    UpdateRecommendationRequest
} from './service.type'
import { centsToYuanNumber } from '@/utils/money'

/**
 * 获取推荐分类列表
 * @param params 查询参数
 * @returns 返回推荐分类列表和总数
 */
export const getRecommendationList = (params: RecommendationQueryParams): Promise<RecommendationListResponse> => {
    const queryParams: any = {
        page: params.page,
        pageSize: params.pageSize
    }

    // 如果有其他查询参数，可以在这里添加
    if (params.categoryName) {
        queryParams['name'] = params.categoryName
    }

    if (params.status !== undefined && params.status !== '') {
        queryParams['status'] = Number(params.status)
    }

    return request.post('/api/shadow/v1/good_recommendation_category/list', queryParams).then((res: any) => {
        // 将商品推荐分类中的商品价格从分转换为元（用于前端显示）
        if (res && Array.isArray(res.list)) {
            res.list = res.list.map((category: any) => {
                if (Array.isArray(category.goodItems) && category.goodItems.length > 0) {
                    category.goodItems = category.goodItems.map((item: any) => ({
                        ...item,
                        price: item.price !== undefined ? centsToYuanNumber(item.price) : item.price,
                    }))
                }
                return category
            })
        }
        return res
    })
}

/**
 * 创建推荐分类
 * @param data 推荐分类数据
 * @returns 创建结果
 */
export const createRecommendation = (data: CreateRecommendationRequest) => {
    return request.post('/api/shadow/v1/good_recommendation_category/create', data)
}

/**
 * 更新推荐分类
 * @param data 推荐分类数据
 * @returns 更新结果
 */
export const updateRecommendation = (data: UpdateRecommendationRequest) => {
    return request.post('/api/shadow/v1/good_recommendation_category/update', data)
}

/**
 * 删除推荐分类
 * @param id 推荐分类ID
 * @returns 删除结果
 */
export const deleteRecommendation = (id: string) => {
    return request.post('/api/shadow/v1/good_recommendation_category/delete', { id })
}

/**
 * 更新推荐分类状态
 * @param data 更新状态请求
 * @returns 更新结果
 */
export const updateRecommendationStatus = (data: { id: string; status: number }): Promise<any> => {
    return request.post('/api/shadow/v1/good_recommendation_category/updateStatus', data)
}

/**
 * 获取推荐分类详情
 * @param id 推荐分类ID
 * @returns 推荐分类详情
 */
export const getRecommendationDetail = (id: string) => {
    return request.get(`/api/shadow/v1/good_recommendation_category/detail/${id}`).then((res: any) => {
        // 将商品价格从分转换为元（用于前端显示）
        if (res && res.info && res.info.goodItems && res.info.goodItems.length > 0) {
            res.info.goodItems = res.info.goodItems.map((item: any) => ({
                ...item,
                price: item.price !== undefined ? centsToYuanNumber(item.price) : item.price,
            }))
        }
        return res
    })
}

/**
 * 配置商品
 * @param data 配置参数
 * @returns 配置结果
 */
export const configureGoods = (data: {
    id: string
    goodItems: Array<{
        goodId: string
        sortOrder: number
    }>
}) => {
    return request.post('/api/shadow/v1/good_recommendation_category/updateGoodItems', data)
}
