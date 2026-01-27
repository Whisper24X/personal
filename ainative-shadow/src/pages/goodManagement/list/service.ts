/**
 * 商品管理模块 - 服务接口
 */
import http from '@/service/axios.interceptor'
import {
  GetPlatformGoodListReq,
  GetPlatformGoodListReply,
  GetChannelListReply,
  CreatePlatformGoodReq,
  CreatePlatformGoodReply,
  UpdatePlatformGoodReq,
  UpdatePlatformGoodReply,
} from './service.type'

/**
 * 获取平台商品列表
 * @param params 请求参数
 * @returns 平台商品列表数据
 */
export function getPlatformGoodList(params: GetPlatformGoodListReq) {
  return http.post<GetPlatformGoodListReply>(
    '/api/shadow/v1/platformGood/list',
    params,
  )
}

/**
 * 更新平台商品
 * @param params 更新参数
 * @returns 更新结果
 */
export function updatePlatformGood(params: UpdatePlatformGoodReq) {
  return http.post<UpdatePlatformGoodReply>('/api/shadow/v1/platformGood/update', params)
}

/**
 * 获取渠道列表
 * @returns 渠道列表数据
 */
export function getChannelList() {
  return http.post<GetChannelListReply>('/api/shadow/v1/channel/list', {})
}

/**
 * 创建平台商品
 * @param params 创建参数
 * @returns 创建结果
 */
export function createPlatformGood(params: CreatePlatformGoodReq) {
  return http.post<CreatePlatformGoodReply>(
    '/api/shadow/v1/platformGood/create',
    params,
  )
}
