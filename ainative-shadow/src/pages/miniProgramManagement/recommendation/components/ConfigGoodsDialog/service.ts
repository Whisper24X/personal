/**
 * 配置商品对话框相关服务接口
 */
import request from '@/service/axios.interceptor'
import {
    GoodListResponse,
    GoodListQueryParams,
    BatchGetGoodsParams,
    ConfigureGoodsParams,
    GoodItem,
    RecommendationCategoryInfoResponse
} from './service.type'
import { centsToYuanNumber } from '@/utils/money'

/**
 * 获取商品列表
 * @param params 查询参数
 * @returns 返回商品列表和总数
 */
export const getGoodList = (params: GoodListQueryParams): Promise<GoodListResponse> => {
    return request.post('/api/shadow/v1/good/list', {
        ...params,
        status: 'putOn'
    }).then((res: any) => {
        // 将商品价格从分转换为元（用于前端显示）
        if (res && res.list) {
            res.list = res.list.map((item: any) => ({
                ...item,
                price: centsToYuanNumber(item.price),
            }))
        }
        return res as GoodListResponse
    })
}

/**
 * 批量获取商品详情
 * @param params 商品ID数组
 * @returns 返回商品详情列表
 */
export const batchGetGoods = (params: BatchGetGoodsParams): Promise<any> => {
    return request.post('/api/shadow/v1/good/batch_get', params).then((res: any) => {
        // 将商品价格从分转换为元（用于前端显示）
        if (res && res.list) {
            res.list = res.list.map((item: any) => ({
                ...item,
                price: item.price !== undefined ? centsToYuanNumber(item.price) : item.price,
            }))
        }
        return res as any
    })
}

/**
 * 配置商品
 * @param params 配置参数
 * @returns 配置结果
 */
export const configureGoods = (params: ConfigureGoodsParams): Promise<any> => {
    return request.post('/api/shadow/v1/good_recommendation_category/updateGoodItems', params)
}

/**
 * 获取推荐分类详情
 * @param id 分类ID
 * @returns 返回分类详情
 */
export const getRecommendationCategoryInfo = (id: string): Promise<RecommendationCategoryInfoResponse> => {
    return request.get(`/api/shadow/v1/good_recommendation_category/info?id=${id}`).then((res: any) => {
        // 将商品价格从分转换为元（用于前端显示）
        if (res && res.info && res.info.goodItems && res.info.goodItems.length > 0) {
            res.info.goodItems = res.info.goodItems.map((item: any) => ({
                ...item,
                price: item.price !== undefined ? centsToYuanNumber(item.price) : item.price,
            }))
        }
        return res as RecommendationCategoryInfoResponse
    })
}

/**
 * 处理商品列表数据，转换为组件需要的格式
 * @param responseData API响应数据
 * @returns 处理后的商品列表
 */
export const processGoodListData = (responseData: GoodListResponse): GoodItem[] => {
    if (!responseData || !responseData.list) {
        return []
    }

    return responseData.list.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price || 0,
        imageUrl: item.mainImage && item.mainImage.length > 0 ? item.mainImage[0] : '',
        category: item.content?.goodCategories?.[0]?.categoryName || '',
        description: item.content?.goodCategories?.[0]?.courses?.[0]?.courseName || ''
    }))
}

/**
 * 处理已选商品数据，合并排序信息
 * @param goodItems 商品项目数组
 * @param goodsData 商品详情数据
 * @returns 处理后的已选商品列表
 */
export const processSelectedGoodsData = (goodItems: any[], goodsData: any[]): GoodItem[] => {
    if (!goodItems || !goodsData) {
        return []
    }

    return goodItems.map(item => {
        const goodInfo = goodsData.find((g: any) => g.id === item.goodId) || {
            id: item.goodId,
            name: `商品${item.goodId}`,
            price: 0,
            imageUrl: ''
        }

        return {
            ...goodInfo,
            sortOrder: item.sortOrder,
            expanded: false
        }
    }).sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * 处理推荐分类详情数据，转换为已选商品列表
 * @param responseData API响应数据
 * @returns 处理后的已选商品列表
 */
export const processRecommendationCategoryInfo = (responseData: RecommendationCategoryInfoResponse): GoodItem[] => {
    if (!responseData || !responseData.info || !responseData.info.goodItems) {
        return []
    }

    return responseData.info.goodItems.map(item => ({
        id: item.goodId,
        name: item.goodName,
        price: item.price,
        imageUrl: item.mainImage,
        category: '',
        description: '',
        sortOrder: item.sortOrder,
        expanded: false,
        isShowInHomepage: item.isShowInHomepage || false
    })).sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * 构造商品配置参数
 * @param categoryData 分类数据
 * @param selectedGoods 已选商品列表
 * @returns 构造后的配置参数
 */
export const buildConfigureGoodsParams = (categoryData: any, selectedGoods: GoodItem[]): ConfigureGoodsParams => {
    const goodItems = selectedGoods.map((item, index) => ({
        goodId: item.id,
        sortOrder: index + 1,
        isShowInHomepage: item.isShowInHomepage || false
    }))

    return {
        id: categoryData.id,
        goodItems: goodItems
    }
}
