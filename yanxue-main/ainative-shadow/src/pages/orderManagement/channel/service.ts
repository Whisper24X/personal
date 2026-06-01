/**
 * 订单管理相关服务接口
 */
import request from '@/service/axios.interceptor'
import {
  OrderQueryParams,
  OrderListResponse,
  CreateOrderRequest,
  UpdateOrderRequest,
  UpdateOrderStatusRequest,
  CsvMappingConfig,
  DynamicFieldMappingResponse,
  SubOrderListResponse,
} from './service.type'

/**
 * 获取订单列表
 * @param params 查询参数
 * @returns 返回订单列表和总数
 */
export const getOrderList = (params: any): Promise<any> => {
  // 转换参数格式
  const queryParams = {
    page: params.page,
    pageSize: params.pageSize,
    orderNumber: params.orderNumber || undefined,
    goodName: params.goodName || undefined,
    channelId: params.channelId || undefined,
    paymentTimeStart: params.startDate || undefined,
    paymentTimeEnd: params.endDate || undefined,
    orderStatus: params.orderStatus || undefined,
    phone: params.phone || undefined,
    goodType: params.goodType || undefined,
    refundTimeStart: params.refundTimeStart || undefined,
    refundTimeEnd: params.refundTimeEnd || undefined,
    serviceStatus: params.serviceStatus || undefined,
  }

  // 移除所有undefined值
  const cleanParams = Object.entries(queryParams)
    .filter(([_, value]) => value !== undefined)
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

  return request.post('/api/shadow/v1/order/getOrderList', cleanParams)
}

/**
 * 获取商品选择器数据
 * @returns 商品选择器数据
 */
export const getGoodSelector = () => {
  return request.get('/api/good/selector')
}

/**
 * 创建订单
 * @param data 订单数据
 * @returns 创建结果
 */
export const createOrder = (data: CreateOrderRequest) => {
  return request.post('/api/order/create', data)
}

/**
 * 更新订单
 * @param data 订单数据
 * @returns 更新结果
 */
export const updateOrder = (data: UpdateOrderRequest) => {
  return request.put('/api/order/update', data)
}

/**
 * 获取订单详情
 * @param id 订单ID
 * @returns 订单详情
 */
export const getOrderDetail = (id: string) => {
  return request.get(`/api/order/detail/${id}`)
}

/**
 * 更新订单状态
 * @param data 更新状态请求
 * @returns 更新结果
 */
export const updateOrderStatus = (data: {
  id: string
  status: string
}): Promise<any> => {
  return request.post('/api/shadow/v1/order/updateOrderDetail', data)
}

/**
 * 导入订单
 * @param file 文件
 * @returns 导入结果
 */
export const importOrders = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/api/order/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

/**
 * 通过CSV文件导入订单
 * @param params 导入参数
 * @returns 导入结果
 */
export const importOrdersByCsvFile = (params: {
  fileUrl: string
  channelId: string
}): Promise<any> => {
  return request.post('/api/shadow/v1/order/importContractUserInfoByCsvFile', {
    channelId: params.channelId,
    fileUrl: params.fileUrl,
  })
}

/**
 * 通过CSV文件导入手机号
 * @param params 导入参数
 * @returns 导入结果
 */
export const importPhonesByCsvFile = (params: {
  fileUrl: string
}): Promise<any> => {
  return request.post('/api/shadow/v1/order/importPhoneByCsvFile', {
    fileUrl: params.fileUrl,
  })
}

/**
 * 查询异步任务结果
 * @param taskId 任务ID
 * @returns 返回任务状态信息
 */
export const queryAsyncTaskResult = (
  taskId: string,
): Promise<{ taskId: string; status: number; errorInfo: string }> => {
  return request.get('/api/order/queryAsyncTaskResult', {
    taskId,
  })
}

/**
 * 获取购买渠道列表
 * @returns 渠道列表
 */
export const getChannelList = (): Promise<{
  list: { id: string; name: string }[]
}> => {
  // 与 filterRepeatHttp 去重逻辑冲突：多处会并发拉同一 body 的渠道列表，被取消的请求会误判为失败
  return request.post(
    '/api/shadow/v1/channel/list',
    {},
    { params: { disabledRepeatInterceptor: true } },
  )
}

/**
 * 创建渠道
 * @param name 渠道名称
 * @returns 创建结果，包含 id
 */
export const createChannel = (name: string): Promise<{ id: string }> => {
  return request.post('/api/shadow/v1/channel/create', { name })
}

/**
 * 导出订单
 * @param params 查询参数
 * @returns 导出文件下载URL
 */
export const exportOrders = (params: any): Promise<any> => {
  // 转换参数格式
  const queryParams = {
    orderNumber: params.orderNumber || undefined,
    goodName: params.goodName || undefined,
    channelId: params.channelId || undefined,
    paymentTimeStart: params.startDate || undefined,
    paymentTimeEnd: params.endDate || undefined,
    orderStatus: params.orderStatus || undefined,
    phone: params.phone || undefined,
  }

  // 移除所有undefined值
  const cleanParams = Object.entries(queryParams)
    .filter(([_, value]) => value !== undefined)
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

  return request.post('/api/shadow/v1/order/exportOrderList', cleanParams)
}

/**
 * 获取CSV映射配置
 * @param channel 渠道名称
 * @returns 映射配置
 */
export const getCsvMappingConfig = (
  channel: string,
): Promise<DynamicFieldMappingResponse> => {
  return request.post('/api/shadow/v1/dynamic_field_mapping/list', {
    page: 0,
    pageSize: 0,
    channel: channel,
  })
}

/**
 * 保存CSV映射配置
 * @param config 映射配置
 * @returns 保存结果
 */
export const saveCsvMappingConfig = async (
  config: CsvMappingConfig,
): Promise<any> => {
  // 转换数据结构以适应新API
  const fieldMappings = config.fieldMappings.map((item) => ({
    sysDynamicFieldName: item.systemField,
    csvDynamicFieldName: item.csvField,
  }))

  const statusMappings = config.statusMappings.map((item) => ({
    sysDynamicFieldName: item.systemValue,
    csvDynamicFieldName: item.csvValue,
  }))

  // 字段映射请求
  const fieldMappingRequest: {
    channel: string
    mappingType: string
    data: { sysDynamicFieldName: string; csvDynamicFieldName: string }[]
    id?: string
  } = {
    channel: config.channelName,
    mappingType: 'field',
    data: fieldMappings,
  }

  // 订单状态映射请求
  const statusMappingRequest: {
    channel: string
    mappingType: string
    data: { sysDynamicFieldName: string; csvDynamicFieldName: string }[]
    id?: string
  } = {
    channel: config.channelName,
    mappingType: 'enum',
    data: statusMappings,
  }

  // 如果有id，添加到请求中
  if (config.fieldMappingId) {
    fieldMappingRequest.id = config.fieldMappingId
  }

  if (config.statusMappingId) {
    statusMappingRequest.id = config.statusMappingId
  }

  // 准备请求数组
  const requests = [
    request.post(
      '/api/shadow/v1/dynamic_field_mapping/upsert',
      fieldMappingRequest,
    ),
    request.post(
      '/api/shadow/v1/dynamic_field_mapping/upsert',
      statusMappingRequest,
    ),
  ]

  // 如果有服务状态映射，添加第三个请求
  if (config.serviceStatusMappings && config.serviceStatusMappings.length > 0) {
    const serviceStatusMappings = config.serviceStatusMappings.map((item) => ({
      sysDynamicFieldName: item.systemValue,
      csvDynamicFieldName: item.csvValue,
    }))

    const serviceStatusMappingRequest: {
      channel: string
      mappingType: string
      data: { sysDynamicFieldName: string; csvDynamicFieldName: string }[]
      id?: string
    } = {
      channel: config.channelName,
      mappingType: 'serviceStatusEnum',
      data: serviceStatusMappings,
    }

    if (config.serviceStatusMappingId) {
      serviceStatusMappingRequest.id = config.serviceStatusMappingId
    }

    requests.push(
      request.post(
        '/api/shadow/v1/dynamic_field_mapping/upsert',
        serviceStatusMappingRequest,
      ),
    )
  }

  // 分别发送所有请求
  const results = await Promise.all(requests)

  // 返回合并的结果
  return {
    fieldResult: results[0],
    statusResult: results[1],
    serviceStatusResult: results[2] || null,
  }
}

/**
 * 更新订单手机号
 * @param data 更新参数
 * @returns 更新结果
 */
export const updateOrderPhone = (data: {
  id: string
  phone: string
}): Promise<any> => {
  return request.post('/api/shadow/v1/order/updateOrderDetail', data)
}

/**
 * 获取订单核销进度
 * @param orderId 订单ID
 * @returns 核销进度数据
 */
export const getOrderProgress = (orderId: string) => {
  return request.get('/api/shadow/v1/order/getOrderVerificationProgressList', {
    orderId,
  })
}

/**
 * 同步微店订单
 * @returns 同步结果
 */
export const syncWeidianOrder = (): Promise<any> => {
  return request.post('/api/shadow/v1/order/syncWeiDianOrder', {})
}

/**
 * 小程序订单退款
 * @param data 退款参数
 * @returns 退款结果
 */
export const miniProgramOrderRefund = (data: {
  orderId: string
  payId: string
  refundReason: string
  refundAmount: number
}): Promise<{ refundId: string }> => {
  return request.post('/api/shadow/v1/order/miniProgramOrderRefund', data)
}

/**
 * 导出小程序流水
 * @param params 导出参数
 * @returns 导出文件下载URL
 */
export const exportMiniProgramFlow = (params: {
  startDate: string
  endDate: string
}): Promise<{ downloadUrl: string }> => {
  return request.post('/api/shadow/v1/order/exportWechatPayBill', {
    billStartTime: params.startDate,
    billEndTime: params.endDate,
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

/**
 * 将订单转为已退款
 * @param data 操作参数
 * @returns 操作结果
 */
export const convertOrderToRefunded = (data: {
  id: string
  reason: string
}): Promise<any> => {
  return request.post('/api/shadow/v1/order/updateOrderDetail', {
    id: data.id,
    status: 'refunded',
    remark: data.reason,
  })
}

/**
 * 获取子订单列表
 * @param params 查询参数（支持多种过滤条件）
 * @returns 子订单列表
 */
export const getSubOrderList = (params: {
  parentOrderId?: string // 父订单ID
  page?: number // 页码
  pageSize?: number // 页数
  goodName?: string // 商品名称
  channelId?: string // 渠道ID
  paymentTimeStart?: string // 支付开始时间
  paymentTimeEnd?: string // 支付结束时间
  orderStatus?: string // 订单状态
  orderNumber?: string // 订单编号
  phone?: string // 手机号
  serviceStatus?: string // 服务状态
  goodType?: string // 商品类型
  refundTimeStart?: string // 退款开始时间
  refundTimeEnd?: string // 退款结束时间
  campTimeStart?: string // 参营开始时间
  campTimeEnd?: string // 参营结束时间
}): Promise<SubOrderListResponse> => {
  // 移除所有undefined值
  const cleanParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

  return request.post('/api/shadow/v1/sub_order/list', cleanParams)
}
