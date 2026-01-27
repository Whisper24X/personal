import http from '@/service/axios.interceptor'
import {
  ContractQueryParams,
  ContractRecordListResponse,
  CampPeriod,
} from './service.type'

/**
 * 查询合同记录列表
 * @param params 查询参数
 * @returns 返回合同记录列表和总数
 */
export function queryContractList(
  params: ContractQueryParams,
): Promise<ContractRecordListResponse> {
  try {
    // 创建一个简单的查询参数对象，避免传递可能包含复杂引用的对象
    const queryParams = {
      childName: params.childName || '',
      parentPhone: params.parentPhone || '',
      topic: params.topic || '',
      status: params.status,
      activityStartDate: params.activityStartDate || '',
      contractType: params.contractType || null,
      page: params.page,
      pageSize: params.pageSize,
    }
    return http.post('/api/shadow/v1/queryContractList', queryParams)
  } catch (error) {
    console.error('查询合同记录列表请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 下载合同文件
 * @param url 合同URL
 * @returns 返回下载的文件内容
 */
export function downloadContract(url: string): Promise<Blob> {
  return http.get(url, {
    responseType: 'blob',
    baseURL: '', // 使用完整URL
  })
}

/**
 * 导出合同记录
 * @param params 查询参数
 * @returns 返回文件下载URL
 */
export function exportContractList(
  params: any,
): Promise<{ downloadUrl: string }> {
  try {
    return http.post('/api/shadow/v1/exportContractList', params)
  } catch (error) {
    console.error('导出合同记录请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 导入合同记录
 * @param params 导入参数
 * @returns 返回导入结果
 */
export function importContractList(params: {
  fileUrl: string
}): Promise<{ isSucceed: boolean; failureReasons?: string[] }> {
  return http.post('/api/shadow/v1/importContractList', params)
}

/**
 * 导入合同用户信息
 * @param params 导入参数
 * @returns 返回异步任务ID
 */
export function importContractUserInfoByCsvFile(params: {
  fileUrl: string
}): Promise<{ asyncTaskId: string }> {
  return http.post('/api/shadow/v1/importContractUserInfoByCsvFile', params)
}

/**
 * 查询异步任务结果
 * @param taskId 任务ID
 * @returns 返回任务状态信息
 */
export function queryAsyncTaskResult(
  taskId: string,
): Promise<{ taskId: string; status: number; errorInfo: string }> {
  return http.get('/api/shadow/v1/queryAsyncTaskResult', {
    taskId,
  })
}

/**
 * 撤销合同签署流程
 * @param params 撤销参数
 * @returns 返回撤销结果
 */
export function revokeSignFlow(params: {
  signFlowId: string
  revokeReason: string
}): Promise<{ isSucceed: boolean }> {
  return http.post('/api/shadow/v1/revokeSignFlow', params)
}

/**
 * 短信提醒签署合同
 * @param params 提醒参数
 * @returns 返回提醒结果
 */
export function urgeSignFlow(params: {
  signFlowId: string
  psnAccount: string
}): Promise<{ isSucceed: boolean }> {
  return http.post('/api/shadow/v1/urgeSignFlow', params)
}

/**
 * 查询研学主题列表
 * @returns 返回主题列表
 */
export function queryTopicList(): Promise<{ list: string[] }> {
  return http.get('/api/shadow/v1/queryTopicList')
}

/**
 * 获取合同字段信息
 * @param params 请求参数
 * @returns 返回合同字段信息
 */
export function getContractFieldInfo(params: { id: string }): Promise<{
  parentName?: string
  parentPhone?: string
  childName?: string
  childId?: string
  activityStartDate?: string
  activityEndDate?: string
  cost?: string
  costCapital?: string
  payEndDate?: string
  [property: string]: any
}> {
  try {
    return http.post(
      '/api/shadow/v1/course_appointment/getContractFieldInfo',
      params,
    )
  } catch (error) {
    console.error('获取合同字段信息请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 推送合同
 * @param params 推送参数
 * @returns 返回推送结果，包含异步任务ID
 */
export function pushContract(params: {
  courseAppointmentId: string
  parentName?: string
  parentPhone?: string
  childName?: string
  childId?: string
  activityStartDate?: string
  activityEndDate?: string
  cost?: string
  costCapital?: string
  payEndDate?: string
  [property: string]: any
}): Promise<{ asyncTaskId: string }> {
  try {
    return http.post('/api/shadow/v1/generateContractByUserInfo', params)
  } catch (error) {
    console.error('推送合同请求构建错误:', error)
    return Promise.reject(error)
  }
}
