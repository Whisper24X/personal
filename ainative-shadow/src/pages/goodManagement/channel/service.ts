/**
 * 渠道商品模块 - 服务接口
 */
import http from '@/service/axios.interceptor'
import {
  GetGoodListReq,
  GetGoodListReply,
  UpdateGoodStatusReq,
  UpdateGoodStatusReply,
  CreateGoodReq,
  CreateGoodReply,
  UpdateGoodReq,
  UpdateGoodReply,
  GetChannelListReply,
  GetCourseListReply,
} from './service.type'
import { centsToYuanNumber, yuanToCents } from '@/utils/money'

/**
 * 获取渠道商品列表
 * @param params 请求参数
 * @returns 商品列表数据
 */
export function getGoodList(params: GetGoodListReq) {
  return http.post<GetGoodListReply>('/api/shadow/v1/good/list', params).then((res) => {
    // 将商品价格从分转换为元（用于前端显示）
    if (res && res.list) {
      res.list = res.list.map((item) => ({
        ...item,
        price: centsToYuanNumber(item.price),
      }))
    }
    return res
  })
}

/**
 * 获取商品详情
 * @param id 商品ID
 * @returns 商品详情数据
 */
export function getGoodInfo(id: string) {
  return http.get('/api/shadow/v1/good/info', { id }).then((res: any) => {
    // 将商品价格从分转换为元（用于前端显示）
    if (res && res.info && res.info.price !== undefined) {
      res.info.price = centsToYuanNumber(res.info.price)
    }
    return res
  })
}

/**
 * 更新商品状态
 * @param params 更新状态参数
 * @returns 操作结果
 */
export function updateGoodStatus(params: UpdateGoodStatusReq) {
  return http.post<UpdateGoodStatusReply>(
    '/api/shadow/v1/good/updateGoodStatus',
    params,
  )
}

/**
 * 创建渠道商品
 * @param params 创建参数
 * @returns 创建结果
 */
export function createGood(params: CreateGoodReq) {
  // 将价格从元转换为分（提交给后端）
  const submitParams = {
    ...params,
    price: yuanToCents(params.price),
  }
  return http.post<CreateGoodReply>('/api/shadow/v1/good/create', submitParams)
}

/**
 * 更新渠道商品
 * @param params 更新参数
 * @returns 更新结果
 */
export function updateGood(params: UpdateGoodReq) {
  // 将价格从元转换为分（提交给后端）
  const submitParams = {
    ...params,
    price: yuanToCents(params.price),
  }
  return http.post<UpdateGoodReply>('/api/shadow/v1/good/update', submitParams)
}

/**
 * 获取渠道列表
 * @returns 渠道列表数据
 */
export function getChannelList() {
  return http.post<GetChannelListReply>('/api/shadow/v1/channel/list', {})
}

/**
 * 获取课程列表选项
 * @returns 课程列表选项数据
 */
export function getCourseListOptions() {
  return http.get<GetCourseListReply>('/api/shadow/v1/course/selector')
}
