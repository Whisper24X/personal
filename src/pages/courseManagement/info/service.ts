import http from '@/service/axios.interceptor'
import type {
  CourseListQuery,
  CourseListResponse,
  CreateCourseRequest,
  CreateCourseResponse,
  UpdateCourseRequest,
  UpdateCourseResponse,
  DeleteCourseResponse,
  UpdateCourseStatusResponse,
  GetCourseInfoResponse,
} from './service.type'

/**
 * 获取课程列表
 * @param params 查询参数
 */
export const getCourseList = (params: CourseListQuery) =>
  http.post<CourseListResponse>('/api/shadow/v1/course/list', params)

/**
 * 获取课程详情
 * @param id 课程ID
 */
export const getCourseInfo = (id: string) =>
  http.get<GetCourseInfoResponse>('/api/shadow/v1/course/info', {
    id,
  })

/**
 * 创建课程
 * @param data 课程数据
 */
export const createCourse = (data: CreateCourseRequest) =>
  http.post<CreateCourseResponse>('/api/shadow/v1/course/create', data)

/**
 * 更新课程
 * @param data 课程数据
 */
export const updateCourse = (data: UpdateCourseRequest) =>
  http.post<UpdateCourseResponse>('/api/shadow/v1/course/update', data)

/**
 * 删除课程
 * @param ids 课程ID数组
 */
export const deleteCourse = (ids: string[]) =>
  http.post<DeleteCourseResponse>('/api/shadow/v1/course/delete', {
    ids,
  })

/**
 * 更新课程状态
 * @param ids 课程ID数组
 * @param status 状态
 */
export const updateCourseStatus = (ids: string[], status: string) =>
  http.post<UpdateCourseStatusResponse>('/api/shadow/v1/course/updateStatus', {
    ids,
    status,
  })
