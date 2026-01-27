import http from '@/service/axios.interceptor'
import {
  CourseAppointmentListResponse,
  CourseSelectorResponse,
  CourseAppointmentDetailResponse,
  CourseStockSelectorResponse,
  CourseTimePeriodsResponse,
  ContractFieldInfoResponse,
  AsyncTaskResult,
  PushContractResponse,
  OrdersByPhoneResponse,
  CoursesByOrderIdResponse,
} from './service.type'
import { centsToYuanNumber } from '@/utils/money'

/**
 * 查询课程预约列表
 * @param params 查询参数
 * @returns 返回课程预约列表和总数
 */
export function queryCourseAppointmentList(
  params: any,
): Promise<CourseAppointmentListResponse> {
  try {
    // 使用新的API接口
    return http.post('/api/shadow/v1/course_appointment/list', params).then((res: any) => {
      // 将订单金额从分转换为元（用于前端显示）
      if (res && res.list) {
        res.list = res.list.map((item: any) => ({
          ...item,
          orderPrice: item.orderPrice ? centsToYuanNumber(item.orderPrice) : item.orderPrice,
        }))
      }
      return res as CourseAppointmentListResponse
    })
  } catch (error) {
    console.error('查询课程预约列表请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取课程预约详情
 * @param id 预约ID
 * @returns 预约详情
 */
export const getCourseAppointmentDetail = (id: string) => {
  return http
    .get<CourseAppointmentDetailResponse>(
      '/api/shadow/v1/course_appointment/info',
      { id },
    )
    .then((res: CourseAppointmentDetailResponse) => {
      if (res && res.info) {
        return res.info
      }
      return Promise.reject(new Error('获取预约详情失败'))
    })
}

/**
 * 获取课程选择器数据
 * @returns 返回课程选择器数据
 */
export function getCourseSelector(
  courseId?: string,
): Promise<CourseSelectorResponse> {
  try {
    const params = courseId ? { courseId } : {}
    return http.get('/api/shadow/v1/course/selector', params)
  } catch (error) {
    console.error('获取课程选择器数据请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取课程库存选择器
 * @param courseId 课程ID
 * @param params 可选参数，包含开始日期和结束日期
 * @returns 返回课程库存选择器数据
 */
export function getCourseStockSelector(
  courseId: string,
  params?: { startDate?: string; endDate?: string }
): Promise<CourseStockSelectorResponse> {
  try {
    const queryParams = {
      courseId,
      ...(params || {})
    }
    return http.get('/api/shadow/v1/course_stock/selector', queryParams)
  } catch (error) {
    console.error('获取课程库存选择器请求构建错误:', error)
    return Promise.reject(error)
  }
}


/**
 * 创建/更新课程预约
 * @param params 预约信息
 * @returns 返回操作结果
 */
export function updateCourseAppointment(params: any): Promise<any> {
  try {
    return http.post('/api/shadow/v1/course_appointment/update', params)
  } catch (error) {
    console.error('更新课程预约请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 创建课程预约
 * @param params 预约信息
 * @returns 返回创建结果
 */
export function createCourseAppointment(params: any): Promise<any> {
  try {
    // 使用新的API路径
    return http.post('/api/shadow/v1/course_appointment/create', params)
  } catch (error) {
    console.error('创建课程预约请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 更新课程预约状态请求参数
 */
interface UpdateCourseAppointmentStatusRequestParams {
  /** id集合 */
  ids: string[]
  /** 状态 cancelled-取消预约, completed-已完成 */
  status: string
}

/**
 * 更新课程预约状态
 * @param params 状态更新参数
 * @returns 返回更新结果
 */
export function updateCourseAppointmentStatus(params: {
  ids: string[]
  status: string
}): Promise<{}> {
  try {
    if (params.ids.length === 1) {
      return http.post('/api/shadow/v1/course_appointment/cancel', {
        id: params.ids[0],
      })
    } else {
      // 如果是批量取消，则串行处理每个id
      const promises = params.ids.map((id) =>
        http.post('/api/shadow/v1/course_appointment/cancel', { id }),
      )
      return Promise.all(promises).then(() => ({}))
    }
  } catch (error) {
    console.error('更新课程预约状态请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取课程时间段列表
 * @returns 返回课程时间段列表
 */
export function getCourseTimePeriods(): Promise<CourseTimePeriodsResponse> {
  try {
    return http.get('/api/shadow/v1/course/periods')
  } catch (error) {
    console.error('获取课程时间段列表请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取可用课程日期列表
 * @returns 返回可用课程日期列表
 */
export function getAvailableDates(): Promise<{ dates: string[] }> {
  try {
    return http.get('/api/shadow/v1/course/available_dates')
  } catch (error) {
    console.error('获取可用课程日期列表请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取指定日期下的可用时段列表
 * @param date 日期，格式：YYYY-MM-DD
 * @returns 返回指定日期下的可用时段列表
 */
export function getAvailablePeriodsForDate(
  date: string,
): Promise<{ periods: string[] }> {
  try {
    return http.get('/api/shadow/v1/course/available_periods', { date })
  } catch (error) {
    console.error('获取指定日期下的可用时段列表请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 导出课程预约
 * @param params 导出参数
 * @returns 返回导出结果
 */
export function exportCourseAppointment(params: any): Promise<any> {
  try {
    return http.post('/api/shadow/v1/course_appointment/export', params)
  } catch (error) {
    console.error('导出课程预约请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取合同字段信息
 * @param params 请求参数
 * @returns 返回合同字段信息
 */
export function getContractFieldInfo(params: {
  id: string
}): Promise<ContractFieldInfoResponse> {
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
 * @param params 请求参数
 * @returns 返回推送结果，包含异步任务ID
 */
export function pushContract(
  params: ContractFieldInfoResponse & { courseAppointmentId: string },
): Promise<PushContractResponse> {
  try {
    return http.post('/api/shadow/v1/generateContractByUserInfo', params)
  } catch (error) {
    console.error('推送合同请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 查询异步任务结果
 * @param taskId 异步任务ID
 * @returns 返回任务结果
 */
export function queryAsyncTaskResult(taskId: string): Promise<AsyncTaskResult> {
  try {
    return http.get('/api/shadow/v1/queryAsyncTaskResult', { taskId })
  } catch (error) {
    console.error('查询异步任务结果请求构建错误:', error)
    return Promise.reject(error)
  }
}


/**
 * 通过手机号查询订单
 * @param phone 手机号
 * @returns 返回订单列表
 */
export function queryOrdersByPhone(phone: string): Promise<OrdersByPhoneResponse> {
  try {
    return http.post<OrdersByPhoneResponse>('/api/shadow/v1/order/getOrderListByPhone', { phone }).then((res) => {
      // 将订单金额从分转换为元
      if (res && res.list) {
        res.list = res.list.map((item) => ({
          ...item,
          orderPrice: centsToYuanNumber(item.orderPrice),
        }))
      }
      return res
    })
  } catch (error) {
    console.error('通过手机号查询订单请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 通过订单ID查询可用课程
 * @param orderId 订单ID
 * @returns 返回可用课程列表
 */
export function queryCoursesByOrderId(orderId: string): Promise<CoursesByOrderIdResponse> {
  try {
    return http.post('/api/shadow/v1/order/goodinfo', { id: orderId }).then((res: any) => {
      // 将商品价格从分转换为元（用于前端显示）
      if (res && res.goodInfo && res.goodInfo.price !== undefined) {
        res.goodInfo.price = centsToYuanNumber(res.goodInfo.price)
      }
      return res as CoursesByOrderIdResponse
    })
  } catch (error) {
    console.error('通过订单ID查询可用课程请求构建错误:', error)
    return Promise.reject(error)
  }
}
