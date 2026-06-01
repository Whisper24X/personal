/**
 * 子订单管理相关服务接口
 */
import request from '@/service/axios.interceptor'
import {
  SubOrderQueryParams,
  SubOrderListResponse,
} from './service.type'

/**
 * 获取子订单列表
 * @param params 查询参数
 * @returns 返回子订单列表和总数
 */
export const getSubOrderList = (params: any): Promise<SubOrderListResponse> => {
  // 转换参数格式
  const queryParams = {
    page: params.page || 0,
    pageSize: params.pageSize || 0,
    orderNumber: params.orderNumber || undefined,
    goodName: params.goodName || undefined,
    channelId: params.channelId || undefined,
    paymentTimeStart: params.paymentTimeStart || params.startDate || undefined,
    paymentTimeEnd: params.paymentTimeEnd || params.endDate || undefined,
    orderStatus: params.orderStatus || undefined,
    phone: params.phone || undefined,
    goodType: params.goodType || undefined,
    refundTimeStart: params.refundTimeStart || undefined,
    refundTimeEnd: params.refundTimeEnd || undefined,
    serviceStatus: params.serviceStatus || undefined,
    parentOrderId: params.parentOrderId || undefined,
    campTimeStart: params.campTimeStart || undefined,
    campTimeEnd: params.campTimeEnd || undefined,
  }

  // 移除所有undefined值
  const cleanParams = Object.entries(queryParams)
    .filter(([_, value]) => value !== undefined)
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

  return request.post('/api/shadow/v1/sub_order/list', cleanParams)
}

/**
 * 获取购买渠道列表
 * @returns 渠道列表
 */
export const getChannelList = (): Promise<{
  list: { id: string; name: string }[]
}> => {
  return request.post('/api/shadow/v1/channel/list', {})
}

/**
 * 导出子订单
 * @param params 查询参数
 * @returns 导出文件下载URL
 */
export const exportSubOrders = (params: any): Promise<{ downloadUrl: string }> => {
  // 转换参数格式
  const queryParams = {
    orderNumber: params.orderNumber || undefined,
    goodName: params.goodName || undefined,
    channelId: params.channelId || undefined,
    paymentTimeStart: params.paymentTimeStart || params.startDate || undefined,
    paymentTimeEnd: params.paymentTimeEnd || params.endDate || undefined,
    orderStatus: params.orderStatus || undefined,
    phone: params.phone || undefined,
    goodType: params.goodType || undefined,
    refundTimeStart: params.refundTimeStart || undefined,
    refundTimeEnd: params.refundTimeEnd || undefined,
    serviceStatus: params.serviceStatus || undefined,
    parentOrderId: params.parentOrderId || undefined,
    campTimeStart: params.campTimeStart || undefined,
    campTimeEnd: params.campTimeEnd || undefined,
  }

  // 移除所有undefined值
  const cleanParams = Object.entries(queryParams)
    .filter(([_, value]) => value !== undefined)
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

  return request.post('/api/shadow/v1/order/exportSubOrderList', cleanParams)
}

/**
 * 导出子订单流水
 * @param params 导出参数
 * @returns 导出文件下载URL
 */
export const exportSubOrderFlow = (params: {
  startDate: string
  endDate: string
}): Promise<{ downloadUrl: string }> => {
  return request.post('/api/shadow/v1/sub_order/exportSubOrderFlow', {
    startDate: params.startDate,
    endDate: params.endDate,
  })
}

/**
 * 获取订单日志列表
 * @param params 查询参数
 * @returns 日志列表
 */
export const getOrderLogList = (params: {
  page: number
  pageSize: number
  module: string
  operatorId: string
}): Promise<{
  list: Array<{
    id: string
    operationType: string
    operatorId: string
    oldData: string
    newData: string
    createdAt: string
    updatedBy: string
    updatedByName: string
    module: string
    remark: string
  }>
  total: number
}> => {
  return request.post('/shadow/v1/sys_data_log/list', params)
}

