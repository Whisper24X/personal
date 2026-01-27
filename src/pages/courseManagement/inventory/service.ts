import type { CourseStockInfoResponse } from './service.type'
import http from '@/service/axios.interceptor'
import {
  CourseInventoryQueryParams,
  CourseInventoryListResponse,
  CourseSelectorResponse,
  CourseStockSelectorResponse,
  UpdateGroupQrCodeParams,
} from './service.type'

/**
 * 课程库存查询参数 - 严格按照API请求结构
 */
interface CourseStockListRequestParams {
  /** 页码 */
  page: number
  /** 页数 */
  pageSize: number
  /** 课程Id */
  courseId?: string
  /** 课程日期 格式：2025-01-01 */
  startDate?: string
  /** 课程日期 格式：2025-01-01 */
  endDate?: string
  /** 状态 上架putOn 下架putOff */
  status?: string
  /** 课程类型：单日营：single;多日营：multi */
  courseType?: string
}

/**
 * 查询课程库存列表
 * @param params 查询参数
 * @returns 返回课程库存列表和总数
 */
export function queryCourseInventoryList(
  params: CourseInventoryQueryParams,
): Promise<CourseInventoryListResponse> {
  try {
    // 创建一个与API规范严格一致的查询参数对象
    const queryParams: CourseStockListRequestParams = {
      page: params.page,
      pageSize: params.pageSize,
      courseId: params.courseId || undefined,
      startDate: params.courseDateRange?.[0] || undefined,
      endDate: params.courseDateRange?.[1] || undefined,
      status: params.status,
      courseType: params.courseType,
    }

    // 移除所有undefined值，避免发送不必要的参数
    const cleanParams = Object.entries(queryParams)
      .filter(([_, value]) => value !== undefined)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})

    return http.post('/api/shadow/v1/course_stock/list', cleanParams)
  } catch (error) {
    console.error('查询课程库存列表请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 课程库存详情响应 - 严格按照API响应结构
 */
interface GetCourseStockInfoResponse {
  info: {
    id: string
    courseId: string
    courseName: string
    date: string
    period: string
    stock: number
    status: string
    createdAt: string
    updatedAt: string
    updatedBy: string
    updatedByName: string
  }
}

/**
 * 获取课程库存详情
 * @param id 库存ID
 * @returns 库存详情
 */
export const getDetailCourseStock = (id: string) => {
  return http
    .get<GetCourseStockInfoResponse>('/api/shadow/v1/course_stock/info', { id })
    .then((res) => {
      if (res && res.info) {
        // 直接返回API响应的info对象，不做字段映射
        return res.info
      }
      return Promise.reject(new Error('获取库存信息失败'))
    })
}

/**
 * 更新课程库存请求参数
 */
interface UpdateCourseStockRequestParams {
  /** id */
  id: string
  /** 课程Id */
  courseId: string
  /** 课程日期 格式：2025-01-01 */
  date: string
  /** 课程时间 格式：10:00-12:00 */
  period: string
  /** 库存 */
  stock: number
}

/**
 * 更新课程库存状态请求参数
 */
interface UpdateCourseStockStatusRequestParams {
  /** id集合 */
  ids: string[]
  /** 状态 上架putOn 下架putOff */
  status: string
}

/**
 * 更新课程库存
 * @param params 更新参数
 * @returns 返回更新结果
 */
export function updateCourseInventory(params: {
  id: string
  stock: number
}): Promise<{}> {
  try {
    // 直接更新库存，只需要id和stock参数
    return http.post('/api/shadow/v1/course_stock/update', {
      id: params.id,
      stock: params.stock,
    })
  } catch (error) {
    console.error('更新课程库存请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取课程选择器数据
 * @returns 返回课程选择器数据
 */
export function getCourseSelector(): Promise<CourseSelectorResponse> {
  try {
    return http.get('/api/shadow/v1/course/selector')
  } catch (error) {
    console.error('获取课程选择器数据请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 创建课程库存请求参数 - 严格按照API请求结构
 */
interface CreateCourseStockRequestParams {
  /** 课程Id */
  courseId: string
  /** 课程日期 */
  dates: string[]
  /** 课程时间 */
  periods: string[]
  /** 库存 */
  stock: number
  /** 课程类型：单日营：single;多日营：multi */
  courseType?: string
}

/**
 * 创建课程库存响应 - 严格按照API响应结构
 */
interface CreateCourseStockResponse {
  /** 创建的库存ID */
  id: string
}

/**
 * 创建课程库存
 * @param params 库存信息
 * @returns 返回创建结果
 */
export function createCourseStock(params: {
  courseId: string
  dates: string[]
  periods: string[]
  totalInventory: number
  courseType?: string
}): Promise<CreateCourseStockResponse> {
  try {
    const createData: CreateCourseStockRequestParams = {
      courseId: params.courseId,
      dates: params.dates,
      periods: params.periods,
      stock: params.totalInventory,
      courseType: params.courseType,
    }
    return http.post('/api/shadow/v1/course_stock/create', createData)
  } catch (error) {
    console.error('创建课程库存请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 更新课程库存状态
 * @param params 状态更新参数
 * @returns 返回更新结果
 */
export function updateCourseStockStatus(params: {
  ids: string[]
  status: string
}): Promise<{}> {
  try {
    const updateParams: UpdateCourseStockStatusRequestParams = {
      ids: params.ids,
      status: params.status,
    }
    return http.post('/api/shadow/v1/course_stock/update_status', updateParams)
  } catch (error) {
    console.error('更新课程库存状态请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 删除课程库存请求参数 - 严格按照API请求结构
 */
interface DeleteCourseStockRequestParams {
  /** id集合 */
  ids: string[]
}

/**
 * 删除课程库存
 * @param params 删除参数
 * @returns 返回删除结果
 */
export function deleteCourseStock(params: { ids: string[] }): Promise<{}> {
  try {
    const deleteParams: DeleteCourseStockRequestParams = {
      ids: params.ids,
    }
    return http.post('/api/shadow/v1/course_stock/delete', deleteParams)
  } catch (error) {
    console.error('删除课程库存请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 获取课程库存选择器数据
 * @param params 查询参数
 * @returns 返回课程库存选择器数据
 */
export function getCourseStockSelector(params: {
  courseId: string
  startDate?: string
  endDate?: string
}): Promise<CourseStockSelectorResponse> {
  try {
    return http.get('/api/shadow/v1/course_stock/selector', params)
  } catch (error) {
    console.error('获取课程库存选择器数据请求构建错误:', error)
    return Promise.reject(error)
  }
}

/**
 * 更新课程库存群聊二维码
 * @param params 更新参数
 * @returns 返回更新结果
 */
export function updateCourseStockGroupQrCode(
  params: UpdateGroupQrCodeParams,
): Promise<{}> {
  try {
    return http.post('/api/shadow/v1/course_stock/updateGroupQrCode', params)
  } catch (error) {
    console.error('更新课程库存群聊二维码请求构建错误:', error)
    return Promise.reject(error)
  }
}
