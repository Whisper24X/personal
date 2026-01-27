import { get, post } from "./request"

// 课程相关接口类型定义
export interface CourseStockSelectorItem {
  date: string // 日期 格式：2025-01-01
  period: string // 时间段 格式：10:00-12:00
  stock: number // 库存
  stockRemain: number // 剩余库存
}

export interface AppointmentInfo {
  id: string
  orderId: string
  goodId: string
  categoryId: string
  courseId: string
  date: string
  period: string
  studentName: string
  studentIdentityCard: string
  studentSex: string // 男M,女F
  studentAge: number
  parentName: string
  parentPhone: string
  parentAccompany: string // yes 是 no 否 unknown 未知
  verificationCode?: string
  status: string // cancel 取消预约 success 已预约 completed 已完成
  createdAt: string
  updatedAt: string
  goodName: string
  courseName: string
  parentRemark?: string
  courseType: string // 课程类型：单日营；多日营
  groupQrCode: string // 群聊二维码
}

/**
 * 获取课程库存选择器数据
 */
export const getCourseStockSelector = (params: {
  courseId: string
  startDate: string
  endDate: string
}) => {
  return get<{
    items: CourseStockSelectorItem[]
  }>("/yanxue/wechat/v1/course/stock/selector", params)
}

/**
 * 创建课程预约
 */
export const createCourseAppointment = (data: {
  orderId: string
  categoryId?: string
  courseId: string
  date: string
  period: string
  studentName: string
  studentIdentityCard: string
  studentSex: string
  studentAge: number
  parentName: string
  parentPhone: string
  parentAccompany: string
  verificationCode?: string
  parentRemark?: string
}) => {
  return post<{ id: string }>("/yanxue/wechat/v1/course/appointment/create", data)
}

/**
 * 更新课程预约
 */
export const updateCourseAppointment = (data: {
  id: string
  date?: string
  period?: string
  studentName?: string
  studentIdentityCard?: string
  studentSex?: string
  studentAge?: number
  parentName?: string
  parentPhone?: string
  parentAccompany?: string
  verificationCode?: string
  parentRemark?: string
}) => {
  return post("/yanxue/wechat/v1/course/appointment/update", data)
}

/**
 * 取消课程预约
 */
export const cancelCourseAppointment = (data: { id: string }) => {
  return post("/yanxue/wechat/v1/course/appointment/cancel", data)
}

/**
 * 获取课程预约信息
 */
export const getCourseAppointmentInfo = (id: string) => {
  return get<{
    info: AppointmentInfo
  }>("/yanxue/wechat/v1/course/appointment/info", { id })
}

/**
 * 获取课程预约列表
 */
export const getCourseAppointmentList = (params: {
  page: number
  pageSize: number
  status?: string // cancel 取消预约 success 已预约 completed 已完成
}) => {
  return get<{
    total: number
    list: AppointmentInfo[]
  }>("/yanxue/wechat/v1/course/appointment/record", params)
}

/**
 * 通过预约ID查询群聊二维码
 */
export const getGroupQrCodeByAppointmentId = (appointmentId: string) => {
  return get<{
    groupQrCode: string
  }>("/yanxue/wechat/v1/course/appointment/getGroupQrCodeByAppointmentId", { appointmentId })
}
